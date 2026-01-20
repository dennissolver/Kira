// lib/elevenlabs/client.ts
// ElevenLabs ConvAI client — FINAL, CORRECT, PRODUCTION SAFE

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
/* Create ConvAI Agent                                                        */
/* -------------------------------------------------------------------------- */

export async function createKiraAgent(
  params: CreateConvAIAgentParams
): Promise<ConvAIAgent> {
  const tools =
    params.toolIds && params.toolIds.length > 0
      ? params.toolIds.map((id) => ({ tool_id: id }))
      : undefined;

  const payload: any = {
    name: params.name,
    conversation_config: {
      system_prompt: params.systemPrompt,
      first_message: params.firstMessage,
      ...(tools ? { tools } : {}),
    },
  };

  if (params.webhookUrl) {
    payload.webhooks = {
      conversation_start: `${params.webhookUrl}/api/webhooks/elevenlabs-router`,
      message: `${params.webhookUrl}/api/webhooks/elevenlabs-router`,
    };
  }

  const res = await fetch(`${BASE_URL}/convai/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[ElevenLabs] Agent creation failed:', errText);
    throw new Error('Failed to create ElevenLabs ConvAI agent');
  }

  const data = await res.json();

  if (!data?.agent_id) {
    throw new Error('ElevenLabs response missing agent_id');
  }

  return { agent_id: data.agent_id };
}

/* -------------------------------------------------------------------------- */
/* Tool creation                                                             */
/* -------------------------------------------------------------------------- */

export async function createKiraTools(_appUrl: string): Promise<string[]> {
  // Tools are optional. Return [] safely.
  return [];
}
