import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from localStorage (if configured via UI) or environment variables
export const getSupabaseCredentials = () => {
  const customUrl = localStorage.getItem('aiviz_supabase_url');
  const customKey = localStorage.getItem('aiviz_supabase_anon_key');

  const supabaseUrl = customUrl || process.env.REACT_APP_SUPABASE_URL || '';
  const supabaseAnonKey = customKey || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  return { supabaseUrl, supabaseAnonKey };
};

// Check if valid credentials exist
export const isSupabaseConfigured = () => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project')
  );
};

// Create Supabase client dynamically
let supabaseInstance = null;
let lastUsedConfig = '';

export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    return null;
  }

  const currentConfigKey = `${supabaseUrl}_${supabaseAnonKey}`;
  if (!supabaseInstance || lastUsedConfig !== currentConfigKey) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      lastUsedConfig = currentConfigKey;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
};

/* ==========================================================================
   Supabase Authentication Methods
   ========================================================================== */

/**
 * Sign in user with Email & Password against Supabase Auth
 */
export const loginUser = async (email, password) => {
  const client = getSupabaseClient();

  // If Supabase is not configured yet, check for local demo credentials
  if (!client) {
    // Local demo mode fallback
    // Demo user gets a stable valid UUID so FK constraints don't fail
if (
      (email.toLowerCase() === 'admin@aiviz.ai' || email.toLowerCase() === 'user@aiviz.ai') &&
      password === 'admin123'
    ) {
      const demoUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: email.toLowerCase(),
        user_metadata: { name: email.split('@')[0] },
      };
      localStorage.setItem('aiviz_demo_user', JSON.stringify(demoUser));
      return { user: demoUser, session: { user: demoUser } };
    }
    throw new Error('Supabase is not configured. Please add your credentials in Settings or use demo: admin@aiviz.ai / admin123');
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    let message = error.message || 'Login failed. Please try again.';
    if (message.includes('Invalid login credentials')) {
      message = 'Invalid email or password. Please verify your credentials.';
    } else if (message.includes('Email not confirmed')) {
      message = 'Your email address has not been confirmed yet.';
    }
    throw new Error(message);
  }
};

/**
 * Sign out current user
 */
export const logoutUser = async () => {
  const client = getSupabaseClient();
  localStorage.removeItem('aiviz_demo_user');

  if (client) {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn('Error signing out of Supabase:', err);
    }
  }
  return true;
};

/**
 * Get current authenticated user session
 */
export const getCurrentUser = async () => {
  // Check demo user in localStorage first
  const savedDemo = localStorage.getItem('aiviz_demo_user');
  if (savedDemo) {
    try {
      return JSON.parse(savedDemo);
    } catch (e) {}
  }

  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;
    return session.user;
  } catch (err) {
    console.warn('Error getting session:', err);
    return null;
  }
};

/**
 * Subscribe to Supabase Auth state changes
 */
export const subscribeToAuthChanges = (callback) => {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };

  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });

  return subscription;
};

/* ==========================================================================
   Supabase Database / Logging Methods
   ========================================================================== */

/**
 * Save or update a chat session in Supabase
 */
export const syncChatToSupabase = async (chat, userId = null) => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: chat.id,
      title: chat.title || 'New Conversation',
      updated_at: new Date().toISOString(),
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await client
      .from('chats')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Supabase chat sync error:', error.message, error.details);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Error syncing chat to Supabase:', err);
    return null;
  }
};

/**
 * Log an individual message to Supabase
 */
export const logMessageToSupabase = async (message, userId = null) => {
  const client = getSupabaseClient();
  if (!client) return null;

  // Ensure chat_id is a valid UUID (not null)
  if (!message.chatId && !message.chat_id) {
    console.warn('logMessageToSupabase: missing chatId, skipping.');
    return null;
  }

  try {
    const payload = {
      id: String(message.id),           // TEXT primary key
      chat_id: message.chatId || message.chat_id,
      role: message.role,
      content: message.content,
      tokens: message.tokens || null,
      status: message.status || 'completed',
      created_at: message.timestamp || new Date().toISOString(),
    };

    if (userId) {
      payload.user_id = userId;
    }

    const { data, error } = await client
      .from('messages')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Supabase message log error:', error.message, error.details);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Error logging message to Supabase:', err);
    return null;
  }
};

/**
 * Log a complete interaction (User query + Assistant response)
 */
export const logCompleteInteraction = async ({
  chatId,
  chatTitle,
  model,
  userMessage,
  assistantMessage,
  userId = null,
}) => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // 1. Ensure chat session exists/is updated
    await syncChatToSupabase({
      id: chatId,
      title: chatTitle,
      model: model,
    }, userId);

    // 2. Log user message if provided
    if (userMessage) {
      await logMessageToSupabase({
        ...userMessage,
        chatId,
      }, userId);
    }

    // 3. Log assistant message
    if (assistantMessage) {
      await logMessageToSupabase({
        ...assistantMessage,
        chatId,
        model,
      }, userId);
    }

    return true;
  } catch (err) {
    console.warn('Failed to log complete interaction to Supabase:', err);
    return false;
  }
};

/**
 * Fetch all chat sessions for the authenticated user
 */
export const fetchChatsFromSupabase = async (userId = null) => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let query = client
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Error fetching chats from Supabase:', err.message);
    return null;
  }
};

/**
 * Fetch messages for a specific chat from Supabase
 */
export const fetchMessagesFromSupabase = async (chatId) => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Error fetching messages from Supabase:', err.message);
    return null;
  }
};

/**
 * Delete a single chat and cascade delete its messages
 */
export const deleteChatFromSupabase = async (chatId) => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error deleting chat from Supabase:', err.message);
    return false;
  }
};

/**
 * Clear all chat history for the user
 */
export const clearAllChatsFromSupabase = async (userId = null) => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    let query = client.from('chats').delete();
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error clearing chats from Supabase:', err.message);
    return false;
  }
};
