// app/chat/[agentId]/page.tsx
// Beautiful chat page with ElevenLabs voice widget
// ORIGINAL UI + MINIMAL MIC FIX

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ConversationContext {
  has_history: boolean;
  last_topic?: string;
  suggested_greeting?: string;
  time_gap_seconds?: number;
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
  const [transcript, setTranscript] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);

  /* ---------------- ElevenLabs ---------------- */

  const conversation = useConversation({
    onConnect: () => {
      setIsCallActive(true);
    },
    onDisconnect: () => {
      setIsCallActive(false);
    },
    onMessage: (message) => {
      if (message?.message) {
        setTranscript((prev) => [
          ...prev,
          {
            role: message.source === 'user' ? 'user' : 'assistant',
            text: message.message,
          },
        ]);
      }
    },
    onError: () => {
      setError('Voice connection error. Please try again.');
    },
  });

  /* ---------------- Load agent + context ---------------- */

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const agentRes = await fetch(`/api/kira/agent?agentId=${agentId}`);
        if (!agentRes.ok) throw new Error('Agent not found');
        const agent: AgentInfo = await agentRes.json();
        setAgentInfo(agent);

        const ctxRes = await fetch(
          `/api/kira/conversation/context?agentId=${agentId}&userId=${agent.user_id}&limit=30`
        );
        if (ctxRes.ok) {
          const ctx: ConversationContext = await ctxRes.json();
          setContext(ctx);
        }
      } catch (err) {
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    }

    if (agentId) loadData();
  }, [agentId]);

  /* ---------------- START CONVERSATION (MINIMAL FIX) ---------------- */
  /* This matches Agent Interviews behaviour exactly */

  const startConversation = useCallback(async () => {
    if (isCallActive) return;

    try {
      setError(null);

      // 🔑 MIC PRIME — REQUIRED FOR WINDOWS + THIS SDK
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
    } catch {
      setError(
        'Microphone blocked. Click the lock icon in your browser and allow microphone access.'
      );
    }
  }, [agentId, agentInfo, context, conversation, isCallActive]);

  const endConversation = async () => {
    await conversation.endSession();
    setIsCallActive(false);
  };

  /* ---------------- UI (ORIGINAL, UNTOUCHED) ---------------- */

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
          <p className="text-gray-600 font-medium">Getting everything ready…</p>
        </div>
      </div>
    );
  }

  if (error && !isCallActive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Oops</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full"
          >
            Try Again
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
          <div className="relative">
            <img
              src="/kira-avatar.jpg"
              alt="Kira"
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-lg"
            />
            {isCallActive && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></span>
            )}
          </div>
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
                className="px-8 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition"
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
