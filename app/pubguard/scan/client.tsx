// app/pubguard/scan/client.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  History,
  FileText,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react';

// Import from the Kira module
import { VoiceAgent, type KiraContext } from '@/lib/kira';
import { pubguardConfig, pubguardBaseConfig } from '../config';

// =============================================================================
// TYPES
// =============================================================================

interface PubGuardProfile {
  id: string;
  full_name: string;
  publication_name?: string;
  publication_url?: string;
}

interface RecentScan {
  id: string;
  repo_url: string;
  risk_rating: 'green' | 'amber' | 'red';
  created_at: string;
}

interface Props {
  userId: string;
  userEmail: string;
  profile: PubGuardProfile | null;
  recentScans: RecentScan[];
}

// =============================================================================
// RISK BADGE COMPONENT
// =============================================================================

function RiskBadge({ rating }: { rating: 'green' | 'amber' | 'red' }) {
  const config = {
    green: {
      icon: CheckCircle,
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      label: 'Low Risk',
    },
    amber: {
      icon: AlertTriangle,
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: 'Medium Risk',
    },
    red: {
      icon: XCircle,
      bg: 'bg-red-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      label: 'High Risk',
    },
  }[rating];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bg} ${config.border} ${config.text} border`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// =============================================================================
// MAIN CLIENT COMPONENT
// =============================================================================

export function PubGuardScanClient({ userId, userEmail, profile, recentScans }: Props) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  // Build context for the voice agent
  const context: KiraContext = {
    userId,
    userName: profile?.full_name || userEmail,
    firstName: profile?.full_name?.split(' ')[0] || userEmail.split('@')[0],
    publication: profile?.publication_name,
    publicationUrl: profile?.publication_url,
    journeyType: 'custom',
  };

  // Handle conversation start
  const handleStart = useCallback((conversationId: string) => {
    console.log('[PubGuard] Conversation started:', conversationId);
  }, []);

  // Handle conversation end
  const handleEnd = useCallback((conversationId: string, transcript: string) => {
    console.log('[PubGuard] Conversation ended:', conversationId);
    // Could trigger post-processing here
  }, []);

  // Handle scan result (from tool callback)
  const handleResult = useCallback((result: unknown) => {
    const scanResult = result as { scanId?: string; riskRating?: string };
    if (scanResult.scanId) {
      setCurrentScanId(scanResult.scanId);
      setScanComplete(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(245, 158, 11, 0.06) 0%, transparent 50%)
          `
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/pubguard')}
            className="text-stone-500 hover:text-stone-300 text-sm transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PubGuard
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-stone-400 hover:text-stone-200 text-sm transition-colors inline-flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Scan History
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">PubGuard Scanner</h1>
              <p className="text-stone-400 text-sm">Security vetting for tech writers</p>
            </div>
          </div>

          <p className="text-stone-400 max-w-lg mx-auto">
            Drop a GitHub URL or tool name and I'll run a comprehensive security assessment.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Voice Agent Panel */}
          <div className="md:col-span-2">
            <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-8">
              {/* Instructions */}
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-200 font-medium mb-1">How it works:</p>
                    <ol className="text-red-200/70 text-sm space-y-1 list-decimal list-inside">
                      <li>Tell me what tool you want to check</li>
                      <li>I'll scan GitHub, CVE databases, and security news</li>
                      <li>You'll get a risk rating: 🟢 🟡 or 🔴</li>
                      <li>Optional: Generate a PDF report for your records</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Voice Agent */}
              <VoiceAgent
                config={pubguardConfig}
                baseConfig={pubguardBaseConfig}
                context={context}
                onStart={handleStart}
                onEnd={handleEnd}
                onResult={handleResult}
                autoConnect={false}
                showTranscript={true}
                className="mb-6"
              />

              {/* Scan Complete Actions */}
              {scanComplete && currentScanId && (
                <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Scan Complete</span>
                    </div>
                    <button
                      onClick={() => router.push(`/pubguard/report/${currentScanId}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-stone-400 mb-4">Your Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 text-sm">Total Scans</span>
                  <span className="text-white font-medium">{recentScans.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 text-sm">Green Ratings</span>
                  <span className="text-green-400 font-medium">
                    {recentScans.filter(s => s.risk_rating === 'green').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500 text-sm">Red Flags</span>
                  <span className="text-red-400 font-medium">
                    {recentScans.filter(s => s.risk_rating === 'red').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Scans */}
            {recentScans.length > 0 && (
              <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-stone-400 mb-4">Recent Scans</h3>
                <div className="space-y-3">
                  {recentScans.slice(0, 5).map((scan) => {
                    // Extract repo name from URL
                    const repoName = scan.repo_url.split('/').slice(-2).join('/');

                    return (
                      <button
                        key={scan.id}
                        onClick={() => router.push(`/pubguard/report/${scan.id}`)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-stone-800/50 hover:bg-stone-800 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {repoName}
                          </p>
                          <p className="text-stone-500 text-xs">
                            {new Date(scan.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <RiskBadge rating={scan.risk_rating} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pro Tip */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-amber-400 mb-2">💡 Pro Tip</h3>
              <p className="text-amber-200/70 text-sm">
                Always mention how you plan to use the tool — context helps me give better recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}