'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

const FREE_SCAN_LIMIT = 1;
const SCAN_COUNT_KEY = 'pubguard_scan_count';

interface ScanResult {
  type: 'github' | 'cve' | 'news' | 'exposure';
  data: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export default function PubGuardScanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Check auth and scan count on mount
  useEffect(() => {
    const init = async () => {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        // Check localStorage for scan count
        const stored = localStorage.getItem(SCAN_COUNT_KEY);
        const count = stored ? parseInt(stored, 10) : 0;
        setScanCount(count);

        // If they've used their free scan, show auth gate
        if (count >= FREE_SCAN_LIMIT) {
          setShowAuthGate(true);
        }
      }

      setLoading(false);
    };

    init();
  }, [supabase.auth]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Check if they can scan
    if (!user && scanCount >= FREE_SCAN_LIMIT) {
      setShowAuthGate(true);
      return;
    }

    setScanning(true);
    setError('');
    setResult(null);

    try {
      // Determine scan type based on URL
      let endpoint = '/api/pubguard/scan/github';
      let body: any = { url };

      if (url.includes('github.com')) {
        endpoint = '/api/pubguard/scan/github';
        body = { url };
      } else if (url.match(/^CVE-\d{4}-\d+$/i)) {
        endpoint = '/api/pubguard/scan/cve';
        body = { cveId: url };
      } else if (url.match(/^[\w.-]+\.(com|net|org|io|dev|app)$/)) {
        endpoint = '/api/pubguard/scan/exposures';
        body = { target: url };
      } else {
        // Default to GitHub
        endpoint = '/api/pubguard/scan/github';
        body = { url };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Scan failed');
      }

      const data = await response.json();

      // Determine risk level from response
      let riskLevel: ScanResult['riskLevel'] = 'medium';
      if (data.analysis?.riskLevel) {
        riskLevel = data.analysis.riskLevel;
      } else if (data.exposure?.riskLevel) {
        riskLevel = data.exposure.riskLevel;
      }

      setResult({
        type: endpoint.includes('github') ? 'github' :
              endpoint.includes('cve') ? 'cve' : 'exposure',
        data,
        riskLevel,
      });

      // Increment scan count for anonymous users
      if (!user) {
        const newCount = scanCount + 1;
        localStorage.setItem(SCAN_COUNT_KEY, String(newCount));
        setScanCount(newCount);

        // Show email capture after first free scan
        if (newCount >= FREE_SCAN_LIMIT) {
          setShowEmailCapture(true);
        }
      } else {
        // Save scan for logged in users
        await fetch('/api/pubguard/scan/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: endpoint.includes('github') ? 'github' :
                  endpoint.includes('cve') ? 'cve' : 'exposure',
            target: url,
            result: data,
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setEmailSubmitting(true);

    try {
      // Send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/pubguard/scan`,
        },
      });

      if (error) throw error;

      // Also save to pubguard_users for tracking
      await supabase.from('pubguard_users').upsert({
        email,
        source: 'free_scan_conversion',
        created_at: new Date().toISOString(),
      }, { onConflict: 'email' });

      setEmailSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // Auth gate for users who've used their free scan
  if (showAuthGate && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200">
        <div className="max-w-lg mx-auto px-6 py-20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Pub</span>
              <span className="text-red-400">Guard</span>
            </h1>
            <p className="text-xl text-slate-400">You've used your free scan!</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
            {emailSuccess ? (
              <div className="text-center py-4">
                <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="text-2xl font-semibold mb-2">Check your email!</h2>
                <p className="text-slate-400 text-lg">We sent you a magic link to sign in.</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold mb-2 text-center">Create a free account</h2>
                <p className="text-slate-400 text-center mb-6">Get unlimited scans and save your reports</p>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full px-4 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-red-400 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={emailSubmitting}
                    className="w-full px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-60"
                  >
                    {emailSubmitting ? 'Sending...' : 'Continue with Email →'}
                  </button>
                </form>

                {error && (
                  <p className="text-red-400 text-center mt-4">{error}</p>
                )}
              </>
            )}
          </div>

          <p className="text-center text-slate-500 mt-6">
            No password required. We'll email you a login link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Pub</span>
            <span className="text-red-400">Guard</span>
          </h1>
          <p className="text-xl text-slate-400">
            Paste a GitHub URL to analyze security risks
          </p>
          {!user && (
            <p className="text-sm text-slate-500 mt-2">
              {scanCount === 0 ? '1 free scan available' : 'Free scan used'}
            </p>
          )}
        </div>

        {/* Scan Form */}
        <form onSubmit={handleScan} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 px-5 py-4 bg-white/5 border border-white/15 rounded-xl text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-red-400 transition-colors"
            />
            <button
              type="submit"
              disabled={scanning || (!user && scanCount >= FREE_SCAN_LIMIT)}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Scan Results</h2>
              <span className={`px-4 py-2 rounded-lg border font-semibold uppercase text-sm ${getRiskColor(result.riskLevel)}`}>
                {result.riskLevel} Risk
              </span>
            </div>

            {result.type === 'github' && result.data.analysis && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">
                    {result.data.owner}/{result.data.name}
                  </h3>
                  <p className="text-slate-400">
                    ⭐ {result.data.analysis.popularity.stars.toLocaleString()} stars •
                    🍴 {result.data.analysis.popularity.forks.toLocaleString()} forks •
                    Last commit: {result.data.analysis.age.daysSinceLastCommit} days ago
                  </p>
                </div>

                {result.data.analysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-slate-300 mb-3">⚠️ Issues Found</h4>
                    <ul className="space-y-2">
                      {result.data.analysis.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-slate-400">
                          <span className="text-yellow-500 mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <p className="text-sm text-slate-500">Security Policy</p>
                    <p className={result.data.analysis.security.hasSecurityPolicy ? 'text-green-400' : 'text-red-400'}>
                      {result.data.analysis.security.hasSecurityPolicy ? '✓ Present' : '✗ Missing'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">License</p>
                    <p className={result.data.analysis.security.hasLicense ? 'text-green-400' : 'text-yellow-400'}>
                      {result.data.analysis.security.licenseType || 'None detected'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Contributors</p>
                    <p className="text-slate-300">{result.data.analysis.maintenance.contributorCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Vulnerability Alerts</p>
                    <p className={result.data.analysis.security.vulnerabilityAlerts > 0 ? 'text-red-400' : 'text-green-400'}>
                      {result.data.analysis.security.vulnerabilityAlerts}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email Capture Modal (after free scan) */}
        {showEmailCapture && !user && !emailSuccess && (
          <div className="bg-gradient-to-r from-red-950/50 to-orange-950/50 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-semibold mb-2">🎉 Great first scan!</h3>
            <p className="text-slate-400 mb-4">
              Want to save this report and run more scans? Create a free account.
            </p>

            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="flex-1 px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-red-400 transition-colors"
              />
              <button
                type="submit"
                disabled={emailSubmitting}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-60"
              >
                {emailSubmitting ? 'Sending...' : 'Get Free Account'}
              </button>
            </form>

            {emailSuccess && (
              <p className="text-green-400 mt-3">✓ Check your email for a login link!</p>
            )}

            <button
              onClick={() => setShowEmailCapture(false)}
              className="text-slate-500 text-sm mt-3 hover:text-slate-400"
            >
              Maybe later
            </button>
          </div>
        )}

        {/* User info */}
        {user && (
          <div className="text-center text-slate-500 text-sm">
            Signed in as {user.email}
          </div>
        )}
      </div>
    </div>
  );
}