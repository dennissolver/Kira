// lib/elevenlabs/client.ts
// ElevenLabs Conversational AI client for Kira
// FIXED: Added explicit ASR model to avoid "English Agents must use turbo or flash v2" error

const BASE_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const KIRA_VOICE_ID = process.env.KIRA_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice

// =============================================================================
// TYPES
// =============================================================================

interface Tool {
  id: string;
  name: string;
}

interface ConversationAgent {
  agent_id: string;
  name: string;
}

interface CreateAgentParams {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  toolIds?: string[];
  webhookUrl?: string;
}

// =============================================================================
// API HELPER
// =============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${errText}`);
  }

  return res.json();
}

// =============================================================================
// TOOL CREATION - Skip for now to simplify
// =============================================================================

export async function createKiraTools(webhookUrl: string): Promise<string[]> {
  // Skip tool creation for now - let's just get the agent working first
  console.log(`[elevenlabs] Skipping tool creation for now`);
  return [];
}

// =============================================================================
// AGENT CREATION - FIXED WITH ASR MODEL
// =============================================================================

export async function createKiraAgent(params: CreateAgentParams): Promise<ConversationAgent> {
  const agentConfig = {
    name: params.name,
    conversation_config: {
      // FIX: Explicitly set ASR model for English agents
      asr: {
        provider: 'elevenlabs',
        model_id: 'eleven_turbo_v2',  // Required for English agents
        user_input_audio_format: 'pcm_16000',
      },
      agent: {
        prompt: {
          prompt: params.systemPrompt,
          llm: 'gpt-4o-mini',
          temperature: 0.7,
        },
        first_message: params.firstMessage,
        language: 'en',
      },
      tts: {
        model_id: 'eleven_turbo_v2_5',  // TTS model (different from ASR)
        voice_id: KIRA_VOICE_ID,
      },
    },
  };

  console.log('[elevenlabs] Creating agent with config:', JSON.stringify(agentConfig, null, 2));

  return apiRequest<ConversationAgent>('/convai/agents/create', {
    method: 'POST',
    body: JSON.stringify(agentConfig),
  });
}

// =============================================================================
// AGENT MANAGEMENT
// =============================================================================

export async function getAgent(agentId: string): Promise<ConversationAgent | null> {
  try {
    return await apiRequest<ConversationAgent>(`/convai/agents/${agentId}`);
  } catch {
    return null;
  }
}

export async function deleteAgent(agentId: string): Promise<boolean> {
  try {
    await apiRequest(`/convai/agents/${agentId}`, { method: 'DELETE' });
    return true;
  } catch {
    return false;
  }
}

export async function updateAgentPrompt(
  agentId: string,
  systemPrompt: string
): Promise<boolean> {
  try {
    await apiRequest(`/convai/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: { prompt: systemPrompt },
          },
        },
      }),
    });
    return true;
  } catch (err) {
    console.error('[elevenlabs] Failed to update agent prompt:', err);
    return false;
  }
}

// =============================================================================
// CONVERSATION MANAGEMENT
// =============================================================================

export async function getSignedUrl(agentId: string): Promise<string> {
  const response = await apiRequest<{ signed_url: string }>(
    `/convai/conversation/get_signed_url?agent_id=${agentId}`
  );
  return response.signed_url;
}

export async function getConversation(conversationId: string): Promise<unknown> {
  return apiRequest(`/convai/conversations/${conversationId}`);
}