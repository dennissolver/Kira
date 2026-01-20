// app/chat/[agentId]/page.tsx
// Chat page with ElevenLabs voice widget
// Includes close/pause and resume functionality

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

interface ConversationContext {
  has_history: boolean;
  last_topic?: string;
  suggested_greeting?: string;
}

interface AgentInfo {
  id: string;
  user_id: string;
  agent_name: string;
  journey_type: string;
  status: string;
  elevenlabs_agent_id: string;
}

export default function ChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [transcript, setTranscript] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);

  /* ---------------- ElevenLabs ---------------- */

  const conversation = useConversation({
    onConnect: () => {
      setIsCallActive(true);
      setIsPaused(false);
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
      setError('Voice connection failed. Please try again.');
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
      } catch {
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    }

    if (agentId) loadData();
  }, [agentId]);

  /* ---------------- START CONVERSATION ---------------- */

  const startConversation = useCallback(async () => {
    if (!agentInfo || isCallActive) return;

    try {
      setError(null);
      setIsPaused(false);

      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from backend
      const res = await fetch('/api/kira/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agentInfo.elevenlabs_agent_id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start voice session');
      }

      const { signedUrl } = await res.json();

      await conversation.startSession({ signedUrl });
    } catch {
      setError(
        'Unable to start voice session. Please check microphone permissions and try again.'
      );
    }
  }, [agentInfo, conversation, isCallActive]);

  /* ---------------- END/PAUSE CONVERSATION ---------------- */

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setIsCallActive(false);
      setIsPaused(true); // Mark as paused so we show resume button
    } catch (err) {
      console.error('Error ending conversation:', err);
      setIsCallActive(false);
      setIsPaused(true);
    }
  };

  /* ---------------- RESUME CONVERSATION ---------------- */

  const resumeConversation = async () => {
    // Just start a new session - ElevenLabs will continue context
    await startConversation();
  };

  /* ---------------- UI ---------------- */

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

  if (error && !isCallActive && !isPaused) {
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
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
            {isPaused && !isCallActive && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full border-2 border-white"></span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">
              {agentInfo?.agent_name || 'Kira'}
            </h1>
            <p className="text-sm text-gray-500">
              {isCallActive ? 'Live conversation' : isPaused ? 'Paused' : 'Your AI companion'}
            </p>
          </div>

          {/* Close/Pause Button - Always visible when call is active */}
          {isCallActive && (
            <button
              onClick={endConversation}
              className="p-3 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
              title="End conversation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Initial state - no conversation yet */}
          {!isCallActive && !isPaused && transcript.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to chat?</h2>
                <p className="text-gray-500">Click below to start talking with Kira</p>
              </div>
              <button
                onClick={startConversation}
                className="px-8 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Talking
              </button>
            </div>
          )}

          {/* Paused state - show resume button */}
          {!isCallActive && isPaused && (
            <div className="flex flex-col h-full">
              {/* Show transcript history */}
              {transcript.length > 0 && (
                <div className="flex-1 space-y-4 py-4 mb-4">
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

              {/* Resume section */}
              <div className="flex flex-col items-center justify-center py-8 border-t border-gray-200">
                <div className="bg-amber-50 rounded-2xl p-6 text-center mb-6 max-w-sm">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-amber-800 font-medium">Conversation paused</p>
                  <p className="text-amber-600 text-sm mt-1">Click below to continue where you left off</p>
                </div>

                <button
                  onClick={resumeConversation}
                  className="px-8 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume Chat
                </button>

                <button
                  onClick={() => window.location.href = '/'}
                  className="mt-4 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  ← Back to home
                </button>
              </div>
            </div>
          )}

          {/* Active conversation - show transcript */}
          {isCallActive && (
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

        {/* Footer - listening indicator */}
        {isCallActive && (
          <footer className="p-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-sm text-gray-500">Listening...</span>
              <button
                onClick={endConversation}
                className="ml-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}