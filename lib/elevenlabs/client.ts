// lib/elevenlabs/client.ts
// ElevenLabs ConvAI client – CORRECT schema

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  throw new Error('Missing ELEVENLABS_API_KEY');
}

const BASE_URL = 'https://api.elevenlabs.io/v1';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateConvAIAgentParams {
  name: string;
  systemPrompt: string;
  firstMessage: string;
  toolIds?: string[];
  webhookUrl?: string;
}

export interface ConvAIAgent {
  agent_id: string;
}

/* -------------------------------------------------------------------------- */
/* Create ConvAI Agent (FIXED)                                                */
/* -------------------------------------------------------------------------- */

export async function createKiraAgent(
  params: CreateConvAIAgentParams
): Promise<ConvAIAgent> {
  const res = await fetch(`${BASE_URL}/convai/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify({
      name: params.name,

      conversation_config: {
        system_prompt: params.systemPrompt,
        first_message: params.firstMessage,
        tools: (params.toolIds ?? []).map((id) => ({
          tool_id: id,
        })),
      },

      webhooks: params.webhookUrl
        ? {
            conversation_start: `${params.webhookUrl}/api/webhooks/elevenlabs-router`,
            message: `${params.webhookUrl}/api/webhooks/elevenlabs-router`,
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[ElevenLabs] create agent failed:', err);
    throw new Error('Failed to create ElevenLabs ConvAI agent');
  }

  const data = await res.json();

  if (!data.agent_id) {
    throw new Error('ElevenLabs response missing agent_id');
  }

  return { agent_id: data.agent_id };
}

/* -------------------------------------------------------------------------- */
/* Tool creation (leave as-is if unused)                                      */
/* -------------------------------------------------------------------------- */

export async function createKiraTools(_appUrl: string): Promise<string[]> {
  return [];
}
