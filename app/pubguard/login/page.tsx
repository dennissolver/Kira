'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function PubGuardLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  // Check if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/pubguard/scan');
      }
    };
    checkUser();
  }, [supabase.auth, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/pubguard/scan`,
        },
      });

      if (error) throw error;

      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Pub</span>
            <span className="text-red-400">Guard</span>
          </h1>
          <p className="text-xl text-slate-400">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
          {status === 'success' ? (
            <div className="text-center py-6">
              <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-2xl font-semibold mb-2">Check your email!</h2>
              <p className="text-slate-400 text-lg mb-4">
                We sent a magic link to <strong className="text-white">{email}</strong>
              </p>
              <p className="text-slate-500 text-sm">
                Click the link in your email to sign in. No password needed.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold mb-6 text-center">Welcome back</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full px-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-red-400 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Magic Link →'
                  )}
                </button>

                {error && (
                  <p className="text-red-400 text-center text-sm">{error}</p>
                )}
              </form>

              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-slate-500 text-sm">
                  No password required. We'll email you a secure login link.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Back to landing */}
        <div className="text-center mt-6">
          <a
            href="/pubguard"
            className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
          >
            ← Back to PubGuard
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-8 border-t border-white/10">
          <p className="text-slate-600 text-sm">
            A <a href="/" className="text-slate-500 hover:text-slate-300 transition-colors">Corporate AI Solutions</a> product
          </p>
        </div>
      </div>
    </div>
  );
}