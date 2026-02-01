// components/KiraVoiceWidget.tsx
// PubGuard Kira voice agent widget with user-type-aware conversations
// Uses @elevenlabs/react (latest package)

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';

type UserType = 'writer' | 'developer' | 'user' | 'analyst';

interface KiraVoiceWidgetProps {
  userType: UserType;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  onConversationStart?: (conversationId: string) => void;
  onConversationEnd?: () => void;
  onScanComplete?: (result: any) => void;
  position?: 'bottom-right' | 'bottom-left' | 'inline';
  theme?: 'dark' | 'light';
  // Auto-speak props
  autoSpeak?: boolean;
  autoSpeakMessage?: string;
  onAutoSpeakComplete?: () => void;
}

// User type visual configuration
const USER_TYPE_CONFIG: Record<UserType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  buttonBg: string;
}> = {
  writer: {
    label: 'Tech Writer',
    icon: '✏️',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    buttonBg: 'bg-purple-600 hover:bg-purple-700',
  },
  developer: {
    label: 'Developer',
    icon: '💻',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
  },
  user: {
    label: 'User',
    icon: '👤',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    buttonBg: 'bg-green-600 hover:bg-green-700',
  },
  analyst: {
    label: 'Security Analyst',
    icon: '🔍',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
  },
};

// Greetings per user type (shown before voice connects)
const GREETINGS: Record<UserType, string> = {
  writer: "Hi! I'll help you vet this tool so you can write about it responsibly.",
  developer: "Hey! Let me audit this codebase and give you actionable fixes.",
  user: "Hi there! I'll help you figure out if this is safe to install.",
  analyst: "Kira here, ready for a full security assessment.",
};

export default function KiraVoiceWidget({
  userType,
  userId,
  sessionId,
  agentId = process.env.NEXT_PUBLIC_PUBGUARD_AGENT_ID || 'agent_01jmahk10gtrfs29dnf48gent9',
  onConversationStart,
  onConversationEnd,
  onScanComplete,
  position = 'bottom-right',
  theme = 'dark',
  autoSpeak = false,
  autoSpeakMessage,
  onAutoSpeakComplete,
}: KiraVoiceWidgetProps) {
  const [isOpen, setIsOpen] = useState(autoSpeak); // Auto-open if autoSpeak
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoSpoken, setHasAutoSpoken] = useState(false);

  const config = USER_TYPE_CONFIG[userType];

  // Auto-speak effect - connect and speak when autoSpeak is true
  useEffect(() => {
    if (autoSpeak && autoSpeakMessage && !hasAutoSpoken) {
      setIsOpen(true);
      setHasAutoSpoken(true);
      // The conversation will start automatically when isOpen changes
    }
  }, [autoSpeak, autoSpeakMessage, hasAutoSpoken]);

  // Initialize conversation with useConversation hook
  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      console.log('Kira connected', { conversationId, userType });
      setError(null);
      onConversationStart?.(conversationId);
    },
    onDisconnect: () => {
      console.log('Kira disconnected');
      onConversationEnd?.();
    },
    onMessage: ({ message, source }) => {
      console.log('Kira message:', { message, source });
      if (message) {
        setTranscript(prev => [...prev, { role: source, text: message }]);
      }
    },
    onError: (errorMessage) => {
      console.error('Kira error:', errorMessage);
      setError(errorMessage || 'Connection error');
    },
    // Client tools that Kira can invoke
    clientTools: {
      // Tool to display scan results in UI
      displayScanResult: async (params: { result: any }) => {
        console.log('Scan result received:', params.result);
        onScanComplete?.(params.result);
        return 'Result displayed to user';
      },
      // Tool to get current user type (must return string)
      getUserType: async () => {
        return `userType:${userType},userId:${userId || 'anonymous'},sessionId:${sessionId || 'none'}`;
      },
    },
  });

  // Start conversation
  const startConversation = useCallback(async () => {
    try {
      setError(null);

      // Build prompt with auto-speak message if provided
      const basePrompt = `You are speaking with a ${userType}. Tailor your responses accordingly:
- writer: Focus on liability, disclosures, reader safety
- developer: Focus on actionable fixes, security checklist
- user: Keep it simple, focus on "is it safe?"
- analyst: Full technical details, CVEs, IOCs`;

      const promptWithAutoSpeak = autoSpeak && autoSpeakMessage
        ? `${basePrompt}\n\nIMPORTANT: Start the conversation by saying this summary: "${autoSpeakMessage}"`
        : basePrompt;

      await conversation.startSession({
        agentId,
        connectionType: 'websocket',
        overrides: {
          agent: {
            prompt: {
              prompt: promptWithAutoSpeak,
            },
            firstMessage: autoSpeak && autoSpeakMessage ? autoSpeakMessage : undefined,
          },
        },
      });

      // Call onAutoSpeakComplete after starting
      if (autoSpeak && onAutoSpeakComplete) {
        setTimeout(() => onAutoSpeakComplete(), 1000);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError('Failed to connect. Please try again.');
    }
  }, [conversation, agentId, userType, autoSpeak, autoSpeakMessage, onAutoSpeakComplete]);

  // End conversation
  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error('Failed to end conversation:', err);
    }
  }, [conversation]);

  // Toggle widget open/close
  const handleToggle = useCallback(() => {
    if (isOpen) {
      endConversation();
      setIsOpen(false);
      setTranscript([]);
    } else {
      setIsOpen(true);
      // Small delay to let UI render before starting
      setTimeout(() => startConversation(), 100);
    }
  }, [isOpen, startConversation, endConversation]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'inline': 'relative',
  };

  // Render floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={handleToggle}
        className={`${positionClasses[position]} ${config.buttonBg} text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 flex items-center gap-3 z-50`}
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-2xl">🎧</span>
        </div>
        <div className="pr-2">
          <p className="font-semibold">Talk to Kira</p>
          <p className="text-xs opacity-80">{config.icon} {config.label} Mode</p>
        </div>
      </button>
    );
  }

  // Determine current state
  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const isSpeaking = conversation.isSpeaking;

  // Render open widget
  return (
    <div
      className={`${positionClasses[position]} ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} rounded-2xl shadow-2xl border ${config.borderColor} z-50 w-80 overflow-hidden`}
    >
      {/* Header */}
      <div className={`${config.bgColor} p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
            <span className="text-lg">👩‍💼</span>
          </div>
          <div>
            <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Kira</p>
            <p className={`text-xs ${config.color}`}>{config.icon} {config.label}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`p-2 rounded-lg hover:bg-white/10 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}
        >
          ✕
        </button>
      </div>

      {/* Status */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-center gap-2">
          {isConnecting && (
            <>
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Connecting...</span>
            </>
          )}
          {isConnected && !isSpeaking && (
            <>
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400">Listening...</span>
            </>
          )}
          {isConnected && isSpeaking && (
            <>
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-purple-400">Kira is speaking...</span>
            </>
          )}
          {!isConnected && !isConnecting && !error && (
            <>
              <div className="w-3 h-3 rounded-full bg-slate-500" />
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Disconnected</span>
            </>
          )}
          {error && (
            <>
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-red-400 text-sm">{error}</span>
            </>
          )}
        </div>
      </div>

      {/* Greeting / Transcript */}
      <div className={`p-4 h-48 overflow-y-auto ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        {transcript.length === 0 ? (
          <div className="text-center">
            <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} italic`}>
              {GREETINGS[userType]}
            </p>
            <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Say "scan" followed by a GitHub URL to begin
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.slice(-6).map((msg, i) => (
              <div
                key={i}
                className={`text-sm ${
                  msg.role === 'user'
                    ? theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    : config.color
                }`}
              >
                <span className="text-xs text-slate-500 mr-2">
                  {msg.role === 'user' ? 'You:' : 'Kira:'}
                </span>
                {msg.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual indicator */}
      <div className="p-4 flex justify-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          isSpeaking
            ? 'bg-purple-500 scale-110 animate-pulse'
            : isConnected
            ? 'bg-green-500 animate-pulse'
            : isConnecting
            ? 'bg-amber-500 animate-spin'
            : 'bg-slate-600'
        }`}>
          <span className="text-3xl">
            {isSpeaking ? '🔊' : isConnected ? '🎙️' : isConnecting ? '⏳' : '🎤'}
          </span>
        </div>
      </div>

      {/* Reconnect button if disconnected */}
      {!isConnected && !isConnecting && (
        <div className="px-4 pb-4">
          <button
            onClick={startConversation}
            className={`w-full py-2 rounded-lg ${config.buttonBg} text-white font-medium`}
          >
            {error ? 'Retry Connection' : 'Start Conversation'}
          </button>
        </div>
      )}

      {/* User type indicator */}
      <div className={`px-4 py-2 text-center text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} border-t border-white/10`}>
        Responses tailored for <span className={config.color}>{config.label}s</span>
      </div>
    </div>
  );
}

// ============================================================================
// SIMPLE INLINE VERSION (for embedding in pages)
// ============================================================================

export function KiraInlineVoice({ userType, ...props }: Omit<KiraVoiceWidgetProps, 'position'>) {
  return <KiraVoiceWidget userType={userType} position="inline" {...props} />;
}