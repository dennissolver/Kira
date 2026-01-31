// lib/kira/VoiceAgent.tsx
// The main React component for Kira voice interactions
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Mic, MicOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import type { VoiceAgentProps, ConversationMessage } from './types';

// =============================================================================
// ELEVENLABS WIDGET DECLARATION
// =============================================================================

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'agent-id': string;
          'dynamic-variables'?: string;
          'auto-connect'?: string;
        },
        HTMLElement
      >;
    }
  }
}

// =============================================================================
// VOICE AGENT COMPONENT
// =============================================================================

export function VoiceAgent({
  config,
  baseConfig,
  context,
  framework,
  knowledge,
  onReady,
  onStart,
  onEnd,
  onError,
  onResult,
  autoConnect = false,
  showTranscript = false,
  className = '',
}: VoiceAgentProps) {
  // State
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Refs
  const widgetRef = useRef<HTMLElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Get agent ID (either from base config or we need to create one)
  const agentId = baseConfig.agentId;

  // =============================================================================
  // WIDGET LOADING
  // =============================================================================

  useEffect(() => {
    // Check if already loaded
    if (document.querySelector('script[src*="elevenlabs.io/convai-widget"]')) {
      setWidgetLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => {
      setWidgetLoaded(true);
      onReady?.();
    };
    script.onerror = () => {
      setError('Failed to load voice widget');
      onError?.(new Error('Failed to load ElevenLabs widget'));
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it might be used by other instances
    };
  }, [onReady, onError]);

  // =============================================================================
  // WIDGET EVENT HANDLERS
  // =============================================================================

  useEffect(() => {
    if (!widgetLoaded || !widgetRef.current) return;

    const widget = widgetRef.current;

    // Listen for widget events
    const handleConversationStart = (event: CustomEvent) => {
      const id = event.detail?.conversationId;
      setConversationId(id);
      setIsConnected(true);
      onStart?.(id);
    };

    const handleConversationEnd = (event: CustomEvent) => {
      setIsConnected(false);
      const fullTranscript = transcript.map(m => `${m.role}: ${m.content}`).join('\n');
      onEnd?.(conversationId || '', fullTranscript);
    };

    const handleMessage = (event: CustomEvent) => {
      const { role, content, timestamp } = event.detail || {};
      if (role && content) {
        const message: ConversationMessage = {
          id: crypto.randomUUID(),
          conversationId: conversationId || '',
          role,
          content,
          timestamp: new Date(timestamp || Date.now()),
        };
        setTranscript(prev => [...prev, message]);
      }
    };

    const handleError = (event: CustomEvent) => {
      const errorMessage = event.detail?.message || 'Unknown error';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    };

    widget.addEventListener('conversation-started', handleConversationStart as EventListener);
    widget.addEventListener('conversation-ended', handleConversationEnd as EventListener);
    widget.addEventListener('message', handleMessage as EventListener);
    widget.addEventListener('error', handleError as EventListener);

    return () => {
      widget.removeEventListener('conversation-started', handleConversationStart as EventListener);
      widget.removeEventListener('conversation-ended', handleConversationEnd as EventListener);
      widget.removeEventListener('message', handleMessage as EventListener);
      widget.removeEventListener('error', handleError as EventListener);
    };
  }, [widgetLoaded, conversationId, transcript, onStart, onEnd, onError]);

  // =============================================================================
  // AUTO-SCROLL TRANSCRIPT
  // =============================================================================

  useEffect(() => {
    if (showTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, showTranscript]);

  // =============================================================================
  // BUILD DYNAMIC VARIABLES
  // =============================================================================

  const dynamicVariables = {
    // Context
    user_id: context?.userId,
    user_name: context?.userName,
    first_name: context?.firstName || framework?.firstName,
    session_id: context?.sessionId,
    journey_type: context?.journeyType || framework?.journeyType,

    // Framework
    objective: framework?.primaryObjective,
    location: framework?.location,

    // Vertical-specific
    vertical_id: config.verticalId,

    // Spread any custom context
    ...context,
  };

  // =============================================================================
  // THEME
  // =============================================================================

  const theme = config.theme || {};
  const primaryColor = theme.primaryColor || '#f59e0b'; // amber-500
  const accentColor = theme.accentColor || '#ec4899';   // pink-500
  const avatarUrl = theme.avatarUrl || '/kira-avatar.jpg';

  // =============================================================================
  // RENDER
  // =============================================================================

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-amber-400">No agent configured. Please set up an agent ID.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Agent Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-full overflow-hidden border-2"
          style={{ borderColor: `${primaryColor}80` }}
        >
          <img
            src={avatarUrl}
            alt={config.displayName}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{config.displayName}</h2>
          <p className="text-stone-400 text-sm">
            {isConnected ? 'Connected' : 'Ready to connect'}
          </p>
        </div>
      </div>

      {/* Widget Container */}
      <div className="flex justify-center mb-6">
        {widgetLoaded && agentId ? (
          <elevenlabs-convai
            ref={(el) => { widgetRef.current = el; }}
            agent-id={agentId}
            dynamic-variables={JSON.stringify(dynamicVariables)}
            auto-connect={autoConnect ? 'true' : undefined}
          />
        ) : (
          <div className="flex items-center gap-2 text-stone-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading {config.displayName}...</span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {isConnected && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm">Live</span>
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-stone-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-stone-300" />
            )}
          </button>
        </div>
      )}

      {/* Transcript (optional) */}
      {showTranscript && transcript.length > 0 && (
        <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-medium text-stone-400 mb-3">Transcript</h3>
          <div className="space-y-3">
            {transcript.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SIMPLE VOICE BUTTON VARIANT
// =============================================================================

export interface VoiceButtonProps {
  agentId: string;
  displayName?: string;
  avatarUrl?: string;
  dynamicVariables?: Record<string, unknown>;
  autoConnect?: boolean;
  onStart?: (conversationId: string) => void;
  onEnd?: (conversationId: string) => void;
  className?: string;
}

export function VoiceButton({
  agentId,
  displayName = 'Voice Assistant',
  avatarUrl,
  dynamicVariables = {},
  autoConnect = false,
  onStart,
  onEnd,
  className = '',
}: VoiceButtonProps) {
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    if (document.querySelector('script[src*="elevenlabs.io/convai-widget"]')) {
      setWidgetLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => setWidgetLoaded(true);
    document.body.appendChild(script);
  }, []);

  if (!widgetLoaded) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        <span className="text-stone-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {avatarUrl && (
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        </div>
      )}
      <elevenlabs-convai
        agent-id={agentId}
        dynamic-variables={JSON.stringify(dynamicVariables)}
        auto-connect={autoConnect ? 'true' : undefined}
      />
    </div>
  );
}