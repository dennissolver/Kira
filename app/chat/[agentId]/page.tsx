// app/chat/[agentId]/page.tsx
// Beautiful chat page with ElevenLabs voice widget (SDK-compatible)

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface ConversationContext {
  has_history: boolean;
  last_topic?: string;
  suggested_greeting?: string;
}

interface AgentInfo {
  id: string;
  user_id: string;
  agent_name: string;
}

export default function ChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState<Message[]>([]);

  /* ---------------- ElevenLabs ---------------- */

  const conversation = useConversation({
    onConnect: () => setIsCallActive(true),
    onDisconnect: () => setIsCallActive(false),
    onMessage: (msg) => {
      if (msg?.message) {
        setTranscript((prev) => [
          ...prev,
          {
            role: msg.source === 'user' ? 'user' : 'assistant',
            text: msg.message,
          },
        ]);
      }
    },
    onError: () => {
      setError('Voice connection failed. Please try again.');
    },
  });

  /* ---------------- Load agent + context ---------------- */

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const agentRes = await fetch(`/api/kira/agent?agentId=${agentId}`);
        if (!agentRes.ok) throw new Error('Agent not found');
        const agent = await agentRes.json();
        setAgentInfo(agent);

        const ctxRes = await fetch(
          `/api/kira/conversation/context?agentId=${agentId}&userId=${agent.user_id}&limit=30`
        );
        if (ctxRes.ok) {
          const ctx = await ctxRes.json();
          setContext(ctx);
        }
      } catch (e) {
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    }

    if (agentId) load();
  }, [agentId]);

  /* ---------------- Start conversation (USER CLICK ONLY) ---------------- */

  const startConversation = useCallback(async () => {
    if (isCallActive) return;

    try {
      setError(null);

      // PRIME MICROPHONE (required for Windows)
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const greeting = context?.has_history
        ? context.suggested_greeting ||
          (context.last_topic
            ? `Welcome back. Last time we talked about ${context.last_topic}.`
            : 'Welcome back.')
        : `Hey there! I'm ${agentInfo?.agent_name || 'Kira'}.`;

      await conversation.startSession({
        agentId,
        connectionType: 'webrtc',
        overrides: {
          agent: {
            firstMessage: greeting,
          },
        },
      });
    } catch (e) {
      setError(
        'Microphone access failed. Please allow microphone permissions and try again.'
      );
    }
  }, [agentId, agentInfo, context, conversation, isCallActive]);

  /* ---------------- End conversation ---------------- */

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } finally {
      setIsCallActive(false);
    }
  }, [conversation]);

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (error && !isCallActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-3">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <div className="relative flex flex-col h-screen max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center gap-4 p-4 pt-6">
          <img
            src="/kira-avatar.jpg"
            alt="Kira"
            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-lg"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">
              {agentInfo?.agent_name || 'Kira'}
            </h1>
            <p className="text-sm text-gray-500">
              {isCallActive ? 'Live conversation' : 'Your AI companion'}
            </p>
          </div>
          {isCallActive && (
            <button
              onClick={endConversation}
              className="p-3 rounded-full bg-red-100 text-red-600"
            >
              ✕
            </button>
          )}
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-4 pb-4">
          {!isCallActive && transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <button
                onClick={startConversation}
                className="px-8 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full text-lg font-semibold shadow-lg"
              >
                Start Talking
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white'
                        : 'bg-white text-gray-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {isCallActive && (
          <footer className="p-3 text-center text-sm text-gray-500">
            Listening…
          </footer>
        )}
      </div>
    </div>
  );
}
