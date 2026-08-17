import axios from 'axios';
import { logCompleteInteraction } from './supabase';
import { trackResponseReceived } from './telemetry';

// Default model configured for the experiment
export const DEFAULT_EXPERIMENT_MODEL =
  process.env.REACT_APP_DEFAULT_MODEL ||
  process.env.REACT_APP_MODEL ||
  'gemini-3.5-flash-lite';

// Get API Key from UI settings or .env (supports Gemini or OpenAI keys)
export const getApiKey = () => {
  const customKey = localStorage.getItem('aiviz_api_key') || localStorage.getItem('aiviz_openai_api_key');
  return (
    customKey ||
    process.env.REACT_APP_AI_API_KEY ||
    process.env.REACT_APP_API_KEY ||
    process.env.REACT_APP_GEMINI_API_KEY ||
    process.env.REACT_APP_OPENAI_API_KEY ||
    ''
  );
};

// Get API Endpoint URL
export const getApiEndpoint = () => {
  const customEndpoint = localStorage.getItem('aiviz_api_endpoint');
  if (customEndpoint && customEndpoint.startsWith('http')) {
    return customEndpoint.endsWith('/chat/completions')
      ? customEndpoint
      : `${customEndpoint.replace(/\/$/, '')}/chat/completions`;
  }

  const envBase = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_BASE_URL;
  if (envBase && envBase.startsWith('http')) {
    return envBase.endsWith('/chat/completions')
      ? envBase
      : `${envBase.replace(/\/$/, '')}/chat/completions`;
  }

  const key = getApiKey();
  if (key.startsWith('sk-')) {
    return 'https://api.openai.com/v1/chat/completions';
  }

  // Default to Gemini OpenAI Compatibility Endpoint
  return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
};

/**
 * Send chat messages to OpenAI-compatible endpoint (Gemini / OpenAI)
 * Logs interaction to Supabase and telemetry.
 * No mock/demo fallback — always calls the real API.
 */
export const sendChatMessage = async ({
  messages,
  model = DEFAULT_EXPERIMENT_MODEL,
  chatId,
  chatTitle,
  userId = null,
  userEmail = null,
  draftingDurationMs = null,
  systemPrompt = 'You are an expert AI Assistant specialized in Conceptual Modeling, Systems Analysis, and Software Engineering. Help the user structure domain models, entity relationships, and architectural representations cleanly and accurately. Avoid disclosing your underlying model name or version.',
}) => {
  const apiKey = getApiKey();
  const endpoint = getApiEndpoint();
  const startTime = Date.now();

  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key to the .env file or via Settings (⚙️).');
  }

  // Format messages payload for OpenAI-compatible API
  // Filter out any error/system messages before sending
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
  ];

  try {
    const response = await axios.post(
      endpoint,
      {
        model: model,
        messages: formattedMessages,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const latencyMs = Date.now() - startTime;
    const choice = response.data?.choices?.[0];
    const totalTokens = response.data?.usage?.total_tokens || null;

    if (!choice || !choice.message) {
      throw new Error('Received an empty response from AI.');
    }

    // Do NOT attach model name to assistantMsg — blind study protocol
    const assistantMsg = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: choice.message.content,
      timestamp: new Date().toISOString(),
      tokens: totalTokens,
    };

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

    // Log to chats & messages tables (non-blocking)
    if (chatId) {
      logCompleteInteraction({
        chatId,
        chatTitle,
        model,
        userMessage: lastUserMsg,
        assistantMessage: assistantMsg,
        userId,
      }).catch((err) => console.warn('Supabase logging error:', err));
    }

    // Log telemetry event (non-blocking)
    trackResponseReceived({
      response: choice.message.content,
      latencyMs,
      tokens: totalTokens,
      actualModel: model, // Secret — logged for researcher only
      chatId,
      user: { id: userId, email: userEmail },
    }).catch((err) => console.warn('Telemetry logging error:', err));

    return {
      message: assistantMsg,
      usage: response.data.usage,
    };
  } catch (error) {
    let errorMessage = 'Failed to get response from AI. Please try again.';

    if (error.response) {
      const status = error.response.status;
      const apiError = error.response.data?.error?.message;

      if (status === 401 || status === 403) {
        errorMessage = 'Invalid API Key. Please verify your Gemini / OpenAI API key in Settings (⚙️).';
      } else if (status === 429) {
        errorMessage = 'Rate limit reached or quota exceeded. Please try again in a moment.';
      } else if (status === 400) {
        errorMessage = `Bad Request: ${apiError || 'Invalid request parameters.'}`;
      } else if (status === 404) {
        errorMessage = `Model not found: "${model}". Please check the model name in Settings (⚙️).`;
      } else if (apiError) {
        errorMessage = apiError;
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please check your network connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    const customError = new Error(errorMessage);
    customError.originalError = error;
    throw customError;
  }
};
