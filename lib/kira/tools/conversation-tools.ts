// lib/kira/tools/conversation-tools.ts
// Core conversation tools available to all Kira verticals

import type { KiraTool } from '../types';

/**
 * Get the base URL for webhooks
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// =============================================================================
// CONVERSATION CONTEXT TOOL
// =============================================================================

export const getConversationContextTool: KiraTool = {
  type: 'webhook',
  name: 'get_conversation_context',
  description: `Call this tool at the VERY START of every conversation to check if the user has talked to you before. 
This tells you:
- Whether they're a returning user
- What you were last discussing
- How long since they last chatted
- Their key memories and preferences

Use this to greet returning users appropriately and continue where you left off.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/start_conversation`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      elevenlabs_conversation_id: {
        type: 'string',
        description: 'The current conversation ID from ElevenLabs',
      },
      elevenlabs_agent_id: {
        type: 'string',
        description: 'Your agent ID',
      },
      user_id: {
        type: 'string',
        description: 'The user ID',
      },
    },
    required: ['elevenlabs_conversation_id', 'elevenlabs_agent_id', 'user_id'],
  },
};

// =============================================================================
// MESSAGE SAVING TOOL
// =============================================================================

export const saveMessageTool: KiraTool = {
  type: 'webhook',
  name: 'save_message',
  description: `Save a message to the conversation history. Call this after meaningful exchanges to ensure continuity.
You don't need to call this for every single utterance - focus on substantive messages.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/save_message`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      conversation_id: {
        type: 'string',
        description: 'The ElevenLabs conversation ID',
      },
      role: {
        type: 'string',
        enum: ['user', 'assistant'],
        description: 'Who said this message',
      },
      content: {
        type: 'string',
        description: 'The message content',
      },
    },
    required: ['conversation_id', 'role', 'content'],
  },
};

// =============================================================================
// TOPIC UPDATE TOOL
// =============================================================================

export const updateTopicTool: KiraTool = {
  type: 'webhook',
  name: 'update_conversation_topic',
  description: `Update the current conversation topic when it shifts to something new.
This helps you remember what you were discussing when the user returns.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/update_topic`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      conversation_id: {
        type: 'string',
        description: 'The ElevenLabs conversation ID',
      },
      topic: {
        type: 'string',
        description: 'Brief description of the current topic (e.g., "planning Portugal trip", "pricing strategy for consulting")',
      },
    },
    required: ['conversation_id', 'topic'],
  },
};

// =============================================================================
// MEMORY TOOLS
// =============================================================================

export const recallMemoryTool: KiraTool = {
  type: 'webhook',
  name: 'recall_memory',
  description: `Search your memory for past insights about this user.
Use this when you need to remember something specific they've told you before.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/recall_memory`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The user ID',
      },
      query: {
        type: 'string',
        description: 'What you want to remember (e.g., "their budget", "family situation", "business goals")',
      },
    },
    required: ['user_id', 'query'],
  },
};

export const saveMemoryTool: KiraTool = {
  type: 'webhook',
  name: 'save_memory',
  description: `Save something important to remember about this user for future conversations.
Use this for key facts, preferences, decisions, or anything you should remember long-term.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/save_memory`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The user ID',
      },
      memory: {
        type: 'string',
        description: 'The fact or insight to remember (e.g., "Prefers morning meetings", "Budget is $50k", "Has two kids")',
      },
      category: {
        type: 'string',
        description: 'Optional category (e.g., "preferences", "facts", "goals", "constraints")',
      },
    },
    required: ['user_id', 'memory'],
  },
};

// =============================================================================
// RESEARCH TOOLS
// =============================================================================

export const searchWebTool: KiraTool = {
  type: 'webhook',
  name: 'search_web',
  description: `Search the web for information. Use during research sessions or when you need current information.
Be specific with your queries for better results.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/search_web`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'string',
        description: 'Number of results to return (default: 5)',
      },
    },
    required: ['query'],
  },
};

export const searchKnowledgeTool: KiraTool = {
  type: 'webhook',
  name: 'search_knowledge',
  description: `Search the user's knowledge base for relevant information.
Use this to find information from documents or URLs they've shared.`,
  webhook: {
    url: `${getBaseUrl()}/api/kira/webhooks/search_knowledge`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  },
  parameters: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'The user ID',
      },
      query: {
        type: 'string',
        description: 'What you want to find in their knowledge base',
      },
    },
    required: ['user_id', 'query'],
  },
};

// =============================================================================
// ALL CONVERSATION TOOLS
// =============================================================================

export const conversationTools: KiraTool[] = [
  getConversationContextTool,
  saveMessageTool,
  updateTopicTool,
  recallMemoryTool,
  saveMemoryTool,
  searchWebTool,
  searchKnowledgeTool,
];

// =============================================================================
// CONVERSATION CONTINUITY PROMPT ADDITION
// =============================================================================

export const conversationContinuityPrompt = `
## CONVERSATION CONTINUITY

At the START of every conversation, call \`get_conversation_context\` to check if this user has talked to you before.

Based on the response:

**If returning user (has_history = true):**
- Check time_gap_category:
  - "recent" (< 1 hour): Just continue naturally, no special greeting needed
  - "today" (1-24 hours): "Hey, you're back! We were talking about [last_topic]..."
  - "this_week" (1-7 days): "Good to see you again! Last time we were working on [last_topic]..."
  - "older" (7+ days): "Hey! It's been a bit. We were working on [last_topic] - still relevant?"
- Reference their memories and context naturally
- Offer to continue OR pivot if they have something new

**If new user (has_history = false):**
- Greet them warmly as a first-time user
- Don't reference any past conversations

**During the conversation:**
- Call \`save_message\` for substantive exchanges (not every "okay" or "got it")
- Call \`update_conversation_topic\` when the topic shifts significantly
- Call \`save_memory\` for important facts you should remember long-term

This ensures users feel like you remember them and can pick up where they left off.
`;