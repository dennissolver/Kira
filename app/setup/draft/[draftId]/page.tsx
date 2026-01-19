// app/setup/draft/[draftId]/page.tsx
// Draft Review Page - User reviews framework before creating Operational Kira
//
// FLOW:
// 1. User arrives from /start after Setup Kira saved draft
// 2. Shows editable framework
// 3. User can modify any field
// 4. User MUST enter email (required field)
// 5. User clicks "Create My Kira"
// 6. Operational Kira is created with approved framework
// 7. Redirect to /chat/[agentId]

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Sparkles, MapPin, Target, CheckCircle, AlertCircle, Mail, Plus, X } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface KiraDraft {
  id: string;
  user_name: string;
  first_name: string;
  location: string;
  journey_type: 'personal' | 'business';
  primary_objective: string;
  key_context: string[];
  success_definition: string | null;
  constraints: string[];
  status: string;
}

export default function DraftReviewPage() {
  const router = useRouter();
  const params = useParams();
  const draftId = params.draftId as string;

  const [draft, setDraft] = useState<KiraDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editable fields
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState(''); // NEW: Email field (required)
  const [emailError, setEmailError] = useState<string | null>(null); // NEW: Email validation error
  const [location, setLocation] = useState('');
  const [journeyType, setJourneyType] = useState<'personal' | 'business'>('personal');
  const [primaryObjective, setPrimaryObjective] = useState('');
  const [keyContext, setKeyContext] = useState<string[]>([]);
  const [successDefinition, setSuccessDefinition] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);

  // Fetch draft
  useEffect(() => {
    async function fetchDraft() {
      try {
        const { data, error } = await supabase
          .from('kira_drafts')
          .select('*')
          .eq('id', draftId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Draft not found');

        setDraft(data);

        // Initialize form with draft data
        setUserName(data.user_name);
        setLocation(data.location);
        setJourneyType(data.journey_type);
        setPrimaryObjective(data.primary_objective);
        setKeyContext(data.key_context || []);
        setSuccessDefinition(data.success_definition || '');
        setConstraints(data.constraints || []);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (draftId) {
      fetchDraft();
    }
  }, [draftId]);

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError(null);
    return true;
  };

  // Handle email change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) {
      validateEmail(value);
    }
  };

  // Handle email blur (validate on focus out)
  const handleEmailBlur = () => {
    validateEmail(email);
  };

  // Handle context point changes
  const updateContextPoint = (index: number, value: string) => {
    const updated = [...keyContext];
    updated[index] = value;
    setKeyContext(updated);
  };

  const addContextPoint = () => {
    setKeyContext([...keyContext, '']);
  };

  const removeContextPoint = (index: number) => {
    setKeyContext(keyContext.filter((_, i) => i !== index));
  };

  // Handle constraint changes
  const updateConstraint = (index: number, value: string) => {
    const updated = [...constraints];
    updated[index] = value;
    setConstraints(updated);
  };

  const addConstraint = () => {
    setConstraints([...constraints, '']);
  };

  const removeConstraint = (index: number) => {
    setConstraints(constraints.filter((_, i) => i !== index));
  };

  // Submit and create Operational Kira
  const handleSubmit = async () => {
    // Validate email first
    if (!validateEmail(email)) {
      // Scroll to email field
      document.getElementById('email-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Update draft with any user edits and mark as approved
      const { error: updateError } = await supabase
        .from('kira_drafts')
        .update({
          user_name: userName,
          first_name: userName.split(' ')[0],
          location,
          journey_type: journeyType,
          primary_objective: primaryObjective,
          key_context: keyContext.filter(c => c.trim()),
          success_definition: successDefinition || null,
          constraints: constraints.filter(c => c.trim()),
          status: 'approved',
          approved_at: new Date().toISOString(),
          user_edits: {
            edited_at: new Date().toISOString(),
            original_draft_id: draftId,
          },
        })
        .eq('id', draftId);

      if (updateError) throw updateError;

      // Create Operational Kira - FIXED: send draftId AND email
      const response = await fetch('/api/kira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          email,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create Kira');
      }

      const { agentId } = await response.json();

      // Redirect to chat with Operational Kira
      router.push(`/chat/${agentId}`);

    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Error state (draft not found)
  if (!draft) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error || 'Draft not found'}</p>
          <a href="/start" className="text-amber-400 hover:underline mt-4 block">
            Start over
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(244, 114, 182, 0.06) 0%, transparent 50%)
          `
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400/50">
              <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-stone-100">Review Your Framework</h1>
              <p className="text-stone-400 text-sm">Make any changes, then create your Kira</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">

          {/* Email Field - REQUIRED AND PROMINENT */}
          <div id="email-field" className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6">
            <label className="flex items-center gap-2 text-amber-400 mb-3">
              <Mail className="w-5 h-5" />
              <span className="font-medium">Your Email</span>
              <span className="text-red-400 text-sm">*required</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              className={`w-full px-4 py-3 rounded-xl bg-stone-800/50 border text-stone-100 placeholder-stone-500 focus:outline-none transition-colors ${
                emailError 
                  ? 'border-red-500/50 focus:border-red-500' 
                  : 'border-stone-600/30 focus:border-amber-400/50'
              }`}
              placeholder="you@example.com"
              required
            />
            {emailError ? (
              <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {emailError}
              </p>
            ) : (
              <p className="text-stone-500 text-sm mt-2">
                We'll send you a link to access your Kira anytime
              </p>
            )}
          </div>

          {/* Name */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="flex items-center gap-2 text-stone-400 mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="font-medium">Your Name</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none"
              placeholder="Your name"
            />
          </div>

          {/* Location */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="flex items-center gap-2 text-stone-400 mb-3">
              <MapPin className="w-5 h-5 text-amber-400" />
              <span className="font-medium">Location</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none"
              placeholder="City, Country"
            />
          </div>

          {/* Journey Type */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="text-stone-400 font-medium mb-3 block">Journey Type</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setJourneyType('personal')}
                className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                  journeyType === 'personal'
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
                    : 'bg-stone-800/50 border-stone-600/30 text-stone-400 hover:border-stone-500'
                }`}
              >
                🌟 Personal
              </button>
              <button
                type="button"
                onClick={() => setJourneyType('business')}
                className={`flex-1 py-3 px-4 rounded-xl border transition-all ${
                  journeyType === 'business'
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-400'
                    : 'bg-stone-800/50 border-stone-600/30 text-stone-400 hover:border-stone-500'
                }`}
              >
                💼 Business
              </button>
            </div>
          </div>

          {/* Primary Objective */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="flex items-center gap-2 text-stone-400 mb-3">
              <Target className="w-5 h-5 text-amber-400" />
              <span className="font-medium">Primary Objective</span>
            </label>
            <textarea
              value={primaryObjective}
              onChange={(e) => setPrimaryObjective(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none resize-none"
              placeholder="What do you want to achieve?"
            />
          </div>

          {/* Key Context */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="text-stone-400 font-medium mb-3 block">Key Context</label>
            <div className="space-y-3">
              {keyContext.map((context, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={context}
                    onChange={(e) => updateContextPoint(index, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none"
                    placeholder="Context point..."
                  />
                  <button
                    type="button"
                    onClick={() => removeContextPoint(index)}
                    className="p-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addContextPoint}
                className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add context point
              </button>
            </div>
          </div>

          {/* Success Definition */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="text-stone-400 font-medium mb-3 block">Success Definition (Optional)</label>
            <textarea
              value={successDefinition}
              onChange={(e) => setSuccessDefinition(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none resize-none"
              placeholder="How will you know you've succeeded?"
            />
          </div>

          {/* Constraints */}
          <div className="bg-stone-900/50 border border-stone-700/50 rounded-2xl p-6">
            <label className="text-stone-400 font-medium mb-3 block">Constraints (Optional)</label>
            <div className="space-y-3">
              {constraints.map((constraint, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => updateConstraint(index, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-100 placeholder-stone-500 focus:border-amber-400/50 focus:outline-none"
                    placeholder="Budget, timeline, etc..."
                  />
                  <button
                    type="button"
                    onClick={() => removeConstraint(index)}
                    className="p-3 rounded-xl bg-stone-800/50 border border-stone-600/30 text-stone-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addConstraint}
                className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add constraint
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl font-medium text-lg transition-all ${
                isSubmitting
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-stone-900 hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating your Kira...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Create My Kira
                </span>
              )}
            </button>
          </div>

          {/* Back link */}
          <div className="text-center mt-6">
            <a
              href="/start"
              className="text-stone-500 hover:text-stone-300 text-sm"
            >
              ← Start over
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}