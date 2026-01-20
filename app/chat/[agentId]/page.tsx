// app/chat/[agentId]/page.tsx
// Chat page with ElevenLabs voice – hardened microphone lifecycle

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
  const [isMicAllowed, setIsMicAllowed] = useState<boolean | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const [transcript, setTranscript] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);

  /* ---------------- ElevenLabs ---------------- */

  const conversation = useConversation({
    onConnect: () => {
      console.log('[Voice] Connected');
      setIsCallActive(true);
    },
    onDisconnect: () => {
      console.log('[Voice] Disconnected');
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
    onError: (err) => {
      console.error('[Voice] Error:', err);
      setError('Voice connection error. Please try again.');
    },
  });

  /* ---------------- Data loading ---------------- */

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const agentRes = await fetch(`/api/kira/agent?agentId=${agentId}`);
        if (!agentRes.ok) throw new Error('Agent not found');
        const agent: AgentInfo = await agentRes.json();
        setAgentInfo(agent);

        const ctxRes = await fetch(
          `/api/kira/conversation/context?agentId=${agentId}&userId=${agent.user_id}&limit=30`
        );
        if (!ctxRes.ok) throw new Error('Failed to load context');
        const ctx: ConversationContext = await ctxRes.json();
        setContext(ctx);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (agentId) load();
  }, [agentId]);

  /* ---------------- Mic permission (informational only) ---------------- */

  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((res) => {
        setIsMicAllowed(res.state === 'granted');
        res.onchange = () => setIsMicAllowed(res.state === 'granted');
      })
      .catch(() => setIsMicAllowed(null));
  }, []);

  /* ---------------- Conversation start (USER GESTURE ONLY) ---------------- */

  const startConversation = useCallback(async () => {
    if (isCallActive) return;

    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') {
        throw new Error('Microphone track not live');
      }

      setMicStream(stream);
      setIsMicAllowed(true);

      const greeting = context?.has_history
        ? context.suggested_greeting ||
          getReturningUserGreeting(context)
        : getNewUserGreeting(agentInfo?.agent_name || 'Kira');

      await conversation.startSession({
        agentId,
        connectionType: 'webrtc',
        overrides: {
          agent: { firstMessage: greeting },
        },
      });
    } catch (err) {
      console.error('[Mic] Failed:', err);
      setIsMicAllowed(false);
      setError(
        'Microphone unavailable. Click the lock icon in your browser address bar and allow microphone access.'
      );
    }
  }, [agentId, agentInfo, context, conversation, isCallActive]);

  /* ---------------- End conversation ---------------- */

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } finally {
      micStream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setIsCallActive(false);
    }
  }, [conversation, micStream]);

  /* ---------------- Helpers ---------------- */

  function getReturningUserGreeting(ctx: ConversationContext) {
    const base =
      ctx.time_gap_category === 'recent'
        ? "Hey, you're back!"
        : ctx.time_gap_category === 'today'
        ? 'Good to see you again today!'
        : ctx.time_gap_category === 'this_week'
        ? "It's been a few days!"
        : "It's been a while!";

    return ctx.last_topic
      ? `${base} Last time we talked about ${ctx.last_topic}. Want to continue?`
      : `${base} How can I help today?`;
  }

  function getNewUserGreeting(agentName: string) {
    return `Hey! I'm ${agentName}. What would you like to talk about today?`;
  }

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (error && !isCallActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded bg-black text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <h1 className="font-semibold">
          {agentInfo?.agent_name ?? 'Kira'}
        </h1>
        {isCallActive && (
          <button
            onClick={endConversation}
            className="text-sm text-red-600"
          >
            End call
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isCallActive && transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            {isMicAllowed === false && (
              <p className="mb-4 text-sm text-amber-700">
                Microphone access is required to start voice chat.
              </p>
            )}
            <button
              onClick={startConversation}
              className="px-8 py-4 rounded-full bg-black text-white"
            >
              Start talking
            </button>
          </div>
        ) : (
          transcript.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'text-right' : 'text-left'}
            >
              <span className="inline-block px-4 py-2 rounded bg-gray-100">
                {m.text}
              </span>
            </div>
          ))
        )}
      </main>

      {isCallActive && (
        <footer className="p-3 text-center text-sm text-gray-500">
          Listening…
        </footer>
      )}
    </div>
  );
}
