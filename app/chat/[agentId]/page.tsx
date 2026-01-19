"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

export default function ChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to Kira');
      setIsConnecting(false);
    },
    onDisconnect: () => {
      console.log('Disconnected from Kira');
    },
    onError: (err: Error | string) => {
      console.error('Kira error:', err);
      setError('Connection error. Please try again.');
      setIsConnecting(false);
    },
  });

  const isConnected = conversation.status === 'connected';

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/kira/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start conversation');
      }

      const { signedUrl } = await res.json();
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ signedUrl });

    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [agentId, conversation]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .pulse-ring { animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.1; }
        }
        .gradient-sunny { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        .avatar-ring {
          background: linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%);
          padding: 4px;
          border-radius: 50%;
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {/* Kira Avatar */}
        <div className="relative mb-8">
          {isConnected && (
            <>
              <div className="absolute inset-0 rounded-full bg-amber-400/20 pulse-ring" style={{ transform: 'scale(1.5)' }} />
              <div className="absolute inset-0 rounded-full bg-pink-400/20 pulse-ring" style={{ transform: 'scale(1.8)', animationDelay: '0.5s' }} />
              <div className="absolute inset-0 rounded-full bg-violet-400/20 pulse-ring" style={{ transform: 'scale(2.1)', animationDelay: '1s' }} />
            </>
          )}
          <div className="avatar-ring relative z-10">
            <div className={`w-32 h-32 rounded-full overflow-hidden bg-white ${isConnected ? 'animate-pulse' : ''}`}>
              <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-stone-800 mb-2">Kira</h1>
          <p className="font-body text-stone-500">
            {isConnecting && 'Connecting...'}
            {isConnected && 'Listening...'}
            {!isConnecting && !isConnected && 'Ready to talk'}
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 
            isConnecting ? 'bg-amber-500 animate-pulse' : 'bg-stone-300'
          }`} />
          <span className="font-body text-sm text-stone-500">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Not connected'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-md">
            <p className="font-body text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Tips when not connected */}
        {!isConnected && !isConnecting && (
          <div className="max-w-md bg-white/60 rounded-2xl p-6 mb-8 border border-amber-100">
            <h3 className="font-display font-semibold text-stone-800 mb-3 text-center">
              How this works
            </h3>
            <ul className="space-y-2 font-body text-stone-600 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>Speak naturally — like you're talking to a friend</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>Give her context — the more she knows, the better she helps</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>Push back if she's off — she'll adjust</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>This is a two-way thing — you show up too</span>
              </li>
            </ul>
          </div>
        )}

        {/* Action button */}
        {!isConnected ? (
          <button
            onClick={startConversation}
            disabled={isConnecting}
            className={`px-8 py-4 rounded-full font-display font-bold text-lg gradient-sunny text-stone-800 shadow-lg shadow-amber-200 transition-all ${
              isConnecting ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl'
            }`}
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Talking
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={endConversation}
            className="px-8 py-4 rounded-full font-display font-bold text-lg bg-stone-800 text-white shadow-lg transition-all hover:bg-stone-700 hover:scale-105"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Conversation
            </span>
          </button>
        )}

        <p className="mt-8 font-body text-xs text-stone-400">
          Powered by ElevenLabs Conversational AI
        </p>
      </div>
    </div>
  );
}
