// components/PubGuardReport.tsx
// Beautiful report display component for PubGuard v2

'use client';

import { useState } from 'react';

// Inline types to avoid import issues
type TrafficLight = 'green' | 'amber' | 'red';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

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
  writerGuidance: WriterGuidance;
  disclaimer: string;
  reportHash: string;
}

interface Props {
  report: PubGuardReport;
  onNewScan?: () => void;
}

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

const RiskCategoryCard = ({ category }: { category: RiskCategory }) => {
  const scoreColor = category.score >= 70 ? 'text-red-400' : 
                     category.score >= 40 ? 'text-amber-400' : 'text-green-400';
  
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold text-white">{category.name}</h4>
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

const FindingCard = ({ finding }: { finding: Finding }) => (
  <div className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
    <div className="flex items-start justify-between gap-3 mb-2">
      <h5 className="font-medium text-white">{finding.title}</h5>
      <SeverityBadge severity={finding.severity} />
    </div>
    <p className="text-sm text-slate-400 mb-2">{finding.description}</p>
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Source: {finding.source}</span>
      {finding.sourceUrl && (
        <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          View →
        </a>
      )}
      {finding.date && <span>• {finding.date}</span>}
    </div>
  </div>
);

export default function PubGuardReportDisplay({ report, onNewScan }: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'sources' | 'guidance'>('summary');
  
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'findings', label: `Findings (${Object.values(report.findings).flat().length})` },
    { id: 'sources', label: 'Sources' },
    { id: 'guidance', label: 'Writer Guidance' },
  ];

  const totalFindings = {
    critical: report.findings.critical.length,
    high: report.findings.high.length,
    medium: report.findings.medium.length,
    low: report.findings.low.length,
    positive: report.findings.positive.length,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">🛡️ {report.target.name}</h2>
            <p className="text-slate-500 text-sm">Scanned {new Date(report.generatedAt).toLocaleString()}</p>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{totalFindings.critical}</div>
            <div className="text-xs text-slate-500">Critical</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-400">{totalFindings.high}</div>
            <div className="text-xs text-slate-500">High</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{totalFindings.medium}</div>
            <div className="text-xs text-slate-500">Medium</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{totalFindings.low}</div>
            <div className="text-xs text-slate-500">Low</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{totalFindings.positive}</div>
            <div className="text-xs text-slate-500">Positive</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">📊 Risk Score Breakdown</h3>
            {report.riskCategories.map((cat, i) => <RiskCategoryCard key={i} category={cat} />)}
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="space-y-6">
            {report.findings.critical.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-3">🚨 Critical Findings</h3>
                <div className="space-y-3">{report.findings.critical.map((f, i) => <FindingCard key={i} finding={f} />)}</div>
              </div>
            )}
            {report.findings.high.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-orange-400 mb-3">⚠️ High Severity</h3>
                <div className="space-y-3">{report.findings.high.map((f, i) => <FindingCard key={i} finding={f} />)}</div>
              </div>
            )}
            {report.findings.medium.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">📋 Medium Severity</h3>
                <div className="space-y-3">{report.findings.medium.map((f, i) => <FindingCard key={i} finding={f} />)}</div>
              </div>
            )}
            {report.findings.positive.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Positive Findings</h3>
                <div className="space-y-3">{report.findings.positive.map((f, i) => <FindingCard key={i} finding={f} />)}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sources' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">🔍 Sources Checked</h3>
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

        {activeTab === 'guidance' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">📝 Writer Guidance</h3>
            
            <div className={`rounded-xl p-4 ${
              report.writerGuidance.canRecommend 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <h4 className={`font-semibold ${report.writerGuidance.canRecommend ? 'text-green-400' : 'text-red-400'}`}>
                {report.writerGuidance.canRecommend ? '✓ Can recommend with disclosures' : '✕ Do not recommend'}
              </h4>
            </div>

            {report.writerGuidance.mustDisclose.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-amber-400 mb-3">⚠️ Must Disclose</h4>
                <ul className="space-y-2">
                  {report.writerGuidance.mustDisclose.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="text-amber-500">•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-lg font-semibold text-white mb-3">📋 Suggested Disclaimer</h4>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
                <p className="text-slate-300 italic">{report.writerGuidance.suggestedDisclaimer}</p>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(report.writerGuidance.suggestedDisclaimer)}
                className="mt-2 text-sm text-blue-400 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>

            {report.writerGuidance.keyPointsToMention.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">💡 Key Points to Mention</h4>
                <ul className="space-y-2">
                  {report.writerGuidance.keyPointsToMention.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="text-blue-500">•</span>{point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
        <button onClick={() => window.print()} className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}
