// components/PubGuardScanProgress.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Github,
  Shield,
  Newspaper,
  Users,
  FlaskConical,
  FileText,
  AlertTriangle,
  Clock,
  Search,
  Key,
  Lock,
  Syringe,
  Package,
  Settings,
  Globe,
  UserCheck,
  Wrench,
} from 'lucide-react';

/* ============================================================================
 * TYPES
 * ==========================================================================*/

type TestState = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED' | 'PRIVATE';

type TestName =
  | 'github'
  | 'cve'
  | 'news'
  | 'social'
  | 'test-credentials'
  | 'test-permissions'
  | 'test-injection'
  | 'test-supply-chain'
  | 'test-config'
  | 'test-exposure'
  | 'test-identity'
  | 'test-maintainer'
  | 'scoring'
  | 'report';

interface TestConfig {
  id: TestName;
  label: string;
  icon: React.ReactNode;
  category: 'analysis' | 'security-test' | 'final';
  description: Record<TestState, string>;
  requiresRepoAccess?: boolean;  // True if test needs to read repo files
}

interface ScanProgress {
  currentTest: TestName | null;
  completedTests: TestName[];
  failedTests: TestName[];
  warningTests: TestName[];
  skippedTests: TestName[];  // For private repo skipped tests
  testResults: Record<string, { passed: boolean; message: string }>;
  overallProgress: number;
  status: 'running' | 'complete' | 'failed';
  trafficLight?: 'green' | 'amber' | 'red';
  riskScore?: number;
  error?: string;
  isPrivateRepo?: boolean;
}

/* ============================================================================
 * TEST CONFIG
 * ==========================================================================*/

const TESTS: TestConfig[] = [
  // Analysis Phase
  {
    id: 'github',
    label: 'GitHub Analysis',
    icon: <Github className="w-5 h-5" />,
    category: 'analysis',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting to start...',
      RUNNING: 'Analyzing repository, README, commits...',
      PASSED: 'Repository analyzed',
      FAILED: 'GitHub analysis failed',
      WARNING: 'Partial data retrieved',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot access',
    },
  },
  {
    id: 'cve',
    label: 'CVE Database',
    icon: <Shield className="w-5 h-5" />,
    category: 'analysis',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting for GitHub analysis...',
      RUNNING: 'Searching NVD for vulnerabilities...',
      PASSED: 'No known CVEs found',
      FAILED: 'CVE search failed',
      WARNING: 'CVEs found!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Searching by project name...',
    },
  },
  {
    id: 'news',
    label: 'Security News',
    icon: <Newspaper className="w-5 h-5" />,
    category: 'analysis',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Scanning security news sources...',
      PASSED: 'No security warnings found',
      FAILED: 'News search failed',
      WARNING: 'Security warnings found!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Scanning news sources...',
    },
  },
  {
    id: 'social',
    label: 'Social Signals',
    icon: <Users className="w-5 h-5" />,
    category: 'analysis',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking researcher warnings...',
      PASSED: 'No expert warnings found',
      FAILED: 'Social scan failed',
      WARNING: 'Expert warnings found!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Checking researcher warnings...',
    },
  },

  // Security Tests (Expert Methodology)
  {
    id: 'test-credentials',
    label: 'Credential Storage',
    icon: <Key className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking for plaintext secrets...',
      PASSED: 'No insecure credential storage',
      FAILED: 'Test error',
      WARNING: 'Insecure credential storage detected!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-permissions',
    label: 'Permission Scope',
    icon: <Lock className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Auditing required permissions...',
      PASSED: 'Reasonable permission scope',
      FAILED: 'Test error',
      WARNING: 'Dangerous permissions required!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-injection',
    label: 'Prompt Injection Risk',
    icon: <Syringe className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Assessing injection vulnerabilities...',
      PASSED: 'Low injection risk',
      FAILED: 'Test error',
      WARNING: 'High prompt injection risk!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-supply-chain',
    label: 'Supply Chain',
    icon: <Package className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking third-party risks...',
      PASSED: 'No supply chain risks',
      FAILED: 'Test error',
      WARNING: 'Supply chain risks detected!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-config',
    label: 'Config Defaults',
    icon: <Settings className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking default configurations...',
      PASSED: 'Secure defaults',
      FAILED: 'Test error',
      WARNING: 'Insecure defaults detected!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-exposure',
    label: 'Internet Exposure',
    icon: <Globe className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Scanning for exposed instances...',
      PASSED: 'No exposed instances',
      FAILED: 'Test error',
      WARNING: 'Exposed instances found!',
      SKIPPED: 'Shodan API not configured',
      PRIVATE: 'Scanning for exposed instances...',
    },
  },
  {
    id: 'test-identity',
    label: 'Identity Stability',
    icon: <UserCheck className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking for renames/rebrands...',
      PASSED: 'Stable project identity',
      FAILED: 'Test error',
      WARNING: 'Project has been renamed!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },
  {
    id: 'test-maintainer',
    label: 'Maintainer Response',
    icon: <Wrench className="w-5 h-5" />,
    category: 'security-test',
    requiresRepoAccess: true,
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking security issue response...',
      PASSED: 'Good maintainer responsiveness',
      FAILED: 'Test error',
      WARNING: 'Slow security response!',
      SKIPPED: 'Skipped',
      PRIVATE: 'Private repo - cannot analyze',
    },
  },

  // Final Phase
  {
    id: 'scoring',
    label: 'Risk Scoring',
    icon: <FlaskConical className="w-5 h-5" />,
    category: 'final',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting for all tests...',
      RUNNING: 'Calculating risk scores...',
      PASSED: 'Scoring complete',
      FAILED: 'Scoring failed',
      WARNING: 'Scoring complete',
      SKIPPED: 'Skipped',
      PRIVATE: 'Limited scoring (private repo)',
    },
  },
  {
    id: 'report',
    label: 'Generate Report',
    icon: <FileText className="w-5 h-5" />,
    category: 'final',
    requiresRepoAccess: false,
    description: {
      PENDING: 'Waiting for scoring...',
      RUNNING: 'Building comprehensive report...',
      PASSED: 'Report ready',
      FAILED: 'Report generation failed',
      WARNING: 'Report ready',
      SKIPPED: 'Skipped',
      PRIVATE: 'Limited report (private repo)',
    },
  },
];

/* ============================================================================
 * HELPERS
 * ==========================================================================*/

function getTestState(progress: ScanProgress, testId: TestName, testConfig: TestConfig): TestState {
  // Check if this test was skipped due to private repo
  if (progress.isPrivateRepo && testConfig.requiresRepoAccess) {
    if (progress.skippedTests?.includes(testId)) return 'PRIVATE';
    // If we haven't processed it yet but repo is private, show PRIVATE
    if (!progress.completedTests.includes(testId) && 
        !progress.failedTests.includes(testId) && 
        progress.currentTest !== testId) {
      return 'PRIVATE';
    }
  }
  
  if (progress.skippedTests?.includes(testId)) return 'SKIPPED';
  if (progress.failedTests.includes(testId)) return 'FAILED';
  if (progress.warningTests.includes(testId)) return 'WARNING';
  if (progress.completedTests.includes(testId)) return 'PASSED';
  if (progress.currentTest === testId) return 'RUNNING';
  return 'PENDING';
}

function getStateColor(state: TestState): string {
  switch (state) {
    case 'PASSED': return 'bg-emerald-500';
    case 'FAILED': return 'bg-red-500';
    case 'WARNING': return 'bg-amber-500';
    case 'RUNNING': return 'bg-blue-500';
    case 'SKIPPED': return 'bg-slate-600';
    case 'PRIVATE': return 'bg-purple-600';
    default: return 'bg-slate-700';
  }
}

function getStateBgColor(state: TestState): string {
  switch (state) {
    case 'PASSED': return 'bg-emerald-500/20 text-emerald-400';
    case 'FAILED': return 'bg-red-500/20 text-red-400';
    case 'WARNING': return 'bg-amber-500/20 text-amber-400';
    case 'RUNNING': return 'bg-blue-500/20 text-blue-400';
    case 'SKIPPED': return 'bg-slate-600/20 text-slate-500';
    case 'PRIVATE': return 'bg-purple-600/20 text-purple-400';
    default: return 'bg-slate-700/20 text-slate-500';
  }
}

function getStateProgress(state: TestState): number {
  switch (state) {
    case 'PASSED':
    case 'WARNING':
    case 'SKIPPED':
    case 'PRIVATE':
      return 100;
    case 'FAILED': return 100;
    case 'RUNNING': return 50;
    default: return 0;
  }
}

function getTrafficLightEmoji(light: 'green' | 'amber' | 'red'): string {
  switch (light) {
    case 'green': return '🟢';
    case 'amber': return '🟠';
    case 'red': return '🔴';
  }
}

function getTrafficLightColor(light: 'green' | 'amber' | 'red'): string {
  switch (light) {
    case 'green': return 'from-emerald-500 to-green-500';
    case 'amber': return 'from-amber-500 to-orange-500';
    case 'red': return 'from-red-500 to-rose-500';
  }
}

/* ============================================================================
 * TEST ROW COMPONENT
 * ==========================================================================*/

function TestRow({ test, state, result }: { 
  test: TestConfig; 
  state: TestState;
  result?: { passed: boolean; message: string };
}) {
  const isActive = state === 'RUNNING';
  const isComplete = state === 'PASSED' || state === 'WARNING' || state === 'SKIPPED' || state === 'PRIVATE';
  const isFailed = state === 'FAILED';
  const isWarning = state === 'WARNING';
  const isPrivate = state === 'PRIVATE';

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800 last:border-0">
      {/* Icon */}
      <div className={`p-2 rounded-lg ${getStateBgColor(state)}`}>
        {isPrivate ? <Lock className="w-5 h-5" /> :
         isComplete && !isWarning ? <CheckCircle2 className="w-5 h-5" /> :
         isWarning ? <AlertTriangle className="w-5 h-5" /> :
         isFailed ? <XCircle className="w-5 h-5" /> :
         isActive ? <Loader2 className="w-5 h-5 animate-spin" /> :
         test.icon}
      </div>

      {/* Label & Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isPrivate ? 'text-slate-400' : 'text-white'}`}>{test.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getStateBgColor(state)}`}>
            {isPrivate ? 'PRIVATE' : state}
          </span>
        </div>
        <p className="text-sm text-slate-400 truncate">
          {result?.message || test.description[state]}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getStateColor(state)}`}
          style={{ width: `${getStateProgress(state)}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ==========================================================================*/

interface Props {
  targetUrl: string;
  onComplete: (report: any) => void;
  onCancel?: () => void;
}

export default function PubGuardScanProgress({ targetUrl, onComplete, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>({
    currentTest: null,
    completedTests: [],
    failedTests: [],
    warningTests: [],
    skippedTests: [],
    testResults: {},
    overallProgress: 0,
    status: 'running',
    isPrivateRepo: false,
  });
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<any>(null);

  // Simulate scan progress (in real implementation, this would poll an API or use SSE)
  const runScan = useCallback(async () => {
    const testOrder: TestName[] = [
      'github', 'cve', 'news', 'social',
      'test-credentials', 'test-permissions', 'test-injection', 'test-supply-chain',
      'test-config', 'test-exposure', 'test-identity', 'test-maintainer',
      'scoring', 'report'
    ];

    try {
      // Call the actual v2 scan API
      const response = await fetch('/api/pubguard/v2/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: targetUrl,
          includeSocialSignals: true,
          includeSecurityTests: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Scan failed');
      }

      const reportData = await response.json();
      
      // Simulate progressive updates for UX (the API returns all at once)
      for (let i = 0; i < testOrder.length; i++) {
        const testId = testOrder[i];
        
        setProgress(prev => ({
          ...prev,
          currentTest: testId,
          overallProgress: Math.round((i / testOrder.length) * 100),
        }));

        // Small delay for visual effect
        await new Promise(r => setTimeout(r, 150));

        // Determine if this test found issues
        const hasWarning = checkForWarning(testId, reportData);
        
        setProgress(prev => ({
          ...prev,
          completedTests: [...prev.completedTests, testId],
          warningTests: hasWarning ? [...prev.warningTests, testId] : prev.warningTests,
          currentTest: i < testOrder.length - 1 ? testOrder[i + 1] : null,
        }));
      }

      // Complete
      setProgress(prev => ({
        ...prev,
        status: 'complete',
        overallProgress: 100,
        trafficLight: reportData.trafficLight,
        riskScore: reportData.overallRiskScore,
      }));
      
      setReport(reportData);

    } catch (error) {
      setProgress(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Scan failed',
      }));
    }
  }, [targetUrl]);

  // Check if a test found warnings based on report data
  function checkForWarning(testId: TestName, report: any): boolean {
    switch (testId) {
      case 'cve':
        return report.cve?.totalFound > 0;
      case 'news':
        return report.news?.securityWarnings?.length > 0;
      case 'social':
        return report.social?.securityResearcherWarnings?.length > 0;
      case 'test-credentials':
      case 'test-permissions':
      case 'test-injection':
      case 'test-supply-chain':
      case 'test-config':
      case 'test-exposure':
      case 'test-identity':
      case 'test-maintainer':
        // Check findings for this category
        const category = testId.replace('test-', '');
        const allFindings = [
          ...report.findings.critical,
          ...report.findings.high,
          ...report.findings.medium,
        ];
        return allFindings.some((f: any) => 
          f.title?.toLowerCase().includes(category) || 
          f.category?.toLowerCase().includes(category)
        );
      default:
        return false;
    }
  }

  useEffect(() => {
    runScan();
  }, [runScan]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const isComplete = progress.status === 'complete';
  const isFailed = progress.status === 'failed';

  const analysisTasks = TESTS.filter(t => t.category === 'analysis');
  const securityTests = TESTS.filter(t => t.category === 'security-test');
  const finalTasks = TESTS.filter(t => t.category === 'final');

  const counts = {
    passed: progress.completedTests.filter(t => !progress.warningTests.includes(t)).length,
    warnings: progress.warningTests.length,
    failed: progress.failedTests.length,
    total: TESTS.length,
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="bg-slate-900 rounded-2xl p-8 max-w-3xl w-full">

        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Search className="w-8 h-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">
              {isComplete 
                ? `${getTrafficLightEmoji(progress.trafficLight!)} Scan Complete` 
                : isFailed 
                  ? '❌ Scan Failed' 
                  : '🔍 Scanning...'}
            </h1>
          </div>
          <p className="text-slate-400 font-mono text-sm truncate max-w-md mx-auto">
            {targetUrl}
          </p>
        </div>

        {/* TRAFFIC LIGHT RESULT */}
        {isComplete && progress.trafficLight && (
          <div className={`mb-6 p-6 rounded-xl bg-gradient-to-r ${getTrafficLightColor(progress.trafficLight)} bg-opacity-20`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl mb-2">{getTrafficLightEmoji(progress.trafficLight)}</div>
                <h2 className="text-xl font-bold text-white uppercase">{progress.trafficLight}</h2>
                <p className="text-white/80 text-sm">
                  {progress.trafficLight === 'green' && 'Safe to recommend'}
                  {progress.trafficLight === 'amber' && 'Proceed with caution'}
                  {progress.trafficLight === 'red' && 'Do not recommend'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-white">{progress.riskScore}</div>
                <div className="text-white/60 text-sm">Risk Score</div>
              </div>
            </div>
          </div>
        )}

        {/* OVERALL PROGRESS */}
        {!isComplete && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(elapsed)}
                </span>
                <span>{progress.completedTests.length}/{TESTS.length} tests</span>
              </div>
              <span className="text-white font-medium">{progress.overallProgress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-red-500 to-amber-500'
                }`}
                style={{ width: `${progress.overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* STATUS SUMMARY */}
        {!isFailed && (
          <div className="flex gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-400">{counts.passed} Passed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-400">{counts.warnings} Warnings</span>
            </div>
            {counts.failed > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-slate-400">{counts.failed} Failed</span>
              </div>
            )}
          </div>
        )}

        {/* ANALYSIS PHASE */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            📊 Data Collection
          </h3>
          <div className="bg-slate-800/50 rounded-xl p-4">
            {analysisTasks.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id, test)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* SECURITY TESTS */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            🔬 Security Tests (Expert Methodology)
          </h3>
          {progress.isPrivateRepo && (
            <div className="mb-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-sm text-purple-300">
                🔒 <strong>Private Repository:</strong> Source code analysis tests cannot be performed. Only external checks (CVE, News, Exposure) are available.
              </p>
            </div>
          )}
          <div className="bg-slate-800/50 rounded-xl p-4">
            {securityTests.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id, test)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* FINAL PHASE */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            📋 Report Generation
          </h3>
          <div className="bg-slate-800/50 rounded-xl p-4">
            {finalTasks.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id, test)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* ERROR */}
        {isFailed && progress.error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
            <p className="font-medium">Scan Failed</p>
            <p className="text-sm">{progress.error}</p>
          </div>
        )}

        {/* ACTION BUTTONS */}
        {isComplete && report && (
          <button
            onClick={() => onComplete(report)}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
          >
            <FileText className="w-5 h-5" />
            View Full Report
          </button>
        )}

        {!isComplete && !isFailed && onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            Cancel Scan
          </button>
        )}

        {isFailed && (
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
            >
              Try Again
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
