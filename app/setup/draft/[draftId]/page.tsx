// app/setup/draft/[draftId]/page.tsx
// Draft Review Page - User reviews and edits framework before creating Operational Kira
//
// FLOW:
// 1. User arrives from /start after Setup Kira saved draft
// 2. Shows editable framework
// 3. User can modify any field
// 4. User clicks "Create My Kira"
// 5. Operational Kira is created with approved framework
// 6. Redirect to /chat/[agentId]

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Sparkles, MapPin, Target, CheckCircle, AlertCircle } from 'lucide-react';

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
    setIsSubmitting(true);

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

      // Create Operational Kira
      const response = await fetch('/api/kira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          framework: {
            userName,
            firstName: userName.split(' ')[0],
            location,
            journeyType,
            primaryObjective,
            keyContext: keyContext.filter(c => c.trim()),
            successDefinition: successDefinition || undefined,
            constraints: constraints.filter(c => c.trim()),
          },
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

  // Error state
  if (error || !draft) {
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
              <h1 className="text-xl font-bold text-white">Review Your Framework</h1>
              <p className="text-stone-400 text-sm">Edit anything, then create your Kira</p>
            </div>
          </div>
        </div>

        {/* Framework Form */}
        <div className="space-y-6">
          {/* Name & Location */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              About You
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-400 text-sm mb-2">Full Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-stone-400 text-sm mb-2 flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-stone-400 text-sm mb-2">Journey Type</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setJourneyType('personal')}
                  className={`flex-1 py-3 rounded-xl border transition-all ${
                    journeyType === 'personal'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-stone-800/50 border-stone-700 text-stone-400 hover:border-stone-600'
                  }`}
                >
                  🏠 Personal
                </button>
                <button
                  onClick={() => setJourneyType('business')}
                  className={`flex-1 py-3 rounded-xl border transition-all ${
                    journeyType === 'business'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-stone-800/50 border-stone-700 text-stone-400 hover:border-stone-600'
                  }`}
                >
                  💼 Business
                </button>
              </div>
            </div>
          </div>

          {/* Primary Objective */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              What You Want Help With
            </h2>

            <textarea
              value={primaryObjective}
              onChange={(e) => setPrimaryObjective(e.target.value)}
              rows={3}
              className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="Describe what you're trying to figure out..."
            />
          </div>

          {/* Key Context */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Key Context</h2>

            <div className="space-y-3">
              {keyContext.map((point, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => updateContextPoint(index, e.target.value)}
                    className="flex-1 bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                    placeholder="Context point..."
                  />
                  <button
                    onClick={() => removeContextPoint(index)}
                    className="px-3 text-stone-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addContextPoint}
                className="text-amber-400 hover:text-amber-300 text-sm"
              >
                + Add context point
              </button>
            </div>
          </div>

          {/* Success Definition */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">What Success Looks Like</h2>

            <textarea
              value={successDefinition}
              onChange={(e) => setSuccessDefinition(e.target.value)}
              rows={2}
              className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="How will you know if this worked?"
            />
          </div>

          {/* Constraints */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Constraints & Considerations</h2>

            <div className="space-y-3">
              {constraints.map((constraint, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => updateConstraint(index, e.target.value)}
                    className="flex-1 bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                    placeholder="Constraint..."
                  />
                  <button
                    onClick={() => removeConstraint(index)}
                    className="px-3 text-stone-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addConstraint}
                className="text-amber-400 hover:text-amber-300 text-sm"
              >
                + Add constraint
              </button>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !userName || !primaryObjective}
            className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
              isSubmitting || !userName || !primaryObjective
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
  );
}