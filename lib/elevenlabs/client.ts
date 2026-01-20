// lib/elevenlabs/client.ts
// ElevenLabs ConvAI client – REAL agent creation only

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
/* Create ConvAI Agent (THIS IS THE FIX)                                      */
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
      language: 'en',
      model: 'eleven_multilingual_v2',
      voice_id: 'EXAVITQu4vr4xnSDxMaL',

      prompt: {
        system: params.systemPrompt,
        first_message: params.firstMessage,
      },

      tools: params.toolIds ?? [],
      webhook_url: params.webhookUrl,
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

  return {
    agent_id: data.agent_id,
  };
}

/* -------------------------------------------------------------------------- */
/* Tool creation (unchanged unless you want to revisit later)                */
/* -------------------------------------------------------------------------- */

export async function createKiraTools(appUrl: string): Promise<string[]> {
  // If tools already work in interviews, LEAVE THIS AS IS.
  // Do not touch unless tools are broken.
  return [];
}
