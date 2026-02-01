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
import { KiraMiniAttribution, PoweredByKira } from './KiraBranding';

/* ============================================================================
 * TYPES
 * ==========================================================================*/

type TestState = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED';

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
}

interface ScanProgress {
  currentTest: TestName | null;
  completedTests: TestName[];
  failedTests: TestName[];
  warningTests: TestName[];
  testResults: Record<string, { passed: boolean; message: string }>;
  overallProgress: number;
  status: 'running' | 'complete' | 'failed';
  trafficLight?: 'green' | 'amber' | 'red';
  riskScore?: number;
  error?: string;
}

/* ============================================================================
 * TEST CONFIG - 14 Tests in 3 Phases
 * ==========================================================================*/

const TESTS: TestConfig[] = [
  // Phase 1: Data Collection
  {
    id: 'github',
    label: 'GitHub Analysis',
    icon: <Github className="w-5 h-5" />,
    category: 'analysis',
    description: {
      PENDING: 'Waiting to start...',
      RUNNING: 'Analyzing repository, README, commits...',
      PASSED: 'Repository analyzed',
      FAILED: 'GitHub analysis failed',
      WARNING: 'Partial data retrieved',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'cve',
    label: 'CVE Database',
    icon: <Shield className="w-5 h-5" />,
    category: 'analysis',
    description: {
      PENDING: 'Waiting for GitHub analysis...',
      RUNNING: 'Searching NVD for vulnerabilities...',
      PASSED: 'No known CVEs found',
      FAILED: 'CVE search failed',
      WARNING: 'CVEs found!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'news',
    label: 'Security News',
    icon: <Newspaper className="w-5 h-5" />,
    category: 'analysis',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Scanning security news sources...',
      PASSED: 'No security warnings found',
      FAILED: 'News search failed',
      WARNING: 'Security warnings found!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'social',
    label: 'Social Signals',
    icon: <Users className="w-5 h-5" />,
    category: 'analysis',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking researcher warnings...',
      PASSED: 'No expert warnings found',
      FAILED: 'Social scan failed',
      WARNING: 'Expert warnings found!',
      SKIPPED: 'Skipped',
    },
  },

  // Phase 2: Security Tests (Expert Methodology)
  {
    id: 'test-credentials',
    label: 'Credential Storage',
    icon: <Key className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking for plaintext secrets...',
      PASSED: 'No insecure credential storage',
      FAILED: 'Test error',
      WARNING: 'Insecure credential storage detected!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-permissions',
    label: 'Permission Scope',
    icon: <Lock className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Auditing required permissions...',
      PASSED: 'Reasonable permission scope',
      FAILED: 'Test error',
      WARNING: 'Dangerous permissions required!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-injection',
    label: 'Prompt Injection Risk',
    icon: <Syringe className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Assessing injection vulnerabilities...',
      PASSED: 'Low injection risk',
      FAILED: 'Test error',
      WARNING: 'High prompt injection risk!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-supply-chain',
    label: 'Supply Chain',
    icon: <Package className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking third-party risks...',
      PASSED: 'No supply chain risks',
      FAILED: 'Test error',
      WARNING: 'Supply chain risks detected!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-config',
    label: 'Config Defaults',
    icon: <Settings className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking default configurations...',
      PASSED: 'Secure defaults',
      FAILED: 'Test error',
      WARNING: 'Insecure defaults detected!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-exposure',
    label: 'Internet Exposure',
    icon: <Globe className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Scanning for exposed instances...',
      PASSED: 'No exposed instances',
      FAILED: 'Test error',
      WARNING: 'Exposed instances found!',
      SKIPPED: 'Shodan API not configured',
    },
  },
  {
    id: 'test-identity',
    label: 'Identity Stability',
    icon: <UserCheck className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking for renames/rebrands...',
      PASSED: 'Stable project identity',
      FAILED: 'Test error',
      WARNING: 'Project has been renamed!',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'test-maintainer',
    label: 'Maintainer Response',
    icon: <Wrench className="w-5 h-5" />,
    category: 'security-test',
    description: {
      PENDING: 'Waiting...',
      RUNNING: 'Checking security issue response...',
      PASSED: 'Good maintainer responsiveness',
      FAILED: 'Test error',
      WARNING: 'Slow security response!',
      SKIPPED: 'Skipped',
    },
  },

  // Phase 3: Final
  {
    id: 'scoring',
    label: 'Risk Scoring',
    icon: <FlaskConical className="w-5 h-5" />,
    category: 'final',
    description: {
      PENDING: 'Waiting for all tests...',
      RUNNING: 'Calculating risk scores...',
      PASSED: 'Scoring complete',
      FAILED: 'Scoring failed',
      WARNING: 'Scoring complete',
      SKIPPED: 'Skipped',
    },
  },
  {
    id: 'report',
    label: 'Generate Report',
    icon: <FileText className="w-5 h-5" />,
    category: 'final',
    description: {
      PENDING: 'Waiting for scoring...',
      RUNNING: 'Building comprehensive report...',
      PASSED: 'Report ready',
      FAILED: 'Report generation failed',
      WARNING: 'Report ready',
      SKIPPED: 'Skipped',
    },
  },
];

/* ============================================================================
 * HELPERS
 * ==========================================================================*/

function getTestState(progress: ScanProgress, testId: TestName): TestState {
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
    default: return 'bg-slate-700/20 text-slate-500';
  }
}

function getStateProgress(state: TestState): number {
  switch (state) {
    case 'PASSED':
    case 'WARNING':
    case 'SKIPPED':
    case 'FAILED':
      return 100;
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
 * TEST ROW COMPONENT - The visual row for each test
 * ==========================================================================*/

function TestRow({ test, state, result }: {
  test: TestConfig;
  state: TestState;
  result?: { passed: boolean; message: string };
}) {
  const isActive = state === 'RUNNING';
  const isComplete = state === 'PASSED' || state === 'WARNING' || state === 'SKIPPED';
  const isFailed = state === 'FAILED';
  const isWarning = state === 'WARNING';

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800 last:border-0">
      {/* Icon with state color */}
      <div className={`p-2 rounded-lg ${getStateBgColor(state)} transition-all duration-300`}>
        {isComplete && !isWarning ? <CheckCircle2 className="w-5 h-5" /> :
         isWarning ? <AlertTriangle className="w-5 h-5" /> :
         isFailed ? <XCircle className="w-5 h-5" /> :
         isActive ? <Loader2 className="w-5 h-5 animate-spin" /> :
         test.icon}
      </div>

      {/* Label & Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{test.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${getStateBgColor(state)} transition-all duration-300`}>
            {state}
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
  userType?: 'writer' | 'developer' | 'user' | 'analyst';
  onComplete: (report: any) => void;
  onCancel?: () => void;
}

export default function PubGuardScanProgress({ targetUrl, userType = 'user', onComplete, onCancel }: Props) {
  const [progress, setProgress] = useState<ScanProgress>({
    currentTest: null,
    completedTests: [],
    failedTests: [],
    warningTests: [],
    testResults: {},
    overallProgress: 0,
    status: 'running',
  });
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<any>(null);

  // Run the scan with visual progress
  const runScan = useCallback(async () => {
    const testOrder: TestName[] = [
      'github', 'cve', 'news', 'social',
      'test-credentials', 'test-permissions', 'test-injection', 'test-supply-chain',
      'test-config', 'test-exposure', 'test-identity', 'test-maintainer',
      'scoring', 'report'
    ];

    try {
      // Start first test immediately for visual feedback
      setProgress(prev => ({
        ...prev,
        currentTest: 'github',
        overallProgress: 5,
      }));

      // Call the actual v2 scan API
      const response = await fetch('/api/pubguard/v2/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          userType,
          includeSocialSignals: true,
          includeSecurityTests: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Scan failed');
      }

      const reportData = await response.json();

      // Animate through tests progressively (API returns all at once, we show progress)
      for (let i = 0; i < testOrder.length; i++) {
        const testId = testOrder[i];

        // Show test as running
        setProgress(prev => ({
          ...prev,
          currentTest: testId,
          overallProgress: Math.round(((i + 0.5) / testOrder.length) * 100),
        }));

        // Delay for visual effect - faster for data collection, slower for security tests
        const delay = testId.startsWith('test-') ? 200 : 150;
        await new Promise(r => setTimeout(r, delay));

        // Determine if this test found issues
        const hasWarning = checkForWarning(testId, reportData);

        // Mark test as complete
        setProgress(prev => ({
          ...prev,
          completedTests: [...prev.completedTests, testId],
          warningTests: hasWarning ? [...prev.warningTests, testId] : prev.warningTests,
          overallProgress: Math.round(((i + 1) / testOrder.length) * 100),
        }));
      }

      // Final state
      setProgress(prev => ({
        ...prev,
        currentTest: null,
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
  }, [targetUrl, userType]);

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
          ...(report.findings?.critical || []),
          ...(report.findings?.high || []),
          ...(report.findings?.medium || []),
        ];
        return allFindings.some((f: any) =>
          f.title?.toLowerCase().includes(category) ||
          f.category?.toLowerCase().includes(category)
        );
      default:
        return false;
    }
  }

  // Start scan on mount
  useEffect(() => {
    runScan();
  }, [runScan]);

  // Elapsed time counter
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const isComplete = progress.status === 'complete';
  const isFailed = progress.status === 'failed';

  // Group tests by phase
  const analysisTasks = TESTS.filter(t => t.category === 'analysis');
  const securityTests = TESTS.filter(t => t.category === 'security-test');
  const finalTasks = TESTS.filter(t => t.category === 'final');

  // Counts for summary
  const counts = {
    passed: progress.completedTests.filter(t => !progress.warningTests.includes(t)).length,
    warnings: progress.warningTests.length,
    failed: progress.failedTests.length,
    total: TESTS.length,
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8">
      <div className="bg-slate-900 rounded-2xl p-6 md:p-8 max-w-3xl w-full shadow-2xl border border-slate-800">

        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <PoweredByKira />
          </div>
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

        {/* TRAFFIC LIGHT RESULT (shown when complete) */}
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

        {/* OVERALL PROGRESS BAR */}
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

        {/* PHASE 1: DATA COLLECTION */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            📊 Data Collection
          </h3>
          <div className="bg-slate-800/50 rounded-xl p-4">
            {analysisTasks.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* PHASE 2: SECURITY TESTS */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            🔬 Security Tests (Expert Methodology)
          </h3>
          <div className="bg-slate-800/50 rounded-xl p-4">
            {securityTests.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* PHASE 3: REPORT GENERATION */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            📋 Report Generation
          </h3>
          <div className="bg-slate-800/50 rounded-xl p-4">
            {finalTasks.map(test => (
              <TestRow
                key={test.id}
                test={test}
                state={getTestState(progress, test.id)}
                result={progress.testResults[test.id]}
              />
            ))}
          </div>
        </div>

        {/* ERROR STATE */}
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

        {/* Attribution */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <KiraMiniAttribution />
        </div>

      </div>
    </div>
  );
}