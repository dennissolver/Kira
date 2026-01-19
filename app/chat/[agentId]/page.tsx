// app/chat/[agentId]/page.tsx
// Chat page that loads conversation history for seamless continuation

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

        // Load messages in chronological order (reverse the DESC order from API)
        if (data.recent_messages && data.recent_messages.length > 0) {
          setMessages(data.recent_messages.reverse());
        }

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kira-coral mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-kira-coral text-white rounded-lg"
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
          className="w-10 h-10 rounded-full"
        />
        <div>
          <h1 className="font-semibold text-gray-900">
            {agentInfo?.agent_name || 'Kira'}
          </h1>
          {context?.has_history && context.last_message_at && (
            <p className="text-xs text-gray-500">
              Last chat: {formatTimeGap(context.time_gap_seconds)}
            </p>
          )}
        </div>
      </header>

      {/* Session break indicator (if returning after a gap) */}
      {context?.has_history && context.time_gap_category !== 'recent' && (
        <div className="text-center py-2 text-xs text-gray-400 bg-gray-100">
          ─────── Session break ({formatTimeGap(context.time_gap_seconds)}) ───────
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Start your conversation with {agentInfo?.agent_name || 'Kira'}!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-kira-coral text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <p>{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-white/70' : 'text-gray-400'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ElevenLabs Widget Container */}
      <div className="border-t bg-white p-4">
        {/*
          TODO: Insert ElevenLabs conversation widget here
          The widget should be initialized with:
          - agentId: {agentId}
          - userId: {agentInfo?.user_id}
          - Context from: {context}

          The widget will handle:
          - Voice input/output
          - Calling tools (save_message, etc.)
          - Real-time transcription
        */}
        <div className="text-center text-gray-400 py-8">
          [ElevenLabs Voice Widget]
        </div>
      </div>
    </div>
  );
}