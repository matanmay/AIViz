import React, { useRef, useEffect } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import { Bot, Trash2 } from 'lucide-react';


export default function ChatWindow({
  activeChat,
  messages,
  input,
  setInput,
  onSend,
  onRetry,
  onCopy,
  onRate,
  onClearChat,
  onSelectPrompt,
  isLoading,
  awaitingFeedback,
  onToggleSidebar,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom whenever messages change or loading state triggers
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);


  return (
    <div className="chat-window">
      {/* Top Header */}
      <header className="chat-header">
        <div className="header-left">
          <button
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <div className="header-title-container">
            <h2 className="header-chat-title">
              {activeChat?.title || 'New Session'}
            </h2>
            <span className="header-study-pill">
              Session
            </span>
          </div>
        </div>

        <div className="header-right">
          {messages.length > 0 && (
            <button
              className="clear-chat-btn"
              onClick={onClearChat}
              title="Clear current session messages"
            >
              <Trash2 size={16} />
              <span>Clear Session</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main className="messages-scroll-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-hero">
              <div className="empty-bot-badge">
                <Bot size={36} />
              </div>
              <h1 className="empty-title">AI Assistant</h1>
              <p className="empty-subtitle">
                Welcome to the course LLM assistant. Start by typing your question below.
              </p>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, index) => (
              <Message
                key={msg.id || index}
                message={msg}
                isLast={index === messages.length - 1}
                onCopy={onCopy}
                onRate={onRate}
                requiresFeedback={awaitingFeedback && index === messages.length - 1 && msg.role === 'assistant'}
                onRetry={
                  index === messages.length - 1 && (msg.role === 'assistant' || msg.role === 'error')
                    ? onRetry
                    : null
                }
              />
            ))}

            {/* Typing / Loading Skeleton */}
            {isLoading && (
              <div className="message-row assistant-row loading-row">
                <div className="message-container">
                  <div className="avatar assistant-avatar pulse-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="message-bubble-wrapper">
                    <div className="message-header">
                      <span className="sender-name">AI Assistant</span>
                    </div>
                    <div className="message-bubble assistant-bubble loading-bubble">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="messages-end-anchor" />
          </div>
        )}
      </main>

      {/* Fixed Bottom Input Area */}
      <footer className="chat-footer">
        <MessageInput
          input={input}
          setInput={setInput}
          onSend={onSend}
          isLoading={isLoading}
          disabled={awaitingFeedback}
          placeholder={
            awaitingFeedback
              ? '⭐ Please rate the response above before continuing...'
              : 'Write your prompt... (Enter to send, Shift+Enter for new line)'
          }
        />
      </footer>
    </div>
  );
}
