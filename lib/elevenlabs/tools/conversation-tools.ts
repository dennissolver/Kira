// lib/elevenlabs/tools/conversation-tools.ts
// Tool definitions for ElevenLabs agents to manage conversation continuity

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Tool: get_conversation_context
 * Called at the START of each conversation to check if user is returning
 * Returns: history, last topic, time gap, memories
 */
export const getConversationContextTool = {
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
    url: `${APP_URL}/api/kira/webhooks/start_conversation`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  parameters: {
    type: 'object',
    properties: {
      elevenlabs_conversation_id: {
        type: 'string',
        description: 'The current conversation ID from ElevenLabs'
      },
      elevenlabs_agent_id: {
        type: 'string',
        description: 'Your agent ID'
      },
      user_id: {
        type: 'string',
        description: 'The user ID'
      }
    },
    required: ['elevenlabs_conversation_id', 'elevenlabs_agent_id', 'user_id']
  }
};

/**
 * Tool: save_message
 * Called after each exchange to persist the conversation
 */
export const saveMessageTool = {
  type: 'webhook',
  name: 'save_message',
  description: `Save a message to the conversation history. Call this after meaningful exchanges to ensure continuity.
You don't need to call this for every single utterance - focus on substantive messages.`,
  webhook: {
    url: `${APP_URL}/api/kira/webhooks/save_message`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  parameters: {
    type: 'object',
    properties: {
      conversation_id: {
        type: 'string',
        description: 'The ElevenLabs conversation ID'
      },
      role: {
        type: 'string',
        enum: ['user', 'assistant'],
        description: 'Who said this message'
      },
      content: {
        type: 'string',
        description: 'The message content'
      }
    },
    required: ['conversation_id', 'role', 'content']
  }
};

/**
 * Tool: update_conversation_topic
 * Called when the conversation topic changes significantly
 */
export const updateTopicTool = {
  type: 'webhook',
  name: 'update_conversation_topic',
  description: `Update the current conversation topic when it shifts to something new.
This helps you remember what you were discussing when the user returns.`,
  webhook: {
    url: `${APP_URL}/api/kira/webhooks/update_topic`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  parameters: {
    type: 'object',
    properties: {
      conversation_id: {
        type: 'string',
        description: 'The ElevenLabs conversation ID'
      },
      topic: {
        type: 'string',
        description: 'Brief description of the current topic (e.g., "planning Portugal trip", "pricing strategy for consulting")'
      }
    },
    required: ['conversation_id', 'topic']
  }
};

/**
 * All conversation continuity tools
 */
export const conversationTools = [
  getConversationContextTool,
  saveMessageTool,
  updateTopicTool
];

/**
 * Prompt addition for conversation continuity
 * Add this to the Operational Kira's system prompt
 */
export const conversationContinuityPrompt = `
## Conversation Continuity

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

This ensures users feel like you remember them and can pick up where they left off.
`;