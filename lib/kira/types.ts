// lib/kira/types.ts
// Core types for the modular Kira voice agent system

// =============================================================================
// AGENT CONFIGURATION
// =============================================================================

export type JourneyType = 'personal' | 'business' | 'custom';

/**
 * Base configuration that all Kira verticals share
 */
export interface KiraBaseConfig {
  // Identity
  agentName: string;           // Display name (e.g., "Kira", "PubGuard", "Interviewer")
  agentId?: string;            // ElevenLabs agent ID (if pre-created)

  // Voice settings
  voiceId: string;             // ElevenLabs voice ID
  voiceModel?: string;         // Default: 'eleven_turbo_v2_5'

  // LLM settings
  llmModel?: string;           // Default: 'gpt-4o-mini'
  temperature?: number;        // Default: 0.7

  // Webhook
  webhookUrl: string;          // Where ElevenLabs sends events
  webhookEvents?: string[];    // Default: ['conversation.transcript', 'conversation.ended']
}

/**
 * Context passed to the agent at conversation start
 */
export interface KiraContext {
  // User info
  userId?: string;
  userName?: string;
  firstName?: string;

  // Session info
  sessionId?: string;
  journeyType?: JourneyType;

  // Custom context (vertical-specific)
  [key: string]: unknown;
}

/**
 * Framework/brief structure (from setup conversations)
 */
export interface KiraFramework {
  userName: string;
  firstName: string;
  location?: string;
  journeyType: JourneyType;
  primaryObjective: string;
  keyContext: string[];
  successDefinition?: string;
  constraints?: string[];
}

/**
 * Knowledge base content
 */
export interface KiraKnowledge {
  files?: { name: string; type: string; content?: string }[];
  urls?: string[];
  notes?: string;
  embeddings?: { id: string; content: string; metadata?: Record<string, unknown> }[];
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export type ToolType = 'webhook' | 'client';

export interface KiraTool {
  type: ToolType;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
  // For webhook tools
  webhook?: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
  };
  // For client-side tools
  handler?: (params: Record<string, unknown>) => Promise<unknown>;
}

// =============================================================================
// VERTICAL CONFIGURATION
// =============================================================================

/**
 * Configuration for a specific Kira vertical (PubGuard, Universal Interviews, etc.)
 */
export interface KiraVerticalConfig {
  // Identity
  verticalId: string;          // e.g., 'pubguard', 'universal-interviews'
  displayName: string;         // e.g., 'PubGuard Security Scanner'

  // Prompt configuration
  systemPromptTemplate: string | ((context: KiraContext) => string);
  firstMessageTemplate: string | ((context: KiraContext) => string);

  // Core philosophy override (optional - uses default if not provided)
  corePhilosophy?: string;

  // Tools specific to this vertical
  tools: KiraTool[];

  // Callbacks
  onConversationStart?: (context: KiraContext) => Promise<void>;
  onConversationEnd?: (conversationId: string, transcript: string) => Promise<void>;
  onToolCall?: (toolName: string, params: Record<string, unknown>) => Promise<unknown>;

  // UI customization
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    avatarUrl?: string;
  };
}

// =============================================================================
// CONVERSATION TYPES
// =============================================================================

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationSession {
  id: string;
  agentId: string;
  userId?: string;
  verticalId: string;
  status: 'active' | 'ended' | 'error';
  startedAt: Date;
  endedAt?: Date;
  transcript?: ConversationMessage[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// SCAN/RESULT TYPES (for verticals like PubGuard)
// =============================================================================

export type RiskRating = 'green' | 'amber' | 'red';

export interface ScanResult {
  id: string;
  userId: string;
  targetUrl: string;
  riskRating: RiskRating;
  findings: ScanFinding[];
  summary: string;
  conversationId?: string;
  createdAt: Date;
}

export interface ScanFinding {
  category: string;           // e.g., 'github', 'cve', 'exposure', 'trust'
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sourceUrl?: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface VoiceAgentProps {
  // Required
  config: KiraVerticalConfig;
  baseConfig: KiraBaseConfig;

  // Context
  context?: KiraContext;
  framework?: KiraFramework;
  knowledge?: KiraKnowledge;

  // Callbacks
  onReady?: () => void;
  onStart?: (conversationId: string) => void;
  onEnd?: (conversationId: string, transcript: string) => void;
  onError?: (error: Error) => void;
  onResult?: (result: unknown) => void;

  // UI options
  autoConnect?: boolean;
  showTranscript?: boolean;
  className?: string;
}

// =============================================================================
// ELEVENLABS SPECIFIC
// =============================================================================

export interface ElevenLabsAgentConfig {
  name: string;
  conversation_config: {
    agent: {
      prompt: {
        prompt: string;
        llm: string;
        temperature: number;
      };
      first_message: string;
      language: string;
    };
    tts: {
      voice_id: string;
      model_id: string;
    };
  };
  platform_settings?: {
    webhook?: {
      url: string;
      events: string[];
    };
  };
}

export interface ElevenLabsWebhookPayload {
  type: 'conversation.transcript' | 'conversation.ended' | 'conversation.started';
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