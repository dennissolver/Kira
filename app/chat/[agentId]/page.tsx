// app/chat/[agentId]/page.tsx
// Beautiful chat page with ElevenLabs voice widget

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

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
  const [isMicAllowed, setIsMicAllowed] = useState<boolean | null>(null);

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

        const agentRes = await fetch(`/api/kira/agent?agentId=${agentId}`);

        if (!agentRes.ok) {
          throw new Error('Agent not found');
        }

        const agent: AgentInfo = await agentRes.json();
        setAgentInfo(agent);

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

  // Check microphone permission
  useEffect(() => {
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(result => {
        setIsMicAllowed(result.state === 'granted');
        result.onchange = () => setIsMicAllowed(result.state === 'granted');
      })
      .catch(() => setIsMicAllowed(null));
  }, []);

  // Start the conversation
  const startConversation = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsMicAllowed(true);

      const greeting = context?.has_history
        ? context.suggested_greeting || getReturningUserGreeting(context)
        : getNewUserGreeting(agentInfo?.agent_name || 'Kira');

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
      setIsMicAllowed(false);
    }
  }, [agentId, context, agentInfo, conversation]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
    setIsCallActive(false);
  }, [conversation]);

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

  const getNewUserGreeting = (agentName: string): string => {
    return `Hey there! I'm ${agentName}. I'm so excited to finally meet you! I've been looking forward to helping you out. So, what's on your mind today?`;
  };

  const formatTimeGap = (seconds?: number): string => {
    if (!seconds) return '';

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-400 to-orange-400 animate-ping opacity-20"></div>
            <div className="absolute inset-2 rounded-full bg-gradient-to-r from-rose-400 to-orange-400 animate-pulse"></div>
            <img
              src="/kira-avatar.jpg"
              alt="Kira"
              className="absolute inset-3 w-14 h-14 rounded-full object-cover"
            />
          </div>
          <p className="text-gray-600 font-medium">Getting everything ready...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !isCallActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full font-medium hover:shadow-lg transition-all duration-300"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
      {/* Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-rose-200 to-orange-200 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-orange-200 to-rose-200 rounded-full blur-3xl opacity-30"></div>
      </div>

      <div className="relative flex flex-col h-screen max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center gap-4 p-4 pt-6">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-rose-400 to-orange-400 ${isCallActive ? 'animate-pulse' : ''}`}></div>
            <img
              src="/kira-avatar.jpg"
              alt="Kira"
              className="relative w-14 h-14 rounded-full object-cover border-2 border-white shadow-lg"
            />
            {isCallActive && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">
              {agentInfo?.agent_name?.replace(/_/g, ' ').split(' ').slice(0, 2).join(' ') || 'Kira'}
            </h1>
            <p className="text-sm text-gray-500">
              {isCallActive ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Live conversation
                </span>
              ) : context?.has_history ? (
                `Last chat ${formatTimeGap(context.time_gap_seconds)}`
              ) : (
                'Your AI companion'
              )}
            </p>
          </div>
          {isCallActive && (
            <button
              onClick={endConversation}
              className="p-3 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              title="End conversation"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!isCallActive && transcript.length === 0 ? (
            // Welcome screen
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-orange-400 rounded-full blur-2xl opacity-20 scale-150"></div>
                <img
                  src="/kira-avatar.jpg"
                  alt="Kira"
                  className="relative w-32 h-32 rounded-full object-cover shadow-2xl border-4 border-white"
                />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {context?.has_history ? 'Welcome back! 👋' : 'Hey there! 👋'}
              </h2>

              <p className="text-gray-600 mb-8 max-w-sm leading-relaxed">
                {context?.has_history
                  ? context.last_topic
                    ? `Ready to continue talking about ${context.last_topic}?`
                    : "I'm excited to chat with you again!"
                  : "I'm Kira, your AI companion. I'm here to help you think through ideas, solve problems, and make progress on what matters to you."}
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {['Voice Chat', 'Research', 'Memory', 'Ideas'].map((feature) => (
                  <span
                    key={feature}
                    className="px-4 py-2 bg-white rounded-full text-sm text-gray-600 shadow-sm border border-gray-100"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              {/* Mic permission warning */}
              {isMicAllowed === false && (
                <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 max-w-sm">
                  <p className="text-amber-800 text-sm">
                    🎤 Microphone access is needed for voice chat. Click the button below and allow access when prompted.
                  </p>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={startConversation}
                className="group relative px-8 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <span className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Talking
                </span>
                <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>

              <p className="mt-4 text-xs text-gray-400">
                Just speak naturally — I'll listen and respond
              </p>
            </div>
          ) : (
            // Conversation view
            <div className="space-y-4 py-4">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <img
                      src="/kira-avatar.jpg"
                      alt="Kira"
                      className="w-8 h-8 rounded-full object-cover mr-2 mt-1 shadow-sm"
                    />
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}

              {/* Speaking indicator */}
              {isCallActive && conversation.isSpeaking && (
                <div className="flex justify-start">
                  <img
                    src="/kira-avatar.jpg"
                    alt="Kira"
                    className="w-8 h-8 rounded-full object-cover mr-2 shadow-sm"
                  />
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-sm text-gray-500">Speaking...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Listening indicator */}
              {isCallActive && !conversation.isSpeaking && (
                <div className="flex justify-center">
                  <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Listening...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom controls during call */}
        {isCallActive && (
          <div className="p-4 pb-8">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={endConversation}
                className="px-6 py-3 bg-white text-red-600 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 border border-red-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 3l-6 6m0 0V4m0 5h5M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                End Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}