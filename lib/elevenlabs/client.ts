// lib/elevenlabs/client.ts
// ElevenLabs Conversational AI client for Kira

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const BASE_URL = 'https://api.elevenlabs.io/v1';

// Kira's voice - warm, friendly female voice
const KIRA_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - warm and friendly

// =============================================================================
// TYPES
// =============================================================================

interface CreateAgentParams {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  toolIds?: string[];
  webhookUrl?: string;
}

interface ConversationAgent {
  agent_id: string;
  name: string;
}

interface Tool {
  id: string;
  name: string;
}

// =============================================================================
// API HELPERS
// =============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${text}`);
  }

  return res.json();
}

// =============================================================================
// TOOL CREATION
// =============================================================================

function buildToolConfig(
  name: string,
  description: string,
  webhookUrl: string,
  properties: Record<string, unknown>
) {
  return {
    type: 'webhook',
    name,
    description,
    params: {
      method: 'POST',
      url: webhookUrl,
      request_body_schema: {
        type: 'object',
        description: `Parameters for ${name}`,
        properties: {
          tool_name: {
            type: 'string',
            description: 'Tool identifier',
            value_type: 'constant',
            constant: name,
            required: true,
          },
          ...properties,
        },
        required: ['tool_name', ...Object.keys(properties).filter(k => (properties[k] as Record<string, unknown>).required)],
      },
    },
  };
}

export async function createKiraTools(webhookUrl: string): Promise<string[]> {
  const toolsUrl = `${webhookUrl}/api/kira/tools`;

  const toolConfigs = [
    buildToolConfig(
      'recall_memory',
      "Search Kira's memory for past context about this user - preferences, goals, decisions, and things they've shared",
      toolsUrl,
      {
        query: {
          type: 'string',
          description: 'What to search for in memory',
          value_type: 'llm_prompt',
          required: true,
        },
        memory_type: {
          type: 'string',
          description: 'Type: preference, context, goal, decision, followup, or all',
          value_type: 'llm_prompt',
          required: false,
        },
      }
    ),
    buildToolConfig(
      'save_memory',
      'Save something important about this user to remember for future conversations',
      toolsUrl,
      {
        content: {
          type: 'string',
          description: 'The information to remember',
          value_type: 'llm_prompt',
          required: true,
        },
        memory_type: {
          type: 'string',
          description: 'Type: preference, context, goal, decision, followup, correction, or insight',
          value_type: 'llm_prompt',
          required: true,
        },
        importance: {
          type: 'number',
          description: 'Importance 1-10, higher = more important',
          value_type: 'llm_prompt',
          required: false,
        },
      }
    ),
  ];

  const toolIds: string[] = [];

  for (const toolConfig of toolConfigs) {
    try {
      const res = await fetch(`${BASE_URL}/convai/tools`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool_config: toolConfig }),
      });

      if (res.ok) {
        const tool: Tool = await res.json();
        toolIds.push(tool.id);
        console.log(`[elevenlabs] Created tool: ${toolConfig.name} -> ${tool.id}`);
      } else {
        const errText = await res.text();
        console.warn(`[elevenlabs] Failed to create tool ${toolConfig.name}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[elevenlabs] Error creating tool ${toolConfig.name}:`, err);
    }
  }

  return toolIds;
}

// =============================================================================
// AGENT CREATION
// =============================================================================

export async function createKiraAgent(params: CreateAgentParams): Promise<ConversationAgent> {
  const agentConfig: Record<string, unknown> = {
    name: params.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: params.systemPrompt,
          ...(params.toolIds?.length ? { tool_ids: params.toolIds } : {}),
        },
        first_message: params.firstMessage,
        language: 'en',
      },
      tts: {
        model_id: 'eleven_turbo_v2_5',
        voice_id: KIRA_VOICE_ID,
      },
      // FIX: Explicit minimal ASR config - prevents ElevenLabs from injecting invalid defaults
      // English agents require this to avoid "must use turbo or flash v2" error
      asr: {
        user_input_audio_format: 'pcm_16000',
      },
      turn: {
        mode: 'turn',
        turn_timeout: 15, // Give users time to think
      },
      conversation: {
        max_duration_seconds: 3600, // 1 hour max
      },
    },
  };

  // Add webhook if provided
  if (params.webhookUrl) {
    agentConfig.platform_settings = {
      webhook: {
        url: `${params.webhookUrl}/api/kira/webhook`,
        secret: process.env.ELEVENLABS_WEBHOOK_SECRET || 'kira-webhook-secret',
      },
    };
  }

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