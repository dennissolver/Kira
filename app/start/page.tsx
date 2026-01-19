"use client";

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

type JourneyType = 'personal' | 'business';

function StartPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check if journey was pre-selected via URL param
  const preSelectedJourney = searchParams.get('type') as JourneyType | null;

  const [selectedJourney, setSelectedJourney] = useState<JourneyType | null>(preSelectedJourney);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionHint, setShowPermissionHint] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [kiraState, setKiraState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to Setup Kira');
      setIsConnecting(false);
      setError(null);
    },
    onDisconnect: () => {
      console.log('Disconnected from Setup Kira');
      setKiraState('idle');
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
    },
    onError: (err: Error | string) => {
      console.error('Setup Kira error:', err);
      const errorMessage = typeof err === 'string' ? err : err.message;
      setError(errorMessage);
      setIsConnecting(false);
    },
    onMessage: (message: { source: string }) => {
      if (message.source === 'ai') {
        setKiraState('speaking');
      } else {
        setKiraState('listening');
      }
    },
  });

  // Audio level animation when connected
  useEffect(() => {
    if (conversation.status === 'connected') {
      audioLevelInterval.current = setInterval(() => {
        setAudioLevel(kiraState === 'speaking' ? Math.random() * 0.8 + 0.2 : Math.random() * 0.3);
      }, 100);
    } else {
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
      setAudioLevel(0);
    }

    return () => {
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
      }
    };
  }, [conversation.status, kiraState]);

  const startConversation = useCallback(async (journey: JourneyType) => {
    setSelectedJourney(journey);
    setIsConnecting(true);
    setError(null);
    setShowPermissionHint(true);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setShowPermissionHint(false);

      // Get signed URL with journey context - Kira Setup will know which journey
      const response = await fetch(`/api/kira/start?journey=${journey}`);
      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }
      const { signedUrl } = await response.json();

      // Start the conversation
      await conversation.startSession({ signedUrl });
    } catch (err) {
      console.error('Failed to start conversation:', err);
      setShowPermissionHint(false);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone access is required to talk to Kira. Please allow microphone access and try again.');
      } else {
        setError('Failed to connect. Please try again.');
      }
      setIsConnecting(false);
      setSelectedJourney(null);
    }
  }, [conversation]);

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      setSelectedJourney(null);
    } catch (err) {
      console.error('Error ending conversation:', err);
    }
  }, [conversation]);

  const isConnected = conversation.status === 'connected';
  const showJourneyCards = !isConnected && !isConnecting;

  return (
    <div className="max-w-4xl mx-auto w-full">

      {/* Journey Selection Cards - Show when not connected */}
      {showJourneyCards && (
        <div className="fade-in">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400/50 shadow-lg shadow-amber-500/20">
                <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
              </div>
              <div className="text-left">
                <h1 className="font-display text-2xl font-bold text-white">Meet Kira</h1>
                <p className="font-body text-stone-400 text-sm">Your friendly guide</p>
              </div>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              What brings you here today?
            </h2>
            <p className="font-body text-stone-400 text-lg">
              Choose your path and let's have a conversation
            </p>
          </div>

          {/* Journey Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Personal Journey Card */}
            <button
              onClick={() => startConversation('personal')}
              className="group relative bg-gradient-to-br from-stone-900 to-stone-900/80 border border-stone-800 hover:border-amber-500/50 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/10"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/20">
                  <svg className="w-7 h-7 text-stone-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>

                <h3 className="font-display text-xl font-bold text-white mb-2">
                  Personal Journey
                </h3>
                <p className="font-body text-stone-400 mb-4 leading-relaxed">
                  Life decisions, career moves, personal projects, learning something new, or just thinking things through.
                </p>

                <div className="flex items-center gap-2 text-amber-400 font-body text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Start talking</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Business Journey Card */}
            <button
              onClick={() => startConversation('business')}
              className="group relative bg-gradient-to-br from-stone-900 to-stone-900/80 border border-stone-800 hover:border-pink-500/50 rounded-3xl p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pink-500/10"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mb-5 shadow-lg shadow-pink-500/20">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <h3 className="font-display text-xl font-bold text-white mb-2">
                  Business Journey
                </h3>
                <p className="font-body text-stone-400 mb-4 leading-relaxed">
                  Team processes, customer support, onboarding, training, or building AI assistants for your organization.
                </p>

                <div className="flex items-center gap-2 text-pink-400 font-body text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Start talking</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          {/* Footer hint */}
          <p className="text-center font-body text-stone-500 text-sm">
            Not sure? Pick one — Kira will help you figure it out.
          </p>
        </div>
      )}

      {/* Connecting State */}
      {isConnecting && (
        <div className="text-center fade-in">
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/20 to-pink-400/20 animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-pink-400 p-1">
              <div className="w-full h-full rounded-full bg-stone-900 p-1">
                <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-white mb-3">
            Connecting to Kira...
          </h2>
          <p className="font-body text-stone-400 mb-6">
            {selectedJourney === 'personal' ? 'Getting ready for your personal journey' : 'Setting up for your business needs'}
          </p>

          {showPermissionHint && (
            <div className="flex items-center justify-center gap-2 text-amber-400/80 font-body text-sm">
              <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Please allow microphone access when prompted</span>
            </div>
          )}
        </div>
      )}

      {/* Connected State - Voice Conversation */}
      {isConnected && (
        <div className="text-center fade-in">
          {/* Kira Avatar with Audio Visualization */}
          <div className="relative mb-8 inline-block">
            {/* Audio visualization rings */}
            <div
              className="absolute inset-0 rounded-full bg-amber-400/10 transition-transform duration-100"
              style={{ transform: `scale(${1.3 + audioLevel * 0.4})`, opacity: 0.3 + audioLevel * 0.3 }}
            />
            <div
              className="absolute inset-0 rounded-full bg-pink-400/10 transition-transform duration-100"
              style={{ transform: `scale(${1.5 + audioLevel * 0.5})`, opacity: 0.2 + audioLevel * 0.2 }}
            />
            <div
              className="absolute inset-0 rounded-full bg-orange-400/5 transition-transform duration-100"
              style={{ transform: `scale(${1.7 + audioLevel * 0.6})`, opacity: 0.1 + audioLevel * 0.15 }}
            />

            {/* Avatar */}
            <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-full glow-ring-active">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-pink-400 p-1">
                <div className="w-full h-full rounded-full bg-stone-900 p-1">
                  <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full rounded-full object-cover" />
                </div>
              </div>

              {/* Status indicator */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-amber-400/30">
                <div className={`w-2 h-2 rounded-full status-dot ${
                  kiraState === 'speaking' ? 'bg-amber-400' : 
                  kiraState === 'listening' ? 'bg-green-400' : 'bg-stone-500'
                }`} />
                <span className="font-body text-xs text-stone-300">
                  {kiraState === 'speaking' ? 'Kira is speaking' :
                   kiraState === 'listening' ? 'Listening...' : 'Connected'}
                </span>
              </div>
            </div>
          </div>

          {/* Journey indicator */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-body ${
              selectedJourney === 'personal' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
            }`}>
              {selectedJourney === 'personal' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Personal Journey
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Business Journey
                </>
              )}
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            I'm listening
          </h1>
          <p className="font-body text-lg text-stone-400 mb-8 max-w-md mx-auto">
            {selectedJourney === 'personal'
              ? "Tell me what's on your mind. I'm here to help you think things through."
              : "Tell me about your business challenge. I'll help you figure out the best approach."
            }
          </p>

          {/* End conversation button */}
          <button
            onClick={endConversation}
            className="px-8 py-4 rounded-full font-display font-bold text-lg bg-stone-800 text-white border border-stone-700 transition-all duration-300 hover:bg-stone-700 hover:scale-105"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Conversation
            </span>
          </button>

          {/* Conversation tips */}
          <div className="mt-10 max-w-md mx-auto">
            <div className="bg-stone-900/50 backdrop-blur-sm border border-stone-800 rounded-2xl p-5">
              <h3 className="font-display font-semibold text-stone-300 mb-3 text-sm">
                {selectedJourney === 'personal' ? 'Things to explore' : 'Things to discuss'}
              </h3>
              <div className="space-y-2 font-body text-stone-500 text-sm">
                {selectedJourney === 'personal' ? (
                  <>
                    <p>"I'm trying to decide between two career paths..."</p>
                    <p>"I want to learn something new but don't know where to start..."</p>
                    <p>"I need help thinking through a big decision..."</p>
                  </>
                ) : (
                  <>
                    <p>"We spend too much time onboarding new team members..."</p>
                    <p>"Our customers keep asking the same questions..."</p>
                    <p>"I want to automate some of our internal processes..."</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-8 max-w-md mx-auto fade-in">
          <div className="bg-red-900/30 border border-red-500/30 rounded-2xl px-6 py-4 backdrop-blur-sm">
            <p className="font-body text-red-300 text-sm text-center">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setSelectedJourney(null);
              }}
              className="mt-3 w-full text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StartPageLoading() {
  return (
    <div className="flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-amber-200/20 border-t-amber-500 animate-spin mx-auto mb-4" />
        <p className="font-body text-stone-500">Loading...</p>
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <div className="min-h-screen bg-stone-950 font-sans overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        .gradient-radial {
          background: 
            radial-gradient(ellipse at 50% 30%, rgba(251, 191, 36, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 30% 70%, rgba(244, 114, 182, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(251, 146, 60, 0.06) 0%, transparent 50%);
        }
        
        .glow-ring-active {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 
              0 0 60px rgba(251, 191, 36, 0.4),
              0 0 120px rgba(251, 191, 36, 0.2),
              0 0 180px rgba(244, 114, 182, 0.15);
          }
          50% {
            box-shadow: 
              0 0 80px rgba(251, 191, 36, 0.5),
              0 0 160px rgba(251, 191, 36, 0.3),
              0 0 240px rgba(244, 114, 182, 0.2);
          }
        }
        
        .status-dot {
          animation: status-pulse 2s ease-in-out infinite;
        }
        
        @keyframes status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 gradient-radial" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Main Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <Suspense fallback={<StartPageLoading />}>
          <StartPageContent />
        </Suspense>
      </div>

      {/* Back to home */}
      <a
        href="/"
        className="fixed top-6 left-6 font-body text-stone-500 hover:text-stone-300 text-sm transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </a>
    </div>
  );
}