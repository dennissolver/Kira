// app/chat/[agentId]/page.tsx
// Chat page with ElevenLabs voice widget

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@11labs/react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ConversationContext {
  has_history: boolean;
  conversation_id?: string;
  last_message_at?: string;
  time_gap_seconds?: number;
  time_gap_category?: 'recent' | 'today' | 'this_week' | 'older';
  last_topic?: string;
  summary?: string;
  message_count?: number;
  title?: string;
  recent_messages?: Message[];
  memories?: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
  }>;
  suggested_greeting?: string;
}

interface AgentInfo {
  id: string;
  user_id: string;
  agent_name: string;
  journey_type: string;
  status: string;
}

export default function ChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      setIsCallActive(true);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      setIsCallActive(false);
    },
    onMessage: (message) => {
      console.log('Message:', message);
      if (message.message) {
        setTranscript(prev => [...prev, {
          role: message.source === 'user' ? 'user' : 'assistant',
          text: message.message
        }]);
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      setError('Voice connection error. Please try again.');
    },
  });

  // Load agent info and conversation context on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // First, get agent info to retrieve userId
        const agentRes = await fetch(`/api/kira/agent?agentId=${agentId}`);

        if (!agentRes.ok) {
          throw new Error('Agent not found');
        }

        const agent: AgentInfo = await agentRes.json();
        setAgentInfo(agent);

        // Then load conversation context using the userId from agent
        const contextRes = await fetch(
          `/api/kira/conversation/context?agentId=${agentId}&userId=${agent.user_id}&limit=30`
        );

        if (!contextRes.ok) {
          throw new Error('Failed to load conversation context');
        }

        const data: ConversationContext = await contextRes.json();
        setContext(data);

      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (agentId) {
      loadData();
    }
  }, [agentId]);

  // Start the conversation (Kira speaks first)
  const startConversation = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Generate greeting based on context
      const greeting = context?.has_history
        ? context.suggested_greeting || getReturningUserGreeting(context)
        : getNewUserGreeting(agentInfo?.agent_name || 'Kira');

      // Start the ElevenLabs session with Kira speaking first
      await conversation.startSession({
        agentId: agentId,
        connectionType: "webrtc",
        overrides: {
          agent: {
            firstMessage: greeting,
          },
        },
      });

    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError('Could not access microphone. Please allow microphone access and try again.');
    }
  }, [agentId, context, agentInfo, conversation]);

  // End the conversation
  const endConversation = useCallback(async () => {
    await conversation.endSession();
    setIsCallActive(false);
  }, [conversation]);

  // Generate greeting for returning users
  const getReturningUserGreeting = (ctx: ConversationContext): string => {
    const timeGreeting = ctx.time_gap_category === 'recent'
      ? "Hey, you're back!"
      : ctx.time_gap_category === 'today'
      ? "Hey! Good to see you again today."
      : ctx.time_gap_category === 'this_week'
      ? "Hey! It's been a few days."
      : "Hey! It's been a while!";

    if (ctx.last_topic) {
      return `${timeGreeting} Last time we were talking about ${ctx.last_topic}. Want to pick up where we left off, or is there something new on your mind?`;
    }

    return `${timeGreeting} How can I help you today?`;
  };

  // Generate greeting for new users
  const getNewUserGreeting = (agentName: string): string => {
    return `Hey there! I'm ${agentName}. I'm so excited to finally meet you! I've been looking forward to helping you out. So, what's on your mind today?`;
  };

  // Format time gap for display
  const formatTimeGap = (seconds?: number): string => {
    if (!seconds) return '';

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kira-coral mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your conversation...</p>
        </div>
      </div>
    );
  }

  if (error && !isCallActive) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-kira-coral text-white rounded-lg hover:bg-opacity-90 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <img
          src="/kira-avatar.jpg"
          alt="Kira"
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">
            {agentInfo?.agent_name || 'Kira'}
          </h1>
          {context?.has_history && context.last_message_at && (
            <p className="text-xs text-gray-500">
              Last chat: {formatTimeGap(context.time_gap_seconds)}
            </p>
          )}
        </div>
        {isCallActive && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-green-600">Connected</span>
          </div>
        )}
      </header>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 && !isCallActive ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <img
              src="/kira-avatar.jpg"
              alt="Kira"
              className="w-24 h-24 rounded-full object-cover mb-4 shadow-lg"
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {context?.has_history ? 'Welcome back!' : `Meet ${agentInfo?.agent_name || 'Kira'}`}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {context?.has_history
                ? `Ready to continue our conversation${context.last_topic ? ` about ${context.last_topic}` : ''}?`
                : "I'm your AI companion, here to help you with whatever's on your mind."}
            </p>
            <button
              onClick={startConversation}
              className="px-8 py-4 bg-kira-coral text-white rounded-full text-lg font-medium hover:bg-opacity-90 transition shadow-lg flex items-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Start Conversation
            </button>
          </div>
        ) : (
          <>
            {transcript.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-kira-coral text-white'
                      : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}

            {/* Speaking indicator */}
            {isCallActive && conversation.isSpeaking && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-kira-coral rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-kira-coral rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-kira-coral rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-sm text-gray-500">Kira is speaking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      {isCallActive && (
        <div className="border-t bg-white p-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={endConversation}
              className="px-6 py-3 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Conversation
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            {conversation.isSpeaking ? '🔊 Kira is speaking...' : '🎤 Listening...'}
          </p>
        </div>
      )}
    </div>
  );
}