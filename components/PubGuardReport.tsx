// components/PubGuardReport.tsx
// User-type-aware report display component for PubGuard v2
// Customizes content and emphasis based on: writer | developer | user | analyst

'use client';

import { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

type TrafficLight = 'green' | 'amber' | 'red';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type UserType = 'writer' | 'developer' | 'user' | 'analyst';

interface Finding {
  severity: RiskLevel;
  category: string;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  date?: string;
}

interface RiskCategory {
  name: string;
  description: string;
  score: number;
  weight: number;
  weightedScore: number;
  factors: string[];
}

interface SourceCheck {
  name: string;
  searched: string[];
  found: number;
  status: 'success' | 'partial' | 'failed';
  timestamp: string;
}

interface WriterGuidance {
  canRecommend: boolean;
  mustDisclose: string[];
  suggestedDisclaimer: string;
  keyPointsToMention: string[];
  alternativesToConsider: string[];
}

interface PubGuardReport {
  id: string;
  version: string;
  generatedAt: string;
  target: { url: string; name: string; type: string };
  trafficLight: TrafficLight;
  recommendation: string;
  overallRiskScore: number;
  riskCategories: RiskCategory[];
  sourcesChecked: SourceCheck[];
  searchTermsUsed: string[];
  findings: {
    critical: Finding[];
    high: Finding[];
    medium: Finding[];
    low: Finding[];
    positive: Finding[];
  };
  github?: any;
  cve?: any;
  news?: any;
  social?: any;
  securityTests?: any;
  writerGuidance: WriterGuidance;
  disclaimer: string;
  reportHash: string;
}

interface Props {
  report: PubGuardReport;
  userType: UserType;
  onNewScan?: () => void;
}

// ============================================================================
// USER TYPE CONFIGURATION
// ============================================================================

const USER_TYPE_CONFIG: Record<UserType, {
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  primaryTabs: string[];
  hiddenTabs: string[];
  showTechnicalDetails: boolean;
  showWriterGuidance: boolean;
  showDeveloperActions: boolean;
  showUserSafety: boolean;
  emphasizeCategories: string[];
  summaryFocus: string;
}> = {
  writer: {
    title: 'Tech Writer',
    icon: '✏️',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    primaryTabs: ['summary', 'guidance', 'findings'],
    hiddenTabs: ['technical'],
    showTechnicalDetails: false,
    showWriterGuidance: true,
    showDeveloperActions: false,
    showUserSafety: false,
    emphasizeCategories: ['News & Expert Warnings', 'Velocity Risk'],
    summaryFocus: 'Can I recommend this to my readers?',
  },
  developer: {
    title: 'Developer',
    icon: '💻',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    primaryTabs: ['summary', 'findings', 'actions', 'sources'],
    hiddenTabs: ['guidance'],
    showTechnicalDetails: true,
    showWriterGuidance: false,
    showDeveloperActions: true,
    showUserSafety: false,
    emphasizeCategories: ['Architecture Risk', 'Active Vulnerabilities', 'Maintainer Response'],
    summaryFocus: 'What should I fix before shipping?',
  },
  user: {
    title: 'User',
    icon: '👤',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    primaryTabs: ['safety', 'summary', 'findings'],
    hiddenTabs: ['guidance', 'technical', 'actions'],
    showTechnicalDetails: false,
    showWriterGuidance: false,
    showDeveloperActions: false,
    showUserSafety: true,
    emphasizeCategories: ['Architecture Risk', 'Active Vulnerabilities'],
    summaryFocus: 'Is this safe to install?',
  },
  analyst: {
    title: 'Security Analyst',
    icon: '🔍',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    primaryTabs: ['summary', 'findings', 'technical', 'sources'],
    hiddenTabs: ['guidance', 'safety'],
    showTechnicalDetails: true,
    showWriterGuidance: false,
    showDeveloperActions: false,
    showUserSafety: false,
    emphasizeCategories: ['Active Vulnerabilities', 'Architecture Risk', 'News & Expert Warnings'],
    summaryFocus: 'Full security assessment',
  },
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const TrafficLightIcon = ({ light }: { light: TrafficLight }) => {
  const colors = {
    green: { bg: 'bg-green-500', glow: 'shadow-green-500/50', text: 'text-green-500' },
    amber: { bg: 'bg-amber-500', glow: 'shadow-amber-500/50', text: 'text-amber-500' },
    red: { bg: 'bg-red-500', glow: 'shadow-red-500/50', text: 'text-red-500' },
  };
  const c = colors[light];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-20 h-20 rounded-full ${c.bg} ${c.glow} shadow-lg flex items-center justify-center`}>
        <span className="text-4xl">
          {light === 'green' ? '✓' : light === 'amber' ? '⚠' : '✕'}
        </span>
      </div>
      <span className={`text-2xl font-bold uppercase ${c.text}`}>{light}</span>
    </div>
  );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded border uppercase ${colors[severity] || colors.low}`}>
      {severity}
    </span>
  );
};

const RiskCategoryCard = ({ category, emphasized }: { category: RiskCategory; emphasized: boolean }) => {
  const scoreColor = category.score >= 70 ? 'text-red-400' :
                     category.score >= 40 ? 'text-amber-400' : 'text-green-400';

  return (
    <div className={`bg-white/[0.02] border rounded-xl p-4 ${
      emphasized ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-white/10'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-white flex items-center gap-2">
            {category.name}
            {emphasized && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Key for you</span>}
          </h4>
          <p className="text-sm text-slate-500">{category.description}</p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${scoreColor}`}>{category.score}</span>
          <span className="text-slate-500 text-sm">/100</span>
          <p className="text-xs text-slate-600">Weight: {(category.weight * 100).toFixed(0)}%</p>
        </div>
      </div>
      {category.factors.length > 0 && (
        <ul className="space-y-1">
          {category.factors.map((factor, i) => (
            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
              <span className={factor.startsWith('(Mitigated)') ? 'text-green-500' : 'text-slate-500'}>•</span>
              {factor}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FindingCard = ({ finding, compact = false }: { finding: Finding; compact?: boolean }) => (
  <div className={`bg-white/[0.02] border border-white/10 rounded-lg ${compact ? 'p-3' : 'p-4'}`}>
    <div className="flex items-start justify-between gap-3 mb-2">
      <h5 className={`font-medium text-white ${compact ? 'text-sm' : ''}`}>{finding.title}</h5>
      <SeverityBadge severity={finding.severity} />
    </div>
    <p className={`text-slate-400 mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>{finding.description}</p>
    <div className={`flex items-center gap-2 text-slate-500 ${compact ? 'text-xs' : 'text-xs'}`}>
      <span>Source: {finding.source}</span>
      {finding.sourceUrl && (
        <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          View →
        </a>
      )}
    </div>
  </div>
);

// ============================================================================
// USER-TYPE SPECIFIC SECTIONS
// ============================================================================

// WRITER: Guidance tab with liability focus
const WriterGuidanceTab = ({ report }: { report: PubGuardReport }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-white mb-4">✏️ Writer Guidance</h3>

    {/* Can Recommend? */}
    <div className={`rounded-xl p-4 ${
      report.writerGuidance.canRecommend 
        ? 'bg-green-500/10 border border-green-500/30' 
        : 'bg-red-500/10 border border-red-500/30'
    }`}>
      <h4 className={`font-semibold text-lg ${report.writerGuidance.canRecommend ? 'text-green-400' : 'text-red-400'}`}>
        {report.writerGuidance.canRecommend ? '✓ Can recommend with disclosures' : '✕ Do not recommend'}
      </h4>
      <p className="text-slate-400 text-sm mt-1">
        {report.writerGuidance.canRecommend
          ? 'You may write about this tool, but must include the disclosures below.'
          : 'The risks are too high to recommend this tool to your readers.'}
      </p>
    </div>

    {/* Must Disclose */}
    {report.writerGuidance.mustDisclose.length > 0 && (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-amber-400 mb-3">⚠️ Must Disclose to Readers</h4>
        <ul className="space-y-2">
          {report.writerGuidance.mustDisclose.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-300">
              <span className="text-amber-500 mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Suggested Disclaimer */}
    <div>
      <h4 className="text-lg font-semibold text-white mb-3">📋 Copy-Paste Disclaimer</h4>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
        <p className="text-slate-300 italic text-sm leading-relaxed">{report.writerGuidance.suggestedDisclaimer}</p>
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(report.writerGuidance.suggestedDisclaimer)}
        className="mt-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
      >
        📋 Copy Disclaimer
      </button>
    </div>

    {/* Key Points */}
    {report.writerGuidance.keyPointsToMention.length > 0 && (
      <div>
        <h4 className="text-lg font-semibold text-white mb-3">💡 Key Points for Your Article</h4>
        <ul className="space-y-2">
          {report.writerGuidance.keyPointsToMention.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-300">
              <span className="text-blue-500 mt-1">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Liability Warning */}
    <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-red-400 mb-2">⚖️ Liability Reminder</h4>
      <p className="text-xs text-red-300/80 leading-relaxed">
        Recommending software that causes harm to readers (credential theft, data loss, financial damage)
        can expose you to legal action. This report documents your due diligence but does not constitute
        legal advice. When in doubt, consult with legal counsel before publishing.
      </p>
    </div>
  </div>
);

// DEVELOPER: Actionable fixes tab
const DeveloperActionsTab = ({ report }: { report: PubGuardReport }) => {
  const allFindings = [
    ...report.findings.critical,
    ...report.findings.high,
    ...report.findings.medium,
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white mb-4">💻 Development Actions</h3>

      {/* Priority Fixes */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-blue-400 mb-3">🔧 Priority Fixes Before Release</h4>
        {allFindings.length === 0 ? (
          <p className="text-green-400">✓ No critical or high-severity issues found!</p>
        ) : (
          <div className="space-y-3">
            {allFindings.slice(0, 5).map((finding, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                <span className={`text-lg ${
                  finding.severity === 'critical' ? 'text-red-400' : 
                  finding.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'
                }`}>
                  {finding.severity === 'critical' ? '🚨' : finding.severity === 'high' ? '⚠️' : '📋'}
                </span>
                <div>
                  <p className="text-white font-medium">{finding.title}</p>
                  <p className="text-slate-400 text-sm">{finding.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Checklist */}
      <div>
        <h4 className="text-lg font-semibold text-white mb-3">✅ Security Checklist</h4>
        <div className="grid gap-2">
          {[
            { check: report.github?.hasSecurityPolicy, label: 'SECURITY.md file', action: 'Add responsible disclosure policy' },
            { check: report.github?.hasCodeOfConduct, label: 'CODE_OF_CONDUCT.md', action: 'Add community guidelines' },
            { check: report.github?.hasContributing, label: 'CONTRIBUTING.md', action: 'Add contribution guidelines' },
            { check: !report.github?.permissions?.credentialStorage, label: 'No plaintext credentials', action: 'Use secure credential storage' },
            { check: report.github?.contributors > 10, label: 'Multiple contributors', action: 'Invite code reviewers' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${
              item.check ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className="flex items-center gap-2">
                <span className={item.check ? 'text-green-400' : 'text-red-400'}>{item.check ? '✓' : '✕'}</span>
                <span className="text-slate-300">{item.label}</span>
              </div>
              {!item.check && <span className="text-xs text-slate-500">{item.action}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Dependencies */}
      <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-white mb-3">📦 Recommended Security Tools</h4>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-white font-medium">Dependency Scanning</p>
            <p className="text-slate-500">npm audit, Snyk, Dependabot</p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-white font-medium">Secret Detection</p>
            <p className="text-slate-500">git-secrets, truffleHog, Gitleaks</p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-white font-medium">SAST/Code Analysis</p>
            <p className="text-slate-500">CodeQL, Semgrep, SonarQube</p>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-white font-medium">Container Security</p>
            <p className="text-slate-500">Trivy, Clair, Docker Scout</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// USER: Simple safety-focused tab
const UserSafetyTab = ({ report }: { report: PubGuardReport }) => {
  const isSafe = report.trafficLight === 'green';
  const isRisky = report.trafficLight === 'red';

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white mb-4">👤 Is This Safe to Install?</h3>

      {/* Big Answer */}
      <div className={`rounded-2xl p-6 text-center ${
        isSafe ? 'bg-green-500/10 border-2 border-green-500/30' :
        isRisky ? 'bg-red-500/10 border-2 border-red-500/30' :
        'bg-amber-500/10 border-2 border-amber-500/30'
      }`}>
        <div className="text-6xl mb-4">{isSafe ? '✅' : isRisky ? '🚫' : '⚠️'}</div>
        <h4 className={`text-2xl font-bold mb-2 ${
          isSafe ? 'text-green-400' : isRisky ? 'text-red-400' : 'text-amber-400'
        }`}>
          {isSafe ? 'Appears Safe' : isRisky ? 'Not Recommended' : 'Use With Caution'}
        </h4>
        <p className="text-slate-400">
          {isSafe
            ? 'This software passed our security checks. Still, always download from official sources.'
            : isRisky
            ? 'We found significant security concerns. Consider alternatives.'
            : 'Some risks were identified. Read the details below before installing.'}
        </p>
      </div>

      {/* What You Should Know */}
      <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-white mb-3">📋 What You Should Know</h4>
        <div className="space-y-3">
          {report.github?.permissions?.shellAccess && (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg">
              <span className="text-2xl">🖥️</span>
              <div>
                <p className="text-white font-medium">Runs commands on your computer</p>
                <p className="text-slate-400 text-sm">This software can execute commands. Only install if you trust the developer.</p>
              </div>
            </div>
          )}
          {report.github?.permissions?.credentialStorage && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg">
              <span className="text-2xl">🔑</span>
              <div>
                <p className="text-white font-medium">Stores your passwords/API keys</p>
                <p className="text-slate-400 text-sm">Check where credentials are stored and how they're protected.</p>
              </div>
            </div>
          )}
          {report.github?.permissions?.networkAccess && (
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg">
              <span className="text-2xl">🌐</span>
              <div>
                <p className="text-white font-medium">Connects to the internet</p>
                <p className="text-slate-400 text-sm">This software sends/receives data online. Check the privacy policy.</p>
              </div>
            </div>
          )}
          {report.github?.permissions?.fileSystemAccess && (
            <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg">
              <span className="text-2xl">📁</span>
              <div>
                <p className="text-white font-medium">Accesses your files</p>
                <p className="text-slate-400 text-sm">The software can read/write files on your system.</p>
              </div>
            </div>
          )}
          {!report.github?.permissions?.shellAccess &&
           !report.github?.permissions?.credentialStorage &&
           !report.github?.permissions?.networkAccess &&
           !report.github?.permissions?.fileSystemAccess && (
            <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-white font-medium">Limited permissions detected</p>
                <p className="text-slate-400 text-sm">No high-risk permissions were identified.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simple Checklist */}
      <div>
        <h4 className="text-lg font-semibold text-white mb-3">✅ Before You Install</h4>
        <div className="space-y-2">
          {[
            'Download only from the official website or GitHub',
            'Check the number of stars and contributors',
            'Read recent reviews and issues',
            'Start with a test environment if possible',
            'Keep the software updated',
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-300">
              <span className="text-green-400">•</span>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ANALYST: Technical deep-dive tab
const AnalystTechnicalTab = ({ report }: { report: PubGuardReport }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-white mb-4">🔍 Technical Analysis</h3>

    {/* Repository Metrics */}
    {report.github && (
      <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-amber-400 mb-3">📊 Repository Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{report.github.stars?.toLocaleString() || 'N/A'}</div>
            <div className="text-xs text-slate-500">Stars</div>
          </div>
          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{report.github.forks?.toLocaleString() || 'N/A'}</div>
            <div className="text-xs text-slate-500">Forks</div>
          </div>
          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{report.github.contributors || 'N/A'}</div>
            <div className="text-xs text-slate-500">Contributors</div>
          </div>
          <div className="text-center p-3 bg-slate-800/50 rounded-lg">
            <div className="text-2xl font-bold text-white">{report.github.openIssues || 'N/A'}</div>
            <div className="text-xs text-slate-500">Open Issues</div>
          </div>
        </div>

        {/* Temporal Analysis */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-300 ml-2">
              {report.github.createdAt ? new Date(report.github.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Last Commit:</span>
            <span className="text-slate-300 ml-2">
              {report.github.daysSinceLastCommit !== undefined ? `${report.github.daysSinceLastCommit} days ago` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Age:</span>
            <span className="text-slate-300 ml-2">
              {report.github.ageInDays ? `${Math.floor(report.github.ageInDays / 365)}y ${Math.floor((report.github.ageInDays % 365) / 30)}m` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Stars/Day:</span>
            <span className={`ml-2 ${report.github.starsPerDay > 100 ? 'text-amber-400' : 'text-slate-300'}`}>
              {report.github.starsPerDay?.toFixed(1) || 'N/A'}
              {report.github.isViralGrowth && ' ⚡ Viral'}
            </span>
          </div>
        </div>
      </div>
    )}

    {/* CVE Analysis */}
    <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
      <h4 className="text-lg font-semibold text-red-400 mb-3">🛡️ CVE / Vulnerability Data</h4>
      {report.cve?.vulnerabilities?.length > 0 ? (
        <div className="space-y-2">
          {report.cve.vulnerabilities.map((cve: any, i: number) => (
            <div key={i} className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex justify-between items-start">
                <span className="font-mono text-red-400">{cve.id}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  cve.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                  cve.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                  cve.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {cve.severity} {cve.cvssScore && `(${cve.cvssScore})`}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">{cve.description?.substring(0, 200)}...</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-green-400">✓ No CVEs found in NVD database</p>
      )}
    </div>

    {/* Permission Matrix */}
    {report.github?.permissions && (
      <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-purple-400 mb-3">🔐 Permission Matrix</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(report.github.permissions).map(([key, value]) => (
            <div key={key} className={`p-2 rounded text-sm ${
              value ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
            }`}>
              {value ? '⚠️' : '✓'} {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Security Tests Results */}
    {report.securityTests && (
      <div className="bg-slate-800/30 border border-white/10 rounded-xl p-4">
        <h4 className="text-lg font-semibold text-blue-400 mb-3">🧪 Automated Security Tests</h4>
        <div className="space-y-2">
          {report.securityTests.tests?.map((test: any, i: number) => (
            <div key={i} className={`flex justify-between items-center p-2 rounded ${
              test.passed ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <span className="text-slate-300">{test.name}</span>
              <span className={test.passed ? 'text-green-400' : 'text-red-400'}>
                {test.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Raw Data Export */}
    <div className="flex gap-3">
      <button
        onClick={() => {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `pubguard-full-report-${report.target.name.replace('/', '-')}.json`;
          a.click();
        }}
        className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
      >
        📥 Export Full JSON
      </button>
      <button
        onClick={() => {
          const iocs = {
            repository: report.target.url,
            cves: report.cve?.vulnerabilities?.map((c: any) => c.id) || [],
            warnings: report.findings.critical.concat(report.findings.high).map(f => f.title),
            scannedAt: report.generatedAt,
          };
          navigator.clipboard.writeText(JSON.stringify(iocs, null, 2));
        }}
        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
      >
        📋 Copy IOCs
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PubGuardReportDisplay({ report, userType, onNewScan }: Props) {
  const config = USER_TYPE_CONFIG[userType];
  const [activeTab, setActiveTab] = useState<string>(config.primaryTabs[0]);

  // Build tabs based on user type
  const allTabs = [
    { id: 'summary', label: 'Summary', icon: '📊' },
    { id: 'findings', label: `Findings (${Object.values(report.findings).flat().length})`, icon: '🔎' },
    { id: 'sources', label: 'Sources', icon: '📚' },
    { id: 'guidance', label: 'Writer Guidance', icon: '✏️' },
    { id: 'actions', label: 'Dev Actions', icon: '💻' },
    { id: 'safety', label: 'Safety Check', icon: '👤' },
    { id: 'technical', label: 'Technical', icon: '🔍' },
  ];

  const visibleTabs = allTabs.filter(tab => !config.hiddenTabs.includes(tab.id));

  const totalFindings = {
    critical: report.findings.critical.length,
    high: report.findings.high.length,
    medium: report.findings.medium.length,
    low: report.findings.low.length,
    positive: report.findings.positive.length,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* User Type Badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${config.bgColor} border ${config.borderColor}`}>
        <span>{config.icon}</span>
        <span className={`font-medium ${config.color}`}>{config.title} View</span>
      </div>

      {/* Header */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">🛡️ {report.target.name}</h2>
            <p className="text-slate-500 text-sm">Scanned {new Date(report.generatedAt).toLocaleString()}</p>
            <p className={`text-sm mt-1 ${config.color}`}>{config.summaryFocus}</p>
          </div>
          <TrafficLightIcon light={report.trafficLight} />
        </div>

        {/* Recommendation Banner */}
        <div className={`rounded-xl p-4 mb-6 ${
          report.trafficLight === 'green' ? 'bg-green-500/10 border border-green-500/30' :
          report.trafficLight === 'amber' ? 'bg-amber-500/10 border border-amber-500/30' :
          'bg-red-500/10 border border-red-500/30'
        }`}>
          <h3 className={`text-lg font-semibold mb-1 ${
            report.trafficLight === 'green' ? 'text-green-400' :
            report.trafficLight === 'amber' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {report.recommendation.replace(/_/g, ' ')}
          </h3>
          <p className="text-slate-300">Risk Score: <span className="font-bold">{report.overallRiskScore}/100</span></p>
        </div>

        {/* Findings Summary */}
        <div className="grid grid-cols-5 gap-3 text-center">
          <div className="bg-red-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-400">{totalFindings.critical}</div>
            <div className="text-xs text-slate-500">Critical</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-orange-400">{totalFindings.high}</div>
            <div className="text-xs text-slate-500">High</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-400">{totalFindings.medium}</div>
            <div className="text-xs text-slate-500">Medium</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-400">{totalFindings.low}</div>
            <div className="text-xs text-slate-500">Low</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400">{totalFindings.positive}</div>
            <div className="text-xs text-slate-500">Positive</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id 
                ? `${config.bgColor} ${config.color} border ${config.borderColor}` 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">📊 Risk Score Breakdown</h3>
            {report.riskCategories.map((cat, i) => (
              <RiskCategoryCard
                key={i}
                category={cat}
                emphasized={config.emphasizeCategories.includes(cat.name)}
              />
            ))}
          </div>
        )}

        {/* Findings Tab */}
        {activeTab === 'findings' && (
          <div className="space-y-6">
            {report.findings.critical.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-3">🚨 Critical Findings</h3>
                <div className="space-y-3">
                  {report.findings.critical.map((f, i) => <FindingCard key={i} finding={f} />)}
                </div>
              </div>
            )}
            {report.findings.high.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-orange-400 mb-3">⚠️ High Severity</h3>
                <div className="space-y-3">
                  {report.findings.high.map((f, i) => <FindingCard key={i} finding={f} />)}
                </div>
              </div>
            )}
            {report.findings.medium.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">📋 Medium Severity</h3>
                <div className="space-y-3">
                  {report.findings.medium.map((f, i) => <FindingCard key={i} finding={f} />)}
                </div>
              </div>
            )}
            {report.findings.positive.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Positive Findings</h3>
                <div className="space-y-3">
                  {report.findings.positive.map((f, i) => <FindingCard key={i} finding={f} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">📚 Sources Checked</h3>
            <table className="w-full mb-6">
              <thead>
                <tr className="text-left text-slate-500 text-sm border-b border-white/10">
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Searched</th>
                  <th className="pb-2 text-center">Found</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.sourcesChecked.map((source, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-slate-300">{source.name}</td>
                    <td className="py-2 text-slate-500 text-sm">{source.searched.slice(0, 3).join(', ')}</td>
                    <td className="py-2 text-center">{source.found}</td>
                    <td className={`py-2 text-center ${
                      source.status === 'success' ? 'text-green-400' : 
                      source.status === 'partial' ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {source.status === 'success' ? '✓' : source.status === 'partial' ? '◐' : '✕'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 className="text-lg font-semibold text-white mb-3">Search Terms Used</h4>
            <div className="flex flex-wrap gap-2">
              {report.searchTermsUsed.map((term, i) => (
                <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-sm text-slate-400">{term}</span>
              ))}
            </div>
          </div>
        )}

        {/* User-Type Specific Tabs */}
        {activeTab === 'guidance' && config.showWriterGuidance && (
          <WriterGuidanceTab report={report} />
        )}

        {activeTab === 'actions' && config.showDeveloperActions && (
          <DeveloperActionsTab report={report} />
        )}

        {activeTab === 'safety' && config.showUserSafety && (
          <UserSafetyTab report={report} />
        )}

        {activeTab === 'technical' && config.showTechnicalDetails && (
          <AnalystTechnicalTab report={report} />
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 p-4 bg-white/[0.02] rounded-xl border border-white/10">
        <p className="text-xs text-slate-500 mb-2">{report.disclaimer}</p>
        <div className="flex justify-between items-center text-xs text-slate-600">
          <span>Report ID: {report.id}</span>
          <span>Hash: {report.reportHash}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3 flex-wrap">
        <button onClick={onNewScan} className="px-6 py-3 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 transition-colors">
          ← New Scan
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pubguard-report-${report.target.name.replace('/', '-')}-${Date.now()}.json`;
            a.click();
          }}
          className="px-6 py-3 bg-white/5 text-slate-300 rounded-xl hover:bg-white/10 transition-colors"
        >
          📥 Download JSON
        </button>
        <button onClick={() => window.print()} className={`px-6 py-3 rounded-xl transition-colors ${config.bgColor} ${config.color} border ${config.borderColor} hover:opacity-80`}>
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}