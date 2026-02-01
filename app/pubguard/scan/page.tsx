// app/pubguard/scan/page.tsx
// PubGuard v2 Scan Page with User-Type-Aware Experience
// Integrates: Scan API, Report Component, Kira Voice Agent

'use client';

import { useState, useCallback } from 'react';
import PubGuardReportDisplay from '@/components/PubGuardReport';
import KiraVoiceWidget from '@/components/KiraVoiceWidget';

type UserType = 'writer' | 'developer' | 'user' | 'analyst';

// User type configuration for the selection UI
const USER_TYPES: { id: UserType; label: string; icon: string; description: string; color: string }[] = [
  {
    id: 'writer',
    label: 'Tech Writer',
    icon: '✏️',
    description: 'Vet tools before recommending to readers',
    color: 'purple',
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: '💻',
    description: 'Audit code and get actionable fixes',
    color: 'blue',
  },
  {
    id: 'user',
    label: 'User',
    icon: '👤',
    description: 'Check if software is safe to install',
    color: 'green',
  },
  {
    id: 'analyst',
    label: 'Security Analyst',
    icon: '🔍',
    description: 'Full technical security assessment',
    color: 'amber',
  },
];

export default function PubGuardScanPage() {
  // State
  const [userType, setUserType] = useState<UserType | null>(null);
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Run scan
  const runScan = useCallback(async () => {
    if (!url || !userType) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/pubguard/v2/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          userType,
          sessionId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Scan failed');
      }

      const result = await response.json();
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }, [url, userType, sessionId]);

  // Handle Kira scan completion
  const handleKiraScanComplete = useCallback((result: any) => {
    if (result?.trafficLight) {
      setReport(result);
    }
  }, []);

  // Reset to start new scan
  const resetScan = useCallback(() => {
    setReport(null);
    setUrl('');
    setError(null);
  }, []);

  // ========================================
  // STEP 1: User Type Selection
  // ========================================
  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 py-12">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              <span className="text-white">Pub</span>
              <span className="text-red-500">Guard</span>
            </h1>
            <p className="text-xl text-slate-400">Security Scanner powered by Kira AI</p>
          </div>

          {/* User Type Selection */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white text-center mb-2">Who are you?</h2>
            <p className="text-slate-400 text-center mb-8">
              We'll customize the scan results and Kira's responses for your needs
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {USER_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setUserType(type.id)}
                  className={`p-6 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
                    type.color === 'purple'
                      ? 'border-purple-500/30 hover:border-purple-500 hover:bg-purple-500/10'
                      : type.color === 'blue'
                      ? 'border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10'
                      : type.color === 'green'
                      ? 'border-green-500/30 hover:border-green-500 hover:bg-green-500/10'
                      : 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10'
                  } bg-white/[0.02]`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{type.icon}</span>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">{type.label}</h3>
                      <p className="text-slate-400">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Skip option */}
          <p className="text-center text-slate-500 text-sm">
            Not sure?{' '}
            <button
              onClick={() => setUserType('user')}
              className="text-slate-400 hover:text-white underline"
            >
              Continue as User
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ========================================
  // STEP 2: Show Report (if scan complete)
  // ========================================
  if (report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 py-8">
        <div className="max-w-4xl mx-auto px-6">
          {/* Back / Change User Type */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setUserType(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ← Change Role
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Viewing as:</span>
              <span className={`px-3 py-1 rounded-full ${
                userType === 'writer' ? 'bg-purple-500/20 text-purple-400' :
                userType === 'developer' ? 'bg-blue-500/20 text-blue-400' :
                userType === 'user' ? 'bg-green-500/20 text-green-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {USER_TYPES.find(t => t.id === userType)?.icon} {USER_TYPES.find(t => t.id === userType)?.label}
              </span>
            </div>
          </div>

          {/* Report */}
          <PubGuardReportDisplay
            report={report}
            userType={userType}
            onNewScan={resetScan}
          />
        </div>

        {/* Kira Voice Widget */}
        <KiraVoiceWidget
          userType={userType}
          sessionId={sessionId}
          onScanComplete={handleKiraScanComplete}
        />
      </div>
    );
  }

  // ========================================
  // STEP 3: Scan Input
  // ========================================
  const selectedType = USER_TYPES.find(t => t.id === userType)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 py-12">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header with user type */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-white">Pub</span>
              <span className="text-red-500">Guard</span>
            </h1>
            <p className="text-slate-400">Security Scanner</p>
          </div>
          <button
            onClick={() => setUserType(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
              userType === 'writer' ? 'border-purple-500/50 bg-purple-500/10 text-purple-400' :
              userType === 'developer' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' :
              userType === 'user' ? 'border-green-500/50 bg-green-500/10 text-green-400' :
              'border-amber-500/50 bg-amber-500/10 text-amber-400'
            }`}
          >
            <span>{selectedType.icon}</span>
            <span>{selectedType.label}</span>
            <span className="text-slate-500 text-xs ml-1">Change</span>
          </button>
        </div>

        {/* Scan Form */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-2">
            {userType === 'writer' && '📝 Check before you publish'}
            {userType === 'developer' && '🔧 Audit before you ship'}
            {userType === 'user' && '🛡️ Check before you install'}
            {userType === 'analyst' && '🔍 Full security assessment'}
          </h2>
          <p className="text-slate-400 mb-6">
            {userType === 'writer' && 'Enter a GitHub URL to vet a tool before recommending it to your readers.'}
            {userType === 'developer' && 'Enter your repository URL to get actionable security feedback.'}
            {userType === 'user' && 'Enter a GitHub URL to see if the software is safe.'}
            {userType === 'analyst' && 'Enter a target URL for comprehensive security analysis.'}
          </p>

          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">GitHub Repository URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Scan Button */}
          <button
            onClick={runScan}
            disabled={!url || isScanning}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
              !url || isScanning
                ? 'bg-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/20'
            }`}
          >
            {isScanning ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </span>
            ) : (
              '🛡️ Run Security Scan'
            )}
          </button>

          {/* Voice Alternative */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-slate-500 text-sm mb-3">Or talk to Kira</p>
            <p className="text-slate-400 text-xs">
              Click the voice button in the corner to scan with voice commands
            </p>
          </div>
        </div>

        {/* Example URLs */}
        <div className="mt-8">
          <p className="text-slate-500 text-sm mb-3">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'https://github.com/facebook/react',
              'https://github.com/vercel/next.js',
              'https://github.com/anthropics/anthropic-sdk-python',
            ].map((exampleUrl) => (
              <button
                key={exampleUrl}
                onClick={() => setUrl(exampleUrl)}
                className="px-3 py-1 bg-white/5 rounded-full text-xs text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                {exampleUrl.split('/').slice(-2).join('/')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kira Voice Widget */}
      <KiraVoiceWidget
        userType={userType}
        sessionId={sessionId}
        onScanComplete={handleKiraScanComplete}
      />
    </div>
  );
}