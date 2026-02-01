// app/pubguard/scan/page.tsx
// PubGuard v2 Scan Page with User-Type-Aware Experience
// Integrates: Scan API, Report Component, Kira Voice Agent, Visual Progress UI
// BRANDED: Corporate AI Solutions / Kira AI

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import PubGuardReportDisplay from '@/components/PubGuardReport';
import KiraVoiceWidget from '@/components/KiraVoiceWidget';
import PubGuardScanProgress from '@/components/PubGuardScanProgress';
import { PoweredByKira, KiraFooter, KiraCTABanner, KiraMiniAttribution } from '@/components/KiraBranding';

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

  // Kira auto-speak state
  const [shouldKiraSpeak, setShouldKiraSpeak] = useState(false);
  const hasSpokenRef = useRef(false);

  // Generate spoken summary for Kira based on report and user type
  const generateKiraSummary = useCallback((reportData: any, type: UserType): string => {
    const light = reportData.trafficLight;
    const score = reportData.overallRiskScore;
    const name = reportData.target?.name || 'this repository';
    const criticalCount = reportData.findings?.critical?.length || 0;
    const highCount = reportData.findings?.high?.length || 0;

    // Base intro varies by traffic light
    let intro = '';
    if (light === 'green') {
      intro = `Great news! ${name} looks safe. Risk score is ${score} out of 100.`;
    } else if (light === 'amber') {
      intro = `I found some concerns with ${name}. Risk score is ${score} out of 100.`;
    } else {
      intro = `Warning! ${name} has significant security issues. Risk score is ${score} out of 100.`;
    }

    // User-type specific advice
    let advice = '';
    switch (type) {
      case 'writer':
        if (light === 'green') {
          advice = `You can recommend this to your readers with confidence. I've prepared a disclaimer you can use in your article.`;
        } else if (light === 'amber') {
          advice = `If you write about this, you must disclose the risks. I've prepared required disclosures for your article.`;
        } else {
          advice = `I strongly advise against recommending this tool. The liability risk to you is significant.`;
        }
        break;
      case 'developer':
        if (criticalCount > 0 || highCount > 0) {
          advice = `Found ${criticalCount} critical and ${highCount} high severity issues. Check the Actions tab for specific fixes.`;
        } else {
          advice = `No critical issues found. Review the security checklist to ensure you're following best practices.`;
        }
        break;
      case 'user':
        if (light === 'green') {
          advice = `This software appears safe to install. Just review the permissions it requests.`;
        } else if (light === 'amber') {
          advice = `Be careful. This software has some risks. Only install if you really need it and trust the developer.`;
        } else {
          advice = `I don't recommend installing this. It could put your data or system at risk.`;
        }
        break;
      case 'analyst':
        advice = `Full technical details are in the report. ${criticalCount} critical, ${highCount} high severity findings. Check the Technical tab for CVE details and IOCs.`;
        break;
    }

    return `${intro} ${advice} Scroll down for the full report, or ask me any questions.`;
  }, []);

  // Trigger Kira to speak when report loads
  useEffect(() => {
    if (report && userType && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      setShouldKiraSpeak(true);
    }
  }, [report, userType]);

  // Reset spoken state when starting new scan
  useEffect(() => {
    if (!report) {
      hasSpokenRef.current = false;
      setShouldKiraSpeak(false);
    }
  }, [report]);

  // Start scan - just sets isScanning to true, actual scan happens in PubGuardScanProgress
  const startScan = useCallback(() => {
    if (!url || !userType) return;
    setError(null);
    setIsScanning(true);
  }, [url, userType]);

  // Handle scan completion from PubGuardScanProgress
  const handleScanComplete = useCallback((result: any) => {
    setReport(result);
    setIsScanning(false);
  }, []);

  // Handle scan cancel
  const handleScanCancel = useCallback(() => {
    setIsScanning(false);
  }, []);

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
    setIsScanning(false);
  }, []);

  // ========================================
  // STEP 1: User Type Selection
  // ========================================
  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 flex flex-col">
        <div className="flex-1 py-12">
          <div className="max-w-4xl mx-auto px-6">
            {/* Header with Branding */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <PoweredByKira />
              </div>
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

        {/* Footer */}
        <KiraFooter />
      </div>
    );
  }

  // ========================================
  // STEP 2: SCANNING - Show Visual Progress UI
  // ========================================
  if (isScanning && url && userType) {
    return (
      <PubGuardScanProgress
        targetUrl={url}
        userType={userType}
        onComplete={handleScanComplete}
        onCancel={handleScanCancel}
      />
    );
  }

  // ========================================
  // STEP 3: Show Report (if scan complete)
  // ========================================
  if (report) {
    const kiraSummary = generateKiraSummary(report, userType);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 flex flex-col">
        <div className="flex-1 py-8">
          <div className="max-w-4xl mx-auto px-6">
            {/* Header with Branding */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setUserType(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ← Change Role
                </button>
                <PoweredByKira />
              </div>
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

            {/* CTA Banner after report */}
            <div className="mt-8">
              <KiraCTABanner />
            </div>
          </div>
        </div>

        {/* Footer */}
        <KiraFooter />

        {/* Kira Voice Widget with auto-speak */}
        <KiraVoiceWidget
          userType={userType}
          sessionId={sessionId}
          onScanComplete={handleKiraScanComplete}
          autoSpeak={shouldKiraSpeak}
          autoSpeakMessage={kiraSummary}
          onAutoSpeakComplete={() => setShouldKiraSpeak(false)}
        />
      </div>
    );
  }

  // ========================================
  // STEP 4: Scan Input Form
  // ========================================
  const selectedType = USER_TYPES.find(t => t.id === userType)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 flex flex-col">
      <div className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-6">
          {/* Header with user type and branding */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="mb-3">
                <PoweredByKira />
              </div>
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
                onKeyDown={(e) => e.key === 'Enter' && url && startScan()}
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
              onClick={startScan}
              disabled={!url}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                !url
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/20'
              }`}
            >
              🛡️ Run Security Scan
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
      </div>

      {/* Footer */}
      <KiraFooter />

      {/* Kira Voice Widget */}
      <KiraVoiceWidget
        userType={userType}
        sessionId={sessionId}
        onScanComplete={handleKiraScanComplete}
      />
    </div>
  );
}