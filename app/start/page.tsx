// app/start/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2, FileEdit, CheckCircle, Sparkles, User, Briefcase, ArrowLeft } from 'lucide-react';

interface Draft {
  id: string;
  user_name: string;
  primary_objective: string;
  created_at: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Setup Kira's ElevenLabs agent ID
const SETUP_KIRA_AGENT_ID = process.env.NEXT_PUBLIC_SETUP_KIRA_AGENT_ID;

type JourneyType = 'personal' | 'business' | null;

export default function StartPage() {
  const router = useRouter();

  // Journey selection state
  const [selectedJourney, setSelectedJourney] = useState<JourneyType>(null);

  // Widget state
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft detection state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);

  // Refs for cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Check if agent ID is configured
  useEffect(() => {
    if (!SETUP_KIRA_AGENT_ID) {
      setError('Setup Kira agent not configured. Please set NEXT_PUBLIC_SETUP_KIRA_AGENT_ID.');
    }
  }, []);

  // Load ElevenLabs widget script
  useEffect(() => {
    if (!SETUP_KIRA_AGENT_ID || !selectedJourney) return;

    if (document.querySelector('script[src*="elevenlabs.io/convai-widget"]')) {
      setWidgetLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => setWidgetLoaded(true);
    document.body.appendChild(script);
  }, [selectedJourney]);

  // Set session start time when widget loads
  useEffect(() => {
    if (widgetLoaded && !sessionStartTime) {
      setSessionStartTime(new Date());
      console.log('[StartPage] Session started, listening for drafts...');
    }
  }, [widgetLoaded, sessionStartTime]);

  // POLLING FUNCTION: Check for new drafts
  const checkForDraft = useCallback(async () => {
    if (!sessionStartTime || draftReady) return;

    try {
      const { data: drafts, error } = await supabase
        .from('kira_drafts')
        .select('id, user_name, primary_objective, created_at')
        .eq('status', 'draft')
        .gte('created_at', sessionStartTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[StartPage] Poll error:', error);
        return;
      }

      if (drafts && drafts.length > 0) {
        const draft = drafts[0];
        console.log('[StartPage] Draft found:', draft.user_name);
        setCurrentDraft(draft);
        setDraftReady(true);

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('[StartPage] Poll exception:', err);
    }
  }, [sessionStartTime, draftReady]);

  // DUAL DETECTION: Real-time subscription + Polling fallback
  useEffect(() => {
    if (!widgetLoaded || !sessionStartTime) return;

    console.log('[StartPage] Starting draft detection...');

    const channel = supabase
      .channel('kira-draft-detection-' + Date.now())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'kira_drafts'
        },
        (payload) => {
          console.log('[StartPage] Real-time: New draft detected!', payload);

          const newDraft = payload.new as Draft;
          const draftCreatedAt = new Date(newDraft.created_at);

          if (draftCreatedAt >= sessionStartTime) {
            console.log('[StartPage] Draft verified:', newDraft.user_name);
            setCurrentDraft(newDraft);
            setDraftReady(true);

            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[StartPage] Subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    pollIntervalRef.current = setInterval(() => {
      checkForDraft();
    }, 3000);

    checkForDraft();

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [widgetLoaded, sessionStartTime, checkForDraft]);

  const goToReviewDraft = () => {
    if (currentDraft) {
      router.push(`/setup/draft/${currentDraft.id}`);
    }
  };

  const selectJourney = (journey: JourneyType) => {
    setSelectedJourney(journey);
  };

  const goBack = () => {
    setSelectedJourney(null);
    setWidgetLoaded(false);
    setSessionStartTime(null);
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(244, 114, 182, 0.06) 0%, transparent 50%)
          `
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Back link */}
        <div className="mb-8">
          {selectedJourney ? (
            <button
              onClick={goBack}
              className="text-stone-500 hover:text-stone-300 text-sm transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to selection
            </button>
          ) : (

              href="/"
              className="text-stone-500 hover:text-stone-300 text-sm transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </a>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400/50">
              <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">Meet Kira</h1>
              <p className="text-stone-400 text-sm">Your friendly guide</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {selectedJourney ? (
              selectedJourney === 'personal' ? "Let's talk about life stuff" : "Let's talk about work stuff"
            ) : (
              "What brings you here today?"
            )}
          </h2>
          <p className="text-stone-400">
            {selectedJourney
              ? "Have a quick chat and Kira will create a brief for you to review."
              : "Choose your path and let's have a conversation"
            }
          </p>
        </div>

        {/* JOURNEY SELECTION (before widget) */}
        {!selectedJourney && (
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Personal Journey */}
            <button
              onClick={() => selectJourney('personal')}
              className="bg-stone-900/50 border border-stone-800 hover:border-amber-500/50 rounded-2xl p-6 text-left transition-all hover:bg-stone-900/80 group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
                <User className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Personal Journey</h3>
              <p className="text-stone-400 text-sm mb-4">
                Life decisions, career moves, personal projects, learning something new, or just thinking things through.
              </p>
              <span className="text-pink-400 text-sm font-medium inline-flex items-center gap-1">
                Start talking
              </span>
            </button>

            {/* Business Journey */}
            <button
              onClick={() => selectJourney('business')}
              className="bg-stone-900/50 border border-stone-800 hover:border-pink-500/50 rounded-2xl p-6 text-left transition-all hover:bg-stone-900/80 group"
            >
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4 group-hover:bg-pink-500/30 transition-colors">
                <Briefcase className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Business Journey</h3>
              <p className="text-stone-400 text-sm mb-4">
                Team processes, customer support, onboarding, training, or building AI assistants for your organization.
              </p>
              <span className="text-pink-400 text-sm font-medium inline-flex items-center gap-1">
                Start talking
              </span>
            </button>
          </div>
        )}

        {/* Not sure text */}
        {!selectedJourney && (
          <p className="text-center text-stone-500 text-sm mt-6">
            Not sure? Pick one - Kira will help you figure it out.
          </p>
        )}

        {/* CONVERSATION INTERFACE (after journey selected) */}
        {selectedJourney && (
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-8">
            {/* Instructions */}
            <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium mb-1">How it works:</p>
                  <ol className="text-amber-200/70 text-sm space-y-1 list-decimal list-inside">
                    <li>Kira will start talking - just listen and respond naturally</li>
                    <li>Tell her what you are trying to figure out</li>
                    <li>She will create a brief for you to review</li>
                    <li>The Review Framework button will turn green when ready</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* ElevenLabs Widget with journey context and auto-connect */}
            <div className="flex justify-center mb-8">
              {widgetLoaded && SETUP_KIRA_AGENT_ID ? (
                <elevenlabs-convai
                  agent-id={SETUP_KIRA_AGENT_ID}
                  dynamic-variables={JSON.stringify({ journey_type: selectedJourney })}
                  auto-connect="true"
                ></elevenlabs-convai>
              ) : (
                <div className="flex items-center gap-2 text-stone-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading Kira...</span>
                </div>
              )}
            </div>

            {/* Review Framework Button */}
            <div className="flex justify-center">
              <button
                onClick={goToReviewDraft}
                disabled={!draftReady}
                className={`
                  inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-lg
                  transition-all duration-300 transform
                  ${draftReady
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-stone-900 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 cursor-pointer'
                    : 'bg-stone-800 text-stone-500 border border-stone-700 cursor-not-allowed'
                  }
                `}
              >
                {draftReady ? (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    Review Framework
                  </>
                ) : (
                  <>
                    <FileEdit className="w-6 h-6" />
                    Review Framework
                    <span className="text-sm font-normal opacity-50">(talk to Kira first)</span>
                  </>
                )}
              </button>
            </div>

            {/* Status indicator */}
            {sessionStartTime && !draftReady && (
              <p className="text-center text-stone-500 text-sm mt-4">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                Listening for your framework...
              </p>
            )}

            {/* Draft preview when ready */}
            {draftReady && currentDraft && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-amber-200">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Framework ready for <strong>{currentDraft.user_name}</strong>
                </p>
                <p className="text-amber-200/70 text-sm mt-1">
                  {currentDraft.primary_objective}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// TypeScript declaration for ElevenLabs widget
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps
        React.HTMLAttributes<HTMLElement> & {
          'agent-id': string;
          'dynamic-variables'?: string;
          'auto-connect'?: string;
        },
        HTMLElement
      >;
    }
  }
}