import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';

import LoginScreen from './components/LoginScreen';
import { sendChatMessage } from './services/api';
import {
  syncChatToSupabase,
  fetchChatsFromSupabase,
  fetchMessagesFromSupabase,
  isSupabaseConfigured,
  getCurrentUser,
  logoutUser,
  subscribeToAuthChanges,
  updateMessageFeedback,
  updateMessageResponse,
} from './services/supabase';
import {
  trackPromptSent,
  trackCopyEvent,
  trackRegenerateEvent,
  trackSuggestedPromptClicked,
  trackChatEvent,
  trackTabVisibility,
  trackAuthEvent,
  trackFeedbackRating,
} from './services/telemetry';

// ── Hidden-chat helpers ───────────────────────────────────────────────────────
// Chats deleted from the UI are NOT removed from Supabase (research data),
// but we track their IDs locally so they stay hidden on the next load.
const HIDDEN_KEY = 'aiviz_hidden_chats';

const getHiddenChatIds = () => {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const addHiddenChatIds = (ids) => {
  const current = getHiddenChatIds();
  ids.forEach((id) => current.add(id));
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...current]));
};
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('aiviz_theme') || 'dark';
  });

  // Chat sessions state
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('aiviz_chats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached chats', e);
      }
    }
    const initialId = `chat-${Date.now()}`;
    return [
      {
        id: initialId,
        title: 'New Session',
        created_at: new Date().toISOString(),
      },
    ];
  });

  // Active Chat ID
  const [activeChatId, setActiveChatId] = useState(() => {
    return chats[0]?.id || `chat-${Date.now()}`;
  });

  // Messages map: { [chatId]: Array<Message> }
  const [messagesMap, setMessagesMap] = useState(() => {
    const saved = localStorage.getItem('aiviz_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached messages', e);
      }
    }
    return {};
  });

  // Input text & status
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Tracks whether the last AI response is awaiting a feedback rating
  const [awaitingFeedback, setAwaitingFeedback] = useState(false);


  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aiviz_theme', theme);
  }, [theme]);

  // Check auth session on startup
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        if (user) {
          trackAuthEvent({ eventType: 'session_restored', user });
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        setIsAuthLoading(false);
      }
    }
    checkAuth();

    // Listen to Supabase auth events
    const subscription = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
    });

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Telemetry: Track browser tab focus/blur (when student leaves the window)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      if (currentUserRef.current) {
        trackTabVisibility({
          isVisible,
          chatId: activeChatIdRef.current,
          user: currentUserRef.current,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Persist chats and messages to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('aiviz_chats', JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('aiviz_messages', JSON.stringify(messagesMap));
    }
  }, [messagesMap, currentUser]);

  // Load user chats from Supabase upon login
  useEffect(() => {
    async function loadSupabaseData() {
      if (currentUser && isSupabaseConfigured()) {
        const remoteChats = await fetchChatsFromSupabase(currentUser.team_name);
        if (remoteChats && remoteChats.length > 0) {
          // Filter out chats the user has hidden/deleted in the UI
          const hiddenIds = getHiddenChatIds();
          const visibleChats = remoteChats.filter((c) => !hiddenIds.has(c.id));

          if (visibleChats.length > 0) {
            setChats(visibleChats);
            setActiveChatId(visibleChats[0].id);

            // Fetch messages for initial chat
            const initialMsgs = await fetchMessagesFromSupabase(visibleChats[0].id);
            if (initialMsgs) {
              setMessagesMap((prev) => ({
                ...prev,
                [visibleChats[0].id]: initialMsgs,
              }));
              // Restore awaitingFeedback: block if last message is an unrated assistant reply
              const lastMsg = initialMsgs[initialMsgs.length - 1];
              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.userRating == null) {
                setAwaitingFeedback(true);
              } else {
                setAwaitingFeedback(false);
              }
            }
          }
        }
      }
    }
    loadSupabaseData();
  }, [currentUser]);

  // Get active chat metadata & messages
  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const currentMessages = messagesMap[activeChatId] || [];

  // Toggle Dark/Light Theme
  const handleToggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      if (currentUser) {
        trackChatEvent({
          eventType: 'theme_toggled',
          chatId: activeChatId,
          details: { new_theme: nextTheme },
          user: currentUser,
        });
      }
      return nextTheme;
    });
  };

  // Login handler
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    trackAuthEvent({ eventType: 'user_logged_in', user });
  };

  // Logout Handler
  const handleLogout = async () => {
    if (currentUser) {
      await trackAuthEvent({ eventType: 'user_logged_out', user: currentUser });
    }
    await logoutUser();
    setCurrentUser(null);
  };

  // Create a brand new chat session
  const handleNewChat = useCallback(() => {
    const newId = `chat-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Session',
      created_at: new Date().toISOString(),
    };

    setChats((prev) => [newSession, ...prev]);
    setActiveChatId(newId);
    setInput('');
    setIsSidebarOpen(false);

    if (currentUser) {
      trackChatEvent({
        eventType: 'new_chat_created',
        chatId: newId,
        details: { previous_chat_id: activeChatId },
        user: currentUser,
      });
    }

    if (isSupabaseConfigured() && currentUser) {
      syncChatToSupabase(newSession, currentUser.team_name);
    }
  }, [activeChatId, currentUser]);

  // Switch active chat
  const handleSelectChat = async (chatId) => {
    const prevChatId = activeChatId;
    setActiveChatId(chatId);
    setIsSidebarOpen(false);

    if (currentUser && prevChatId !== chatId) {
      trackChatEvent({
        eventType: 'chat_switched',
        chatId,
        details: { from_chat_id: prevChatId, to_chat_id: chatId },
        user: currentUser,
      });
    }

    // Load messages from Supabase if not yet in state
    if (!messagesMap[chatId] && isSupabaseConfigured()) {
      const remoteMsgs = await fetchMessagesFromSupabase(chatId);
      if (remoteMsgs) {
        setMessagesMap((prev) => ({
          ...prev,
          [chatId]: remoteMsgs,
        }));
        // Restore awaitingFeedback for this chat
        const lastMsg = remoteMsgs[remoteMsgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.userRating == null) {
          setAwaitingFeedback(true);
        } else {
          setAwaitingFeedback(false);
        }
      }
    } else {
      // Messages already in state — restore feedback state from what's there
      const chatMsgs = messagesMap[chatId] || [];
      const lastMsg = chatMsgs[chatMsgs.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.userRating == null) {
        setAwaitingFeedback(true);
      } else {
        setAwaitingFeedback(false);
      }
    }
  };

  // Delete a specific chat session (UI only — DB records preserved for research)
  const handleDeleteChat = async (chatId) => {
    const remainingChats = chats.filter((c) => c.id !== chatId);

    if (currentUser) {
      trackChatEvent({
        eventType: 'chat_deleted',
        chatId,
        details: { remaining_count: remainingChats.length },
        user: currentUser,
      });
    }

    setChats(remainingChats);
    setMessagesMap((prev) => {
      const copy = { ...prev };
      delete copy[chatId];
      return copy;
    });

    // Mark as hidden so it won't reappear when Supabase reloads
    // (DB record is intentionally preserved for research)
    addHiddenChatIds([chatId]);

    if (activeChatId === chatId) {
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id);
      } else {
        const newId = `chat-${Date.now()}`;
        const freshChat = {
          id: newId,
          title: 'New Session',
          created_at: new Date().toISOString(),
        };
        setChats([freshChat]);
        setActiveChatId(newId);
      }
    }
  };

  // Clear all chats (UI only — DB records preserved for research)
  const handleClearAllChats = async () => {
    if (!window.confirm('Are you sure you want to clear all conversation history?')) {
      return;
    }

    if (currentUser) {
      trackChatEvent({
        eventType: 'all_chats_cleared',
        chatId: activeChatId,
        details: { previous_total_chats: chats.length },
        user: currentUser,
      });
    }

    setMessagesMap({});
    const newId = `chat-${Date.now()}`;
    const freshChat = {
      id: newId,
      title: 'New Session',
      created_at: new Date().toISOString(),
    };

    setChats([freshChat]);
    setActiveChatId(newId);

    // Mark all previous chats as hidden so they won't reappear on Supabase reload
    // (DB records are intentionally preserved for research)
    addHiddenChatIds(chats.map((c) => c.id));
  };

  // Clear current active chat messages
  const handleClearCurrentChat = () => {
    if (!window.confirm('Clear messages in this session?')) return;

    if (currentUser) {
      trackChatEvent({
        eventType: 'current_chat_cleared',
        chatId: activeChatId,
        details: { message_count: currentMessages.length },
        user: currentUser,
      });
    }

    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: [],
    }));
  };

  // Send message handler (with drafting duration telemetry)
  const handleSend = async (draftingDurationMs = 0) => {
    if (!input.trim() || isLoading) return;

    const userPrompt = input.trim();
    setInput('');

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...currentMessages, userMessage];

    // Optimistically update UI
    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: updatedMessages,
    }));

    // Auto-update chat title if it's the first message
    let currentTitle = activeChat?.title || 'New Session';
    if (currentMessages.length === 0 || currentTitle === 'New Session') {
      const generatedTitle = userPrompt.slice(0, 36) + (userPrompt.length > 36 ? '...' : '');
      currentTitle = generatedTitle;
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, title: generatedTitle } : c))
      );
    }

    // Telemetry: Track prompt submission & drafting time
    trackPromptSent({
      prompt: userPrompt,
      draftingDurationMs,
      chatId: activeChatId,
      user: currentUser,
    });

    setIsLoading(true);

    try {
      // Pass full conversation history and user ID for context & database logging
      const { message: assistantMsg } = await sendChatMessage({
        messages: updatedMessages,
        chatId: activeChatId,
        chatTitle: currentTitle,
        userId: currentUser?.team_name || null,
        userEmail: currentUser?.team_name || null,
        draftingDurationMs,
      });

      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...updatedMessages, assistantMsg],
      }));
      // Require feedback before next prompt
      setAwaitingFeedback(true);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'error',
        isError: true,
        content: error.message || 'An unexpected error occurred while communicating with the AI.',
        timestamp: new Date().toISOString(),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...updatedMessages, errorMsg],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Retry last response
  const handleRetry = async () => {
    if (isLoading || currentMessages.length === 0) return;

    const validMessages = currentMessages.filter((m) => !m.isError && m.role !== 'error');
    if (validMessages.length === 0) return;

    let contextMessages = [...validMessages];
    if (contextMessages[contextMessages.length - 1].role === 'assistant') {
      contextMessages.pop();
    }

    if (contextMessages.length === 0) return;

    // Telemetry: Track regeneration click
    trackRegenerateEvent({
      chatId: activeChatId,
      user: currentUser,
    });

    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: contextMessages,
    }));

    setIsLoading(true);

    try {
      const { message: assistantMsg } = await sendChatMessage({
        messages: contextMessages,
        chatId: activeChatId,
        chatTitle: activeChat?.title || 'New Session',
        userId: currentUser?.team_name || null,
        userEmail: currentUser?.team_name || null,
      });

      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...contextMessages, assistantMsg],
      }));
      // Require feedback before next prompt
      setAwaitingFeedback(true);
    } catch (error) {
      console.error('Retry error:', error);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'error',
        isError: true,
        content: error.message || 'Failed to regenerate response.',
        timestamp: new Date().toISOString(),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...contextMessages, errorMsg],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Telemetry: Track Copy Event
  const handleCopyTelemetry = ({ content, contentType, language }) => {
    trackCopyEvent({
      content,
      contentType,
      language,
      chatId: activeChatId,
      user: currentUser,
    });
  };

  // Telemetry: Track Starter Prompt Click
  const handleSelectSuggestedPrompt = (promptTitle, promptText) => {
    trackSuggestedPromptClicked({
      promptTitle,
      promptText,
      chatId: activeChatId,
      user: currentUser,
    });
  };

  // Telemetry + DB: Track 1-5 Feedback Rating and persist to messages table
  const handleFeedbackRating = ({ rating, messageId, interactionId }) => {
    // Store the rating on the message object in state so it survives re-renders
    setMessagesMap((prev) => {
      const chatMsgs = prev[activeChatId] || [];
      return {
        ...prev,
        [activeChatId]: chatMsgs.map((msg) =>
          msg.id === messageId ? { ...msg, userRating: rating } : msg
        ),
      };
    });
    trackFeedbackRating({
      rating,
      messageId,
      chatId: activeChatId,
      user: currentUser,
    });
    updateMessageFeedback({ interactionId, rating });
    setAwaitingFeedback(false);
  };

  // Update message content (e.g. when PlantUML diagram is manually edited)
  const handleUpdateMessage = (messageId, newContent, editDetails = null) => {
    // 1. Update messages state so active conversation & next prompt context reflects the edited code
    setMessagesMap((prev) => {
      const chatMsgs = prev[activeChatId] || [];
      return {
        ...prev,
        [activeChatId]: chatMsgs.map((msg) =>
          msg.id === messageId ? { ...msg, content: newContent } : msg
        ),
      };
    });

    // 2. If Supabase is configured and message has an interactionId, persist the change to DB
    const chatMsgs = messagesMap[activeChatId] || [];
    const targetMsg = chatMsgs.find((m) => m.id === messageId);
    if (targetMsg?.interactionId && isSupabaseConfigured()) {
      updateMessageResponse({
        interactionId: targetMsg.interactionId,
        response: newContent,
      });
    }

    // 3. Telemetry: log the manual edit event
    if (currentUser) {
      trackChatEvent({
        eventType: 'plantuml_code_edited',
        chatId: activeChatId,
        details: {
          messageId,
          ...(editDetails || {}),
        },
        user: currentUser,
      });
    }
  };

  // Loading state while verifying session
  if (isAuthLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  // Gate the application behind the Login Screen if unauthenticated
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onClearAllChats={handleClearAllChats}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="main-content">
        <ChatWindow
          activeChat={activeChat}
          messages={currentMessages}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onRetry={handleRetry}
          onCopy={handleCopyTelemetry}
          onRate={handleFeedbackRating}
          onUpdateMessage={handleUpdateMessage}
          onClearChat={handleClearCurrentChat}
          onSelectPrompt={handleSelectSuggestedPrompt}
          isLoading={isLoading}
          awaitingFeedback={awaitingFeedback}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
      </div>
    </div>
  );
}
