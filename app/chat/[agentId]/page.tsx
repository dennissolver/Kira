// app/chat/[agentId]/page.tsx
// Chat page with ElevenLabs voice widget
// Includes: persistent bottom control bar, refer a friend, knowledge base upload

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useConversation } from '@elevenlabs/react';

// Icons as inline SVGs to avoid lucide-react dependency issues
const MicIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const GiftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArchiveIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

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

  // Modal states
  const [showReferModal, setShowReferModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

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

  /* ---------------- PAUSE CONVERSATION ---------------- */

  const pauseConversation = async () => {
    try {
      await conversation.endSession();
      setIsCallActive(false);
      setIsPaused(true);
    } catch (err) {
      console.error('Error pausing conversation:', err);
      setIsCallActive(false);
      setIsPaused(true);
    }
  };

  /* ---------------- END CONVERSATION ---------------- */

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setIsCallActive(false);
      setIsPaused(false);
      // Optionally redirect or reset
    } catch (err) {
      console.error('Error ending conversation:', err);
      setIsCallActive(false);
      setIsPaused(false);
    }
  };

  /* ---------------- RESUME CONVERSATION ---------------- */

  const resumeConversation = async () => {
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
      {/* ============ CORPORATE AI SOLUTIONS TOP BANNER ============ */}
      <CorporateAIBanner />

      <div className="relative flex flex-col h-[calc(100vh-52px)] max-w-2xl mx-auto">
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
              {isCallActive ? '🟢 Live conversation' : isPaused ? '⏸️ Paused' : 'Your AI companion'}
            </p>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Welcome message when not started */}
          {!isCallActive && !isPaused && transcript.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <img
                src="/kira-avatar.jpg"
                alt="Kira"
                className="w-24 h-24 rounded-full object-cover shadow-xl mb-6"
              />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Hey there! 👋</h2>
              <p className="text-gray-500 mb-2">I'm Kira, your AI companion.</p>
              <p className="text-gray-400 text-sm">Press <strong>Start Talking</strong> below to begin our conversation.</p>
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="space-y-4 py-4">
              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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

              {/* Listening indicator */}
              {isCallActive && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-sm text-gray-500">Listening...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paused message */}
          {isPaused && !isCallActive && (
            <div className="flex justify-center my-4">
              <div className="bg-amber-50 rounded-xl px-4 py-2 text-amber-700 text-sm">
                Conversation paused — press Resume to continue
              </div>
            </div>
          )}
        </main>

        {/* ============================================
            BOTTOM CONTROL BAR - Always Visible
            ============================================ */}
        <footer className="border-t border-gray-200 bg-white p-4 safe-area-pb">
          {/* Main Control Buttons Row */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* START Button - shown when not active and not paused */}
            {!isCallActive && !isPaused && (
              <button
                onClick={startConversation}
                className="flex-1 max-w-xs py-4 px-6 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
              >
                <MicIcon />
                <span>Start Talking</span>
              </button>
            )}

            {/* PAUSE and END buttons - shown when call is active */}
            {isCallActive && (
              <>
                <button
                  onClick={pauseConversation}
                  className="flex-1 max-w-[150px] py-4 px-4 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <PauseIcon />
                  <span>Pause</span>
                </button>

                <button
                  onClick={endConversation}
                  className="flex-1 max-w-[150px] py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <StopIcon />
                  <span>End Session</span>
                </button>
              </>
            )}

            {/* RESUME Button - shown when paused */}
            {!isCallActive && isPaused && (
              <>
                <button
                  onClick={resumeConversation}
                  className="flex-1 max-w-xs py-4 px-6 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                >
                  <PlayIcon />
                  <span>Resume Chat</span>
                </button>
              </>
            )}
          </div>

          {/* Secondary Actions Row */}
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
            {/* Upload Knowledge */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors text-sm"
            >
              <UploadIcon />
              <span className="hidden sm:inline font-medium">Add Knowledge</span>
            </button>

            <div className="w-px h-5 bg-gray-200"></div>

            {/* Refer a Friend */}
            <button
              onClick={() => setShowReferModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm"
            >
              <GiftIcon />
              <span className="hidden sm:inline font-medium">Share Kira</span>
            </button>

            <div className="w-px h-5 bg-gray-200"></div>

            {/* Complete Project */}
            <button
              onClick={() => setShowCompleteModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors text-sm"
            >
              <CheckCircleIcon />
              <span className="hidden sm:inline font-medium">Complete Project</span>
            </button>
          </div>
        </footer>
      </div>

      {/* ============ REFER A FRIEND MODAL ============ */}
      <ReferModal
        isOpen={showReferModal}
        onClose={() => setShowReferModal(false)}
        userId={agentInfo?.user_id}
      />

      {/* ============ UPLOAD KNOWLEDGE MODAL ============ */}
      <UploadKnowledgeModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        agentId={agentId}
        userId={agentInfo?.user_id}
      />

      {/* ============ COMPLETE PROJECT MODAL ============ */}
      <CompleteProjectModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        agentId={agentId}
        agentName={agentInfo?.agent_name || 'Kira'}
        userId={agentInfo?.user_id}
      />
    </div>
  );
}

/* ================================================================
   REFER A FRIEND MODAL
   ================================================================ */

function ReferModal({
  isOpen,
  onClose,
  userId
}: {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}) {
  const [formData, setFormData] = useState({
    yourName: '',
    yourEmail: '',
    friendEmail: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/refer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          referrerId: userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send referral');
      }

      setStatus('sent');

      setTimeout(() => {
        onClose();
        setStatus('idle');
        setFormData({ yourName: '', yourEmail: '', friendEmail: '' });
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <XIcon />
        </button>

        {status === 'sent' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Invite sent! 🎉
            </h3>
            <p className="text-gray-600">
              Your friend will receive an email from you shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <GiftIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                Share Kira with a friend
              </h3>
              <p className="text-gray-600 text-sm">
                Think a friend could use a helpful guide? Send them an invite.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="yourName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  id="yourName"
                  required
                  value={formData.yourName}
                  onChange={(e) => setFormData(prev => ({ ...prev, yourName: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label htmlFor="yourEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Your email
                </label>
                <input
                  type="email"
                  id="yourEmail"
                  required
                  value={formData.yourEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, yourEmail: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition"
                />
              </div>

              <div>
                <label htmlFor="friendEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Friend's email
                </label>
                <input
                  type="email"
                  id="friendEmail"
                  required
                  value={formData.friendEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, friendEmail: e.target.value }))}
                  placeholder="friend@example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition"
                />
              </div>

              {status === 'error' && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-gradient-to-r from-rose-500 to-orange-500 text-white py-3 rounded-xl font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {status === 'sending' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <SendIcon />
                    Send Invite
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              We'll send them one friendly email. No spam, ever.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   UPLOAD KNOWLEDGE MODAL
   ================================================================ */

function UploadKnowledgeModal({
  isOpen,
  onClose,
  agentId,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  userId?: string;
}) {
  const [activeTab, setActiveTab] = useState<'files' | 'urls'>('files');
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>(['']);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addUrlField = () => {
    setUrls(prev => [...prev, '']);
  };

  const updateUrl = (index: number, value: string) => {
    setUrls(prev => prev.map((url, i) => i === index ? value : url));
  };

  const removeUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setUploading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('agentId', agentId);
      if (userId) formData.append('userId', userId);

      files.forEach(file => {
        formData.append('files', file);
      });

      const validUrls = urls.filter(url => url.trim());
      if (validUrls.length > 0) {
        formData.append('urls', JSON.stringify(validUrls));
      }

      const response = await fetch('/api/kira/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('success');

      setTimeout(() => {
        setFiles([]);
        setUrls(['']);
        setStatus('idle');
        onClose();
      }, 2000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const hasContent = files.length > 0 || urls.some(url => url.trim());

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <XIcon />
        </button>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Knowledge added! 🧠
            </h3>
            <p className="text-gray-600">
              Kira will use this to give you better advice.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UploadIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                Add to Kira's knowledge
              </h3>
              <p className="text-gray-600 text-sm">
                Share files or links to help Kira understand your situation better.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'files'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FileIcon />
                Files
              </button>
              <button
                onClick={() => setActiveTab('urls')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === 'urls'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <LinkIcon />
                URLs
              </button>
            </div>

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 hover:bg-gray-50 transition"
                >
                  <UploadIcon />
                  <p className="text-sm text-gray-600 mt-2">Click to upload files</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, TXT, CSV</p>
                </button>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FileIcon />
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                          <XIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* URLs Tab */}
            {activeTab === 'urls' && (
              <div className="space-y-3">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      placeholder="https://example.com/resource"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition text-sm"
                    />
                    {urls.length > 1 && (
                      <button
                        onClick={() => removeUrl(i)}
                        className="p-2.5 text-gray-400 hover:text-red-500 transition"
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addUrlField}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  <PlusIcon />
                  Add another URL
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={uploading || !hasContent}
              className="w-full mt-6 bg-gradient-to-r from-rose-500 to-orange-500 text-white py-3 rounded-xl font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadIcon />
                  Add to Knowledge Base
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              Files are processed securely and used only to help Kira assist you better.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   COMPLETE PROJECT MODAL
   ================================================================ */

function CompleteProjectModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  userId?: string;
}) {
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'completing' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleComplete = async () => {
    setStatus('completing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/kira/agent/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userId,
          feedback: feedback.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete project');
      }

      setStatus('completed');

      // Redirect to home after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'completing') onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 relative">
        {status !== 'completing' && status !== 'completed' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
          >
            <XIcon />
          </button>
        )}

        {status === 'completed' ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Project Complete! 🎉
            </h3>
            <p className="text-gray-600 mb-2">
              Great work finishing this one.
            </p>
            <p className="text-gray-500 text-sm">
              Redirecting you home...
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArchiveIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                Complete this project?
              </h3>
              <p className="text-gray-600 text-sm">
                This will archive <strong>{agentName}</strong> and mark the project as done.
              </p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 mb-4">
              <p className="text-amber-800 text-sm">
                <strong>What happens:</strong>
              </p>
              <ul className="text-amber-700 text-sm mt-2 space-y-1">
                <li>• Your conversation history is saved</li>
                <li>• The agent will be archived (not deleted)</li>
                <li>• You can start a new project anytime</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Any final notes? (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="How did it go? What did you accomplish?"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition resize-none"
              />
            </div>

            {status === 'error' && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={status === 'completing'}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={status === 'completing'}
                className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {status === 'completing' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon />
                    Complete Project
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CORPORATE AI SOLUTIONS TOP BANNER
   ================================================================ */

function CorporateAIBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Main Banner - Always Visible */}
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-amber-400 text-xl">⚡</span>
            <div className="flex-1">
              <p className="text-sm sm:text-base font-medium">
                <span className="text-amber-400">Tired of generic AI?</span>
                {' '}Kira is just one of our specialized Voice AI agents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://corporate-ai-solutions.vercel.app/marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap"
            >
              Explore All Agents →
            </a>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="border-t border-slate-700 bg-slate-900/50">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {/* Problem/Solution Cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-2xl mb-2">🎯</div>
                <h4 className="font-semibold text-amber-400 mb-1">Sales AI Agents</h4>
                <p className="text-slate-400 text-sm">Convert more leads with AI that qualifies, nurtures, and books meetings 24/7</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-2xl mb-2">🛎️</div>
                <h4 className="font-semibold text-amber-400 mb-1">Customer Service AI</h4>
                <p className="text-slate-400 text-sm">Handle support tickets instantly. No hold times. No frustrated customers.</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="text-2xl mb-2">📋</div>
                <h4 className="font-semibold text-amber-400 mb-1">Operations AI</h4>
                <p className="text-slate-400 text-sm">Automate scheduling, intake, and workflows. Free your team for high-value work.</p>
              </div>
            </div>

            {/* CTA Section */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-700">
              <div>
                <p className="text-slate-300 text-sm">
                  <span className="font-semibold text-white">Corporate AI Solutions</span> —
                  Voice AI that actually works for your business
                </p>
                <p className="text-slate-500 text-xs mt-1">Created by Dennis McMahin · Longtail AI Ventures</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://corporate-ai-solutions.vercel.app/marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2 rounded-full text-sm font-bold transition-colors"
                >
                  Browse AI Marketplace →
                </a>
                <a
                  href="https://corporate-ai-solutions.vercel.app/studio/thesis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-amber-400 text-sm transition-colors"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}