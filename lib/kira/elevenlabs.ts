
// lib/kira/elevenlabs.ts
// ElevenLabs Conversational AI integration

import type {
  KiraBaseConfig,
  KiraVerticalConfig,
  KiraContext,
  KiraFramework,
  KiraKnowledge,
  ElevenLabsAgentConfig,
  KiraTool
} from './types';
import { buildSystemPrompt, buildFirstMessage, generateAgentName } from './prompt-builder';

// =============================================================================
// AGENT CREATION
// =============================================================================

interface CreateAgentOptions {
  baseConfig: KiraBaseConfig;
  verticalConfig: KiraVerticalConfig;
  context: KiraContext;
  framework?: KiraFramework;
  knowledge?: KiraKnowledge;
  existingMemory?: string[];
}

/**
 * Create an ElevenLabs Conversational AI agent
 */
export async function createElevenLabsAgent(
  apiKey: string,
  options: CreateAgentOptions
): Promise<{ agentId: string; agentName: string }> {
  const { baseConfig, verticalConfig, context, framework, knowledge, existingMemory } = options;

  // Build the prompts
  const systemPrompt = buildSystemPrompt({
    config: verticalConfig,
    context,
    framework,
    knowledge,
    existingMemory,
  });

  const firstMessage = buildFirstMessage({
    config: verticalConfig,
    context,
    framework,
  });

  // Generate unique agent name
  const agentName = generateAgentName(
    verticalConfig.verticalId,
    framework?.firstName || context.firstName || 'User',
    framework?.primaryObjective || verticalConfig.displayName,
    crypto.randomUUID()
  );

  // Build the ElevenLabs config
  const agentConfig: ElevenLabsAgentConfig = {
    name: agentName,
    conversation_config: {
      agent: {
        prompt: {
          prompt: systemPrompt,
          llm: baseConfig.llmModel || 'gpt-4o-mini',
          temperature: baseConfig.temperature || 0.7,
        },
        first_message: firstMessage,
        language: 'en',
      },
      tts: {
        voice_id: baseConfig.voiceId,
        model_id: baseConfig.voiceModel || 'eleven_turbo_v2_5',
      },
    },
    platform_settings: {
      webhook: {
        url: baseConfig.webhookUrl,
        events: baseConfig.webhookEvents || ['conversation.transcript', 'conversation.ended'],
      },
    },
  };

  // Add tools if defined
  if (verticalConfig.tools.length > 0) {
    (agentConfig as any).conversation_config.agent.tools = convertToolsToElevenLabsFormat(
      verticalConfig.tools,
      baseConfig.webhookUrl
    );
  }

  // Create the agent via ElevenLabs API
  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(agentConfig),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs agent creation failed: ${response.status} ${error}`);
  }

  const result = await response.json();

  return {
    agentId: result.agent_id,
    agentName,
  };
}

/**
 * Update an existing ElevenLabs agent
 */
export async function updateElevenLabsAgent(
  apiKey: string,
  agentId: string,
  options: Partial<CreateAgentOptions>
): Promise<void> {
  const { verticalConfig, context, framework, knowledge, existingMemory, baseConfig } = options;

  const updates: Record<string, unknown> = {};

  // Rebuild prompt if context changed
  if (verticalConfig && context) {
    const systemPrompt = buildSystemPrompt({
      config: verticalConfig,
      context,
      framework,
      knowledge,
      existingMemory,
    });

    updates.conversation_config = {
      agent: {
        prompt: {
          prompt: systemPrompt,
          llm: baseConfig?.llmModel || 'gpt-4o-mini',
          temperature: baseConfig?.temperature || 0.7,
        },
      },
    };
  }

  if (Object.keys(updates).length === 0) return;

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs agent update failed: ${response.status} ${error}`);
  }
}

/**
 * Delete an ElevenLabs agent
 */
export async function deleteElevenLabsAgent(
  apiKey: string,
  agentId: string
): Promise<void> {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs agent deletion failed: ${response.status} ${error}`);
  }
}

/**
 * Get agent details from ElevenLabs
 */
export async function getElevenLabsAgent(
  apiKey: string,
  agentId: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs agent fetch failed: ${response.status} ${error}`);
  }

  return response.json();
}

// =============================================================================
// TOOL CONVERSION
// =============================================================================

/**
 * Convert Kira tools to ElevenLabs format
 */
function convertToolsToElevenLabsFormat(
  tools: KiraTool[],
  baseWebhookUrl: string
): unknown[] {
  return tools
    .filter(tool => tool.type === 'webhook')
    .map(tool => ({
      type: 'webhook',
      name: tool.name,
      description: tool.description,
      webhook: {
        url: tool.webhook?.url || `${baseWebhookUrl.replace(/\/webhook$/, '')}/tools/${tool.name}`,
        method: tool.webhook?.method || 'POST',
        headers: tool.webhook?.headers || { 'Content-Type': 'application/json' },
      },
      parameters: tool.parameters,
    }));
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

export interface WebhookEvent {
  type: 'conversation.started' | 'conversation.transcript' | 'conversation.ended';
  conversation_id: string;
  agent_id: string;
  data: {
    transcript?: string;
    messages?: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    duration_seconds?: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Parse and validate an ElevenLabs webhook payload
 */
export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  if (!body || typeof body !== 'object') return null;

  const event = body as Record<string, unknown>;

  if (!event.type || !event.conversation_id || !event.agent_id) {
    return null;
  }

  return {
    type: event.type as WebhookEvent['type'],
    conversation_id: event.conversation_id as string,
    agent_id: event.agent_id as string,
    data: (event.data || {}) as WebhookEvent['data'],
  };
}

// =============================================================================
// CONVERSATION HISTORY
// =============================================================================

/**
 * Get conversation history from ElevenLabs
 */
export async function getConversationHistory(
  apiKey: string,
  conversationId: string
): Promise<Array<{ role: string; content: string; timestamp: string }>> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      headers: {
        'xi-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch conversation: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.messages || [];
}