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
          persistSession: false,
          autoRefreshToken: false,
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
   Custom Team-based Authentication (replaces Supabase Auth)
   ========================================================================== */

const SESSION_KEY = 'aiviz_team_session';

/**
 * Sign in with a team name / username and password.
 * Looks up the team in the `teams` table and compares password directly.
 * Also retrieves the team's designated LLM model.
 */
export const loginUser = async (teamName, password) => {
  const trimmedName = teamName.trim();
  const client = getSupabaseClient();

  if (!client) {
    throw new Error(
      'Supabase is not configured. Please add your credentials in the .env file.'
    );
  }

  try {
    const { data, error } = await client
      .from('teams')
      .select('team_name, password, model')
      .eq('team_name', trimmedName)
      .single();

    if (error || !data) {
      throw new Error('Team/User not found. Please check your group name or username.');
    }

    if (data.password !== password) {
      throw new Error('Invalid password. Please try again.');
    }

    // Build session object stored in localStorage
    const session = {
      team_name: data.team_name,
      username: data.team_name,
      id: data.team_name,
      email: data.team_name,
      model: data.model || 'gemini-3.5-flash-lite',
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { user: session, session: { user: session } };
  } catch (err) {
    const message =
      err.message || 'Login failed. Please check your credentials.';
    throw new Error(message);
  }
};

/**
 * Sign out current team/user
 */
export const logoutUser = async () => {
  localStorage.removeItem(SESSION_KEY);
  return true;
};

/**
 * Get current authenticated session from localStorage,
 * and refresh the designated model from Supabase if connected.
 */
export const getCurrentUser = async () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);

    const client = getSupabaseClient();
    const teamName = session.team_name || session.username || session.id;

    if (client && teamName) {
      try {
        const { data: teamRow } = await client
          .from('teams')
          .select('model')
          .eq('team_name', teamName)
          .single();

        if (teamRow?.model) {
          session.model = teamRow.model;
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      } catch {
        // Keep local cached session if network/db query fails
      }
    }

    return session;
  } catch {
    return null;
  }
};

/**
 * No-op subscription shim (auth changes are handled via localStorage)
 */
export const subscribeToAuthChanges = (_callback) => {
  return { unsubscribe: () => {} };
};

/* ==========================================================================
   Supabase Database / Logging Methods
   ========================================================================== */

/**
 * Save or update a chat session in Supabase
 */
export const syncChatToSupabase = async (chat, teamName = null) => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: chat.id,
      title: chat.title || 'New Conversation',
      updated_at: new Date().toISOString(),
    };

    if (teamName) {
      payload.team_name = teamName;
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
 * Log an individual message to Supabase — NOT used directly anymore.
 * Use logCompleteInteraction instead which stores prompt+response in one row.
 * Kept for backward compatibility.
 */
export const logMessageToSupabase = async (message, teamName = null) => {
  // No-op: interactions are now stored via logCompleteInteraction
  return null;
};

/**
 * Log a complete interaction (User query + Assistant response) as ONE row.
 * Uses the user message ID as the interaction row ID.
 * If the row already exists (user prompt saved first), upserts with response data.
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

  // userId carries the team_name (aliased for backward compat)
  const teamName = userId;

  try {
    // 1. Ensure chat session exists/is updated
    await syncChatToSupabase(
      { id: chatId, title: chatTitle, model },
      teamName
    );

    if (!userMessage) return false;

    // 2. Upsert a single interaction row: prompt + response
    const payload = {
      id: String(userMessage.id),
      chat_id: chatId,
      prompt: userMessage.content,
      prompt_at: userMessage.timestamp || new Date().toISOString(),
      status: 'completed',
      created_at: userMessage.timestamp || new Date().toISOString(),
    };

    if (teamName) payload.team_name = teamName;

    if (assistantMessage) {
      payload.response = assistantMessage.content;
      payload.response_at = assistantMessage.timestamp || new Date().toISOString();
      payload.tokens = assistantMessage.tokens || null;
    }

    const { error } = await client
      .from('messages')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase interaction log error:', error.message, error.details);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to log complete interaction to Supabase:', err);
    return false;
  }
};

/**
 * Fetch all chat sessions for the authenticated team
 */
export const fetchChatsFromSupabase = async (teamName = null) => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let query = client
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (teamName) {
      query = query.eq('team_name', teamName);
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
 * Fetch messages for a specific chat from Supabase.
 * Each DB row is one interaction (prompt + response);
 * we expand it back into two message objects for the UI.
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

    // Expand each interaction row into a pair of message objects
    const expanded = [];
    for (const row of data) {
      expanded.push({
        id: row.id,
        role: 'user',
        content: row.prompt,
        timestamp: row.prompt_at || row.created_at,
        tokens: null,
      });
      if (row.response) {
        expanded.push({
          id: `${row.id}-response`,
          role: 'assistant',
          content: row.response,
          timestamp: row.response_at || row.created_at,
          tokens: row.tokens,
          // Restore rating and interaction reference from DB
          userRating: row.feedback_rating ?? null,
          interactionId: row.id,
        });
      }
    }
    return expanded;
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
 * Clear all chat history for the team
 */
export const clearAllChatsFromSupabase = async (teamName = null) => {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    let query = client.from('chats').delete();
    if (teamName) {
      query = query.eq('team_name', teamName);
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

/**
 * Update a message row with the user's helpfulness feedback rating (1–5).
 * interactionId is the user message's ID, which is the DB row ID in the
 * messages table (one row per prompt+response interaction).
 */
export const updateMessageFeedback = async ({ interactionId, rating }) => {
  const client = getSupabaseClient();
  if (!client) return false;

  if (!interactionId) {
    console.warn('updateMessageFeedback: no interactionId provided, skipping DB update');
    return false;
  }

  try {
    const { error } = await client
      .from('messages')
      .update({
        feedback_rating: rating,
        feedback_at: new Date().toISOString(),
      })
      .eq('id', interactionId);

    if (error) {
      console.warn('Supabase feedback update error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to save feedback rating to Supabase:', err);
    return false;
  }
};

/**
 * Update the response content for a message row when PlantUML / content is edited.
 */
export const updateMessageResponse = async ({ interactionId, response }) => {
  const client = getSupabaseClient();
  if (!client) return false;

  if (!interactionId) {
    console.warn('updateMessageResponse: no interactionId provided, skipping DB update');
    return false;
  }

  try {
    const { error } = await client
      .from('messages')
      .update({
        response,
        response_at: new Date().toISOString(),
      })
      .eq('id', interactionId);

    if (error) {
      console.warn('Supabase message update error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to update message response in Supabase:', err);
    return false;
  }
};

/**
 * Update a team/user's assigned LLM model in the database
 */
export const updateTeamModel = async (teamName, newModel) => {
  const client = getSupabaseClient();
  if (!client || !teamName || !newModel) return false;

  try {
    const { error } = await client
      .from('teams')
      .update({ model: newModel })
      .eq('team_name', teamName);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Failed to update team model:', err);
    return false;
  }
};

// Alias for backward compatibility
export const updateUserModel = updateTeamModel;

/**
 * Fetch all registered teams/users and their assigned models
 */
export const fetchAllTeams = async () => {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data: teams, error } = await client
      .from('teams')
      .select('team_name, model, created_at')
      .order('team_name', { ascending: true });

    if (error) throw error;

    return (teams || []).map((t) => ({
      team_name: t.team_name,
      username: t.team_name,
      model: t.model || 'gemini-3.5-flash-lite',
      created_at: t.created_at,
    }));
  } catch (err) {
    console.warn('Failed to fetch teams:', err);
    return [];
  }
};

// Alias for backward compatibility
export const fetchAllUsers = fetchAllTeams;
