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
// TOOL CREATION - Updated for new ElevenLabs API format
// =============================================================================

function buildToolConfig(
  name: string,
  description: string,
  webhookUrl: string,
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>
) {
  return {
    type: 'webhook',
    name,
    description,
    webhook: {
      url: webhookUrl,
      method: 'POST',
      // New API format uses 'api_schema' not 'request_body_schema'
      api_schema: {
        type: 'object',
        description: `Parameters for ${name}`,
        properties: Object.fromEntries(
          parameters.map(p => [
            p.name,
            {
              type: p.type,
              description: p.description,
            },
          ])
        ),
        required: parameters.filter(p => p.required).map(p => p.name),
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
      [
        { name: 'tool_name', type: 'string', description: 'Tool identifier (always "recall_memory")', required: true },
        { name: 'query', type: 'string', description: 'What to search for in memory', required: true },
        { name: 'memory_type', type: 'string', description: 'Type: preference, context, goal, decision, followup, or all', required: false },
      ]
    ),
    buildToolConfig(
      'save_memory',
      'Save something important about this user to remember for future conversations',
      toolsUrl,
      [
        { name: 'tool_name', type: 'string', description: 'Tool identifier (always "save_memory")', required: true },
        { name: 'content', type: 'string', description: 'The information to remember', required: true },
        { name: 'memory_type', type: 'string', description: 'Type: preference, context, goal, decision, followup, correction, or insight', required: true },
        { name: 'importance', type: 'number', description: 'Importance 1-10, higher = more important', required: false },
      ]
    ),
  ];

  const toolIds: string[] = [];

  for (const toolConfig of toolConfigs) {
    try {
      const res = await fetch(`${BASE_URL}/convai/tools/create`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toolConfig),
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
        model_id: 'eleven_flash_v2',  // Changed to flash_v2 which is explicitly supported
        voice_id: KIRA_VOICE_ID,
      },
      // FIX: Don't include ASR config at all - let ElevenLabs use defaults
      // The error happens when we include partial ASR config
      turn: {
        mode: 'turn',
        turn_timeout: 15,
      },
      conversation: {
        max_duration_seconds: 3600,
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