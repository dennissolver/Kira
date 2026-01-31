// lib/kira/index.ts
// Main entry point for the Kira module
// Usage: import { VoiceAgent, createVerticalConfig, ... } from '@/lib/kira';

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core types
  JourneyType,
  KiraBaseConfig,
  KiraContext,
  KiraFramework,
  KiraKnowledge,
  KiraTool,
  KiraVerticalConfig,
  ToolType,

  // Conversation types
  ConversationMessage,
  ConversationSession,

  // Result types
  RiskRating,
  ScanResult,
  ScanFinding,

  // Component props
  VoiceAgentProps,

  // ElevenLabs types
  ElevenLabsAgentConfig,
  ElevenLabsWebhookPayload,
} from './types';

// =============================================================================
// COMPONENTS
// =============================================================================

export { VoiceAgent, VoiceButton } from './VoiceAgent';
export type { VoiceButtonProps } from './VoiceAgent';

// =============================================================================
// PHILOSOPHY
// =============================================================================

export {
  CORE_PHILOSOPHY,
  SECURITY_PHILOSOPHY,
  INTERVIEW_PHILOSOPHY,
  getPhilosophy,
  mergePhilosophy,
} from './core-philosophy';

// =============================================================================
// PROMPT BUILDING
// =============================================================================

export {
  buildSystemPrompt,
  buildFirstMessage,
  buildContextSection,
  buildKnowledgeSection,
  buildToolsSection,
  extractFirstName,
  generateAgentName,
} from './prompt-builder';

export type { PromptBuilderOptions } from './prompt-builder';

// =============================================================================
// ELEVENLABS INTEGRATION
// =============================================================================

export {
  createElevenLabsAgent,
  updateElevenLabsAgent,
  deleteElevenLabsAgent,
  getElevenLabsAgent,
  parseWebhookEvent,
  getConversationHistory,
} from './elevenlabs';

export type { WebhookEvent } from './elevenlabs';

// =============================================================================
// TOOLS
// =============================================================================

export {
  conversationTools,
  conversationContinuityPrompt,
  getConversationContextTool,
  saveMessageTool,
  updateTopicTool,
  recallMemoryTool,
  saveMemoryTool,
  searchWebTool,
  searchKnowledgeTool,
} from './tools/conversation-tools';

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

import type { KiraBaseConfig, KiraVerticalConfig, KiraTool } from './types';
import { conversationTools } from './tools/conversation-tools';

/**
 * Create a base configuration for Kira
 * This handles the common settings across all verticals
 */
export function createBaseConfig(options: {
  agentId?: string;
  agentName?: string;
  voiceId: string;
  webhookUrl: string;
  llmModel?: string;
  temperature?: number;
}): KiraBaseConfig {
  return {
    agentName: options.agentName || 'Kira',
    agentId: options.agentId,
    voiceId: options.voiceId,
    voiceModel: 'eleven_turbo_v2_5',
    llmModel: options.llmModel || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    webhookUrl: options.webhookUrl,
    webhookEvents: ['conversation.transcript', 'conversation.ended'],
  };
}

/**
 * Create a vertical configuration
 * Use this to define a new Kira vertical (PubGuard, Universal Interviews, etc.)
 */
export function createVerticalConfig(options: {
  verticalId: string;
  displayName: string;
  systemPromptTemplate: string | ((context: any) => string);
  firstMessageTemplate: string | ((context: any) => string);
  corePhilosophy?: string;
  tools?: KiraTool[];
  includeConversationTools?: boolean;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    avatarUrl?: string;
  };
  onConversationStart?: (context: any) => Promise<void>;
  onConversationEnd?: (conversationId: string, transcript: string) => Promise<void>;
  onToolCall?: (toolName: string, params: Record<string, unknown>) => Promise<unknown>;
}): KiraVerticalConfig {
  // Combine custom tools with conversation tools if requested
  const tools = options.includeConversationTools !== false
    ? [...conversationTools, ...(options.tools || [])]
    : (options.tools || []);

  return {
    verticalId: options.verticalId,
    displayName: options.displayName,
    systemPromptTemplate: options.systemPromptTemplate,
    firstMessageTemplate: options.firstMessageTemplate,
    corePhilosophy: options.corePhilosophy,
    tools,
    theme: options.theme,
    onConversationStart: options.onConversationStart,
    onConversationEnd: options.onConversationEnd,
    onToolCall: options.onToolCall,
  };
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/**
 * Default Kira voice settings (friendly Australian female)
 */
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - warm, friendly

/**
 * Preset base configs for common use cases
 */
export const presets = {
  /**
   * Standard Kira setup
   */
  standard: (webhookUrl: string, agentId?: string): KiraBaseConfig =>
    createBaseConfig({
      agentId,
      agentName: 'Kira',
      voiceId: DEFAULT_VOICE_ID,
      webhookUrl,
    }),

  /**
   * Professional/business setup (slightly more formal)
   */
  professional: (webhookUrl: string, agentId?: string): KiraBaseConfig =>
    createBaseConfig({
      agentId,
      agentName: 'Kira',
      voiceId: DEFAULT_VOICE_ID,
      webhookUrl,
      temperature: 0.6, // Slightly less creative, more consistent
    }),

  /**
   * Security-focused setup (PubGuard)
   */
  security: (webhookUrl: string, agentId?: string): KiraBaseConfig =>
    createBaseConfig({
      agentId,
      agentName: 'PubGuard',
      voiceId: DEFAULT_VOICE_ID,
      webhookUrl,
      temperature: 0.5, // More precise, less creative
    }),
};