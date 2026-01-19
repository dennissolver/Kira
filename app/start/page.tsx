"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Inner component that uses useSearchParams
function StartPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const journeyType = searchParams.get('type') as 'personal' | 'business' | null;

  const [step, setStep] = useState<'choose' | 'signup'>(journeyType ? 'signup' : 'choose');
  const [selectedJourney, setSelectedJourney] = useState<'personal' | 'business' | null>(journeyType);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const handleJourneySelect = (type: 'personal' | 'business') => {
    setSelectedJourney(type);
    setStep('signup');
    router.push(`/start?type=${type}`);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/kira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          journeyType: selectedJourney,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create your Kira');
      }

      router.push(`/chat/${data.agentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl w-full">

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-4 border-amber-200 shadow-lg">
            <img
              src="/kira-avatar.jpg"
              alt="Kira"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-display font-bold text-3xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
            Kira
          </span>
        </div>
      </div>

      {/* Step 1: Choose Journey */}
      {step === 'choose' && (
        <div>
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 mb-4">
              So, what's your <span className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent italic">it</span>?
            </h1>
            <p className="font-body text-xl text-stone-500">
              Choose your path — Kira will meet you where you are.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => handleJourneySelect('personal')}
              className="group bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border-2 border-amber-200 hover:border-amber-400 hover-pop cursor-pointer text-left"
            >
              <div className="text-5xl mb-4">🏠</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">
                It's personal
              </h3>
              <p className="font-body text-stone-600 leading-relaxed mb-6">
                Life stuff. Planning a trip. Making a decision. Writing something hard. Figuring out what's next.
              </p>
              <div className="flex items-center gap-2 font-display font-semibold text-amber-600 group-hover:text-amber-700">
                Start my personal journey
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

            <button
              onClick={() => handleJourneySelect('business')}
              className="group bg-gradient-to-br from-violet-50 to-pink-50 rounded-3xl p-8 border-2 border-violet-200 hover:border-violet-400 hover-pop cursor-pointer text-left"
            >
              <div className="text-5xl mb-4">💼</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">
                It's business
              </h3>
              <p className="font-body text-stone-600 leading-relaxed mb-6">
                Work stuff. Strategy. Projects. The pitch you're stuck on. The decision that keeps you up at night.
              </p>
              <div className="flex items-center gap-2 font-display font-semibold text-violet-600 group-hover:text-violet-700">
                Start my business journey
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          </div>

          <p className="text-center font-body text-stone-400 text-sm mt-8">
            Both paths get a free month. No credit card required.
          </p>
        </div>
      )}

      {/* Step 2: Signup */}
      {step === 'signup' && selectedJourney && (
        <div>
          <button
            onClick={() => {
              setStep('choose');
              setSelectedJourney(null);
              router.push('/start');
            }}
            className="font-body text-stone-500 hover:text-stone-700 mb-6 flex items-center gap-2"
          >
            <span>←</span> Back
          </button>

          <div className="bg-white rounded-3xl p-8 shadow-xl border border-amber-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl">
                {selectedJourney === 'personal' ? '🏠' : '💼'}
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-stone-800">
                  {selectedJourney === 'personal' ? 'Personal Journey' : 'Business Journey'}
                </h2>
                <p className="font-body text-stone-500">
                  Let's get you set up with your Kira
                </p>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-body text-sm font-medium text-stone-700 mb-1">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-body"
                    placeholder="Dennis"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-stone-700 mb-1">
                    Last name <span className="text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-body"
                    placeholder="Smith"
                  />
                </div>
              </div>

              <div>
                <label className="block font-body text-sm font-medium text-stone-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none font-body"
                  placeholder="dennis@example.com"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="font-body text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 rounded-xl font-display font-bold text-lg transition-all ${
                  selectedJourney === 'personal'
                    ? 'gradient-sunny text-stone-800 hover:shadow-lg hover:shadow-amber-200'
                    : 'gradient-coral text-white hover:shadow-lg hover:shadow-pink-200'
                } ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover-pop'}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating your Kira...
                  </span>
                ) : (
                  'Start Talking to Kira →'
                )}
              </button>

              <p className="text-center font-body text-stone-400 text-sm">
                Free for 30 days. No credit card required.
              </p>
            </form>
          </div>

          <div className="mt-8 bg-white/50 rounded-2xl p-6 border border-amber-100">
            <h3 className="font-display font-semibold text-stone-800 mb-3">
              What happens next?
            </h3>
            <div className="space-y-3 font-body text-stone-600 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-amber-500">1.</span>
                <span>We'll create your personal Kira — she'll remember you and your conversations.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-500">2.</span>
                <span>You'll start talking right away — no setup, no onboarding quiz.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-amber-500">3.</span>
                <span>Kira will explain how the two-way partnership works — then you dive in.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading fallback
function StartPageLoading() {
  return (
    <div className="max-w-2xl w-full flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin mx-auto mb-4"></div>
        <p className="font-body text-stone-500">Loading...</p>
      </div>
    </div>
  );
}

// Main page component with Suspense wrapper
export default function StartPage() {
  return (
    <div className="min-h-screen bg-amber-50 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        .gradient-hero {
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(251, 191, 36, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(244, 114, 182, 0.25) 0%, transparent 50%),
            linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fce7f3 100%);
        }
        
        .hover-pop {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        }
        
        .hover-pop:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .gradient-sunny {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        }
        
        .gradient-coral {
          background: linear-gradient(135deg, #fb7185 0%, #f472b6 100%);
        }
      `}</style>

      <div className="gradient-hero min-h-screen flex items-center justify-center p-6">
        <Suspense fallback={<StartPageLoading />}>
          <StartPageContent />
        </Suspense>
      </div>
    </div>
  );
}
