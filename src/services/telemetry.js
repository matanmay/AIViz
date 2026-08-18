import { getSupabaseClient } from './supabase';

/**
 * Core function to log an experiment interaction or telemetry event to Supabase
 */
export const logExperimentEvent = async ({
  eventType,
  eventData = {},
  user = null,
  chatId = null,
}) => {
  const timestamp = new Date().toISOString();
  const teamName = user?.team_name || user?.id || null;

  const logEntry = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    team_name: teamName,
    chat_id: chatId ? String(chatId) : null,
    event_type: eventType,
    event_data: eventData,
    created_at: timestamp,
  };

  // 1. Save locally for experiment resilience/backup in case of connection drop
  try {
    const existingLogs = JSON.parse(localStorage.getItem('aiviz_experiment_telemetry') || '[]');
    existingLogs.push(logEntry);
    // Keep last 1000 events in local cache to avoid memory bloating
    if (existingLogs.length > 1000) {
      existingLogs.shift();
    }
    localStorage.setItem('aiviz_experiment_telemetry', JSON.stringify(existingLogs));
  } catch (e) {
    console.warn('Could not store telemetry in localStorage', e);
  }

  // 2. Persist to Supabase experiment_logs table
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('experiment_logs').insert([
        {
          id: logEntry.id,
          team_name: teamName,
          chat_id: chatId ? String(chatId) : null,
          event_type: eventType,
          event_data: eventData,
          created_at: timestamp,
        },
      ]);

      if (error) {
        console.warn('Supabase experiment_logs insert error:', error.message);
      }
    } catch (err) {
      console.warn('Failed to send telemetry to Supabase:', err);
    }
  }

  return logEntry;
};

/* ==========================================================================
   Convenience Telemetry Tracking Helpers
   ========================================================================== */

/**
 * Track user sending a conceptual modeling prompt
 */
export const trackPromptSent = ({ prompt, draftingDurationMs, chatId, user }) => {
  return logExperimentEvent({
    eventType: 'prompt_sent',
    eventData: {
      prompt: prompt,
      prompt_length: prompt.length,
      word_count: prompt.trim().split(/\s+/).length,
      drafting_duration_ms: draftingDurationMs || null,
      drafting_duration_sec: draftingDurationMs ? Math.round(draftingDurationMs / 1000) : null,
    },
    chatId,
    user,
  });
};

/**
 * Track AI response received (records hidden model name and latency for researcher)
 */
export const trackResponseReceived = ({
  response,
  latencyMs,
  tokens,
  actualModel,
  chatId,
  user,
}) => {
  return logExperimentEvent({
    eventType: 'response_received',
    eventData: {
      response_text: response,
      response_length: response.length,
      latency_ms: latencyMs,
      tokens_total: tokens || null,
      secret_model: actualModel, // Preserved secretly for researcher
    },
    chatId,
    user,
  });
};

/**
 * Track student copying content from the interface
 */
export const trackCopyEvent = ({ content, contentType = 'text', language = null, chatId, user }) => {
  return logExperimentEvent({
    eventType: 'content_copied',
    eventData: {
      content_type: contentType,
      language: language,
      copied_length: content.length,
      copied_snippet: content.length > 500 ? content.substring(0, 500) + '...' : content,
    },
    chatId,
    user,
  });
};

/**
 * Track student clicking regenerate / retry
 */
export const trackRegenerateEvent = ({ chatId, user }) => {
  return logExperimentEvent({
    eventType: 'regenerate_requested',
    eventData: {
      action: 'regenerate_response',
    },
    chatId,
    user,
  });
};

/**
 * Track student clicking a starter / suggested prompt
 */
export const trackSuggestedPromptClicked = ({ promptTitle, promptText, chatId, user }) => {
  return logExperimentEvent({
    eventType: 'suggested_prompt_clicked',
    eventData: {
      prompt_title: promptTitle,
      prompt_text: promptText,
    },
    chatId,
    user,
  });
};

/**
 * Track chat session management actions
 */
export const trackChatEvent = ({ eventType, chatId, details = {}, user }) => {
  return logExperimentEvent({
    eventType,
    eventData: details,
    chatId,
    user,
  });
};

/**
 * Track student switching browser tabs / leaving the window
 */
export const trackTabVisibility = ({ isVisible, chatId, user }) => {
  return logExperimentEvent({
    eventType: isVisible ? 'tab_focus' : 'tab_blur',
    eventData: {
      window_visible: isVisible,
      action: isVisible ? 'returned_to_interface' : 'switched_away_from_interface',
    },
    chatId,
    user,
  });
};

/**
 * Track user login / logout
 */
export const trackAuthEvent = ({ eventType, user }) => {
  return logExperimentEvent({
    eventType,
    eventData: {
      team_name: user?.team_name || user?.id,
    },
    user,
  });
};
