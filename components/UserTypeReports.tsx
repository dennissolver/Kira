'use client';

import { useState } from 'react';

interface Finding {
  title: string;
  description: string;
  source?: string;
  reference?: string;
}

interface PubGuardReport {
  reportId?: string;
  targetName: string;
  trafficLight: 'green' | 'amber' | 'red';
  riskScore: number;
  timestamp: string;
  findings: {
    critical: Finding[];
    high: Finding[];
    medium: Finding[];
    low: Finding[];
    positive: Finding[];
  };
  cveAnalysis?: {
    cves?: Array<{
      id: string;
      severity?: string;
      description?: string;
    }>;
  };
  securityTests?: Record<string, { status: string }>;
}

// ============================================
// WRITER/PUBLISHER REPORT
// Focus: Article-ready content, quotable findings
// ============================================
export function WriterReport({ report }: { report: PubGuardReport }) {
  const [copied, setCopied] = useState(false);

  const generateArticleSection = () => {
    const rating = report.trafficLight.toUpperCase();
    const ratingEmoji = rating === 'GREEN' ? '✅' : rating === 'AMBER' ? '⚠️' : '🚨';

    let articleText = `## Security Assessment: ${report.targetName}\n\n`;
    articleText += `**Overall Rating: ${ratingEmoji} ${rating}** (Risk Score: ${report.riskScore}/100)\n\n`;

    articleText += `### Key Findings\n\n`;

    if (report.findings.critical.length > 0) {
      articleText += `**Critical Issues (${report.findings.critical.length}):**\n`;
      report.findings.critical.slice(0, 3).forEach(f => {
        articleText += `- ${f.title}\n`;
      });
      articleText += `\n`;
    }

    if (report.findings.high.length > 0) {
      articleText += `**High-Priority Concerns (${report.findings.high.length}):**\n`;
      report.findings.high.slice(0, 3).forEach(f => {
        articleText += `- ${f.title}\n`;
      });
      articleText += `\n`;
    }

    if (report.findings.positive.length > 0) {
      articleText += `**Positive Indicators:**\n`;
      report.findings.positive.slice(0, 3).forEach(f => {
        articleText += `- ${f.title}\n`;
      });
      articleText += `\n`;
    }

    articleText += `### Recommendation\n\n`;
    if (rating === 'GREEN') {
      articleText += `Based on our security assessment, ${report.targetName} appears to be a low-risk choice for most users. Standard security practices should be followed.\n\n`;
    } else if (rating === 'AMBER') {
      articleText += `${report.targetName} has some security considerations that users should be aware of. We recommend reviewing the specific concerns before adoption, particularly for sensitive use cases.\n\n`;
    } else {
      articleText += `**Caution advised.** ${report.targetName} has significant security concerns that warrant careful consideration. Users should evaluate whether the risks align with their security requirements.\n\n`;
    }

    articleText += `---\n`;
    articleText += `*Security assessment performed by [PubGuard](https://kira-rho.vercel.app/pubguard) on ${new Date(report.timestamp).toLocaleDateString()}. `;
    articleText += `This assessment is informational only and does not constitute professional security advice.*\n`;

    return articleText;
  };

  const copyToClipboard = async () => {
    const text = generateArticleSection();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Article Export Section */}
      <div className="bg-purple-900/30 border border-purple-500/40 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-purple-300 font-semibold text-lg">📝 Ready for Your Article</h3>
            <p className="text-purple-200/70 text-sm">Pre-formatted security section you can paste into your content</p>
          </div>
          <button
            onClick={copyToClipboard}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              copied 
                ? 'bg-green-500 text-white' 
                : 'bg-purple-500 hover:bg-purple-400 text-white'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy to Article'}
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 max-h-64 overflow-y-auto">
          <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
            {generateArticleSection()}
          </pre>
        </div>
      </div>

      {/* Writer-Focused Summary */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4">What Your Readers Need to Know</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-slate-300 font-medium mb-2">The Bottom Line</h4>
            <p className="text-slate-400">
              {report.trafficLight === 'green' && `${report.targetName} is generally safe to recommend. No major red flags found.`}
              {report.trafficLight === 'amber' && `${report.targetName} has some concerns worth mentioning to readers. Consider adding a note about the specific issues.`}
              {report.trafficLight === 'red' && `Be cautious recommending ${report.targetName}. Significant security issues found that could affect your readers.`}
            </p>
          </div>

          {report.findings.critical.length > 0 && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
              <h4 className="text-red-300 font-medium mb-2">⚠️ Must Mention to Readers</h4>
              <ul className="text-red-200/80 space-y-1">
                {report.findings.critical.map((f, i) => (
                  <li key={i}>• {f.title}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-slate-300 font-medium mb-2">Your Liability Protection</h4>
            <p className="text-slate-400 text-sm">
              By including this PubGuard assessment in your article, you demonstrate due diligence.
              The timestamped report (ID: {report.reportId?.slice(0, 8) || 'N/A'}...) serves as documentation
              that you checked the software&apos;s security status before recommending it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DEVELOPER REPORT
// Focus: Technical details, actionable fixes
// ============================================
export function DeveloperReport({ report }: { report: PubGuardReport }) {
  return (
    <div className="space-y-6">
      {/* Action Items */}
      <div className="bg-blue-900/30 border border-blue-500/40 rounded-xl p-6">
        <h3 className="text-blue-300 font-semibold text-lg mb-4">🔧 Action Items</h3>

        <div className="space-y-3">
          {report.findings.critical.map((f, i) => (
            <div key={i} className="flex items-start gap-3 bg-red-900/30 rounded-lg p-3">
              <input type="checkbox" className="mt-1 w-4 h-4" />
              <div>
                <span className="text-red-300 font-medium">[CRITICAL]</span>
                <span className="text-slate-300 ml-2">{f.title}</span>
                {f.source && <span className="text-slate-500 text-sm ml-2">({f.source})</span>}
              </div>
            </div>
          ))}

          {report.findings.high.map((f, i) => (
            <div key={i} className="flex items-start gap-3 bg-orange-900/30 rounded-lg p-3">
              <input type="checkbox" className="mt-1 w-4 h-4" />
              <div>
                <span className="text-orange-300 font-medium">[HIGH]</span>
                <span className="text-slate-300 ml-2">{f.title}</span>
              </div>
            </div>
          ))}

          {report.findings.medium.map((f, i) => (
            <div key={i} className="flex items-start gap-3 bg-yellow-900/30 rounded-lg p-3">
              <input type="checkbox" className="mt-1 w-4 h-4" />
              <div>
                <span className="text-yellow-300 font-medium">[MEDIUM]</span>
                <span className="text-slate-300 ml-2">{f.title}</span>
              </div>
            </div>
          ))}

          {report.findings.critical.length === 0 &&
           report.findings.high.length === 0 &&
           report.findings.medium.length === 0 && (
            <p className="text-green-400">✅ No action items - your project looks secure!</p>
          )}
        </div>
      </div>

      {/* CVE Details */}
      {report.cveAnalysis?.cves && report.cveAnalysis.cves.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">🔍 CVE Details</h3>
          <div className="space-y-3">
            {report.cveAnalysis.cves.map((cve, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-mono"
                  >
                    {cve.id}
                  </a>
                  {cve.severity && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      cve.severity === 'CRITICAL' ? 'bg-red-500/30 text-red-300' :
                      cve.severity === 'HIGH' ? 'bg-orange-500/30 text-orange-300' :
                      cve.severity === 'MEDIUM' ? 'bg-yellow-500/30 text-yellow-300' :
                      'bg-slate-500/30 text-slate-300'
                    }`}>
                      {cve.severity}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">{cve.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Tests Results */}
      {report.securityTests && Object.keys(report.securityTests).length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">🧪 Security Tests</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(report.securityTests).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                <span className="text-slate-300 text-sm">{key.replace(/_/g, ' ')}</span>
                <span className={`text-sm font-medium ${
                  value?.status === 'pass' ? 'text-green-400' :
                  value?.status === 'fail' ? 'text-red-400' :
                  value?.status === 'warning' ? 'text-yellow-400' :
                  'text-slate-400'
                }`}>
                  {value?.status || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// USER REPORT
// Focus: Simple verdict, plain English
// ============================================
export function UserReport({ report }: { report: PubGuardReport }) {
  const isRecommended = report.trafficLight === 'green';
  const isCautious = report.trafficLight === 'amber';
  const isNotRecommended = report.trafficLight === 'red';

  return (
    <div className="space-y-6">
      {/* Big Verdict */}
      <div className={`rounded-xl p-8 text-center ${
        isRecommended ? 'bg-green-900/40 border-2 border-green-500/50' :
        isCautious ? 'bg-amber-900/40 border-2 border-amber-500/50' :
        'bg-red-900/40 border-2 border-red-500/50'
      }`}>
        <div className="text-6xl mb-4">
          {isRecommended ? '✅' : isCautious ? '⚠️' : '🚫'}
        </div>
        <h2 className={`text-3xl font-bold mb-2 ${
          isRecommended ? 'text-green-300' :
          isCautious ? 'text-amber-300' :
          'text-red-300'
        }`}>
          {isRecommended ? 'Looks Safe to Use' :
           isCautious ? 'Use with Caution' :
           'Not Recommended'}
        </h2>
        <p className="text-slate-300 text-lg">
          {isRecommended && `${report.targetName} passed our security checks. You can install it with confidence.`}
          {isCautious && `${report.targetName} has some concerns. Read below before installing.`}
          {isNotRecommended && `${report.targetName} has serious security issues. We don't recommend installing it.`}
        </p>
      </div>

      {/* Simple Concerns List */}
      {(report.findings.critical.length > 0 || report.findings.high.length > 0) && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">What You Should Know</h3>

          <div className="space-y-3">
            {report.findings.critical.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="text-red-300 font-medium">{f.title}</p>
                  <p className="text-slate-400 text-sm">{f.description}</p>
                </div>
              </div>
            ))}

            {report.findings.high.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-amber-300 font-medium">{f.title}</p>
                  <p className="text-slate-400 text-sm">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Good Things */}
      {report.findings.positive.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">Good Signs</h3>
          <div className="space-y-2">
            {report.findings.positive.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-slate-300">{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simple Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4">What Should You Do?</h3>
        <div className="space-y-3 text-slate-300">
          {isRecommended && (
            <>
              <p>✅ You can safely install this software</p>
              <p>✅ Keep it updated to the latest version</p>
              <p>✅ Use strong passwords if it asks for credentials</p>
            </>
          )}
          {isCautious && (
            <>
              <p>⚠️ Only install if you really need it</p>
              <p>⚠️ Don&apos;t give it access to sensitive data</p>
              <p>⚠️ Watch for updates that fix the issues above</p>
            </>
          )}
          {isNotRecommended && (
            <>
              <p>🚫 Look for a safer alternative</p>
              <p>🚫 Don&apos;t enter any passwords or sensitive info</p>
              <p>🚫 If already installed, consider removing it</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ANALYST REPORT
// Focus: Full technical depth, exportable
// ============================================
export function AnalystReport({ report }: { report: PubGuardReport }) {
  const [showRawData, setShowRawData] = useState(false);

  const exportToJSON = () => {
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pubguard-report-${report.targetName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Export Controls */}
      <div className="flex gap-3">
        <button
          onClick={exportToJSON}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
        >
          📥 Export JSON
        </button>
        <button
          onClick={() => setShowRawData(!showRawData)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
        >
          {showRawData ? '📊 Hide Raw Data' : '📊 Show Raw Data'}
        </button>
      </div>

      {/* Risk Metrics */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4">Risk Metrics</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{report.riskScore}</div>
            <div className="text-slate-400 text-sm">Risk Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{report.findings.critical.length}</div>
            <div className="text-slate-400 text-sm">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400">{report.findings.high.length}</div>
            <div className="text-slate-400 text-sm">High</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">{report.findings.medium.length}</div>
            <div className="text-slate-400 text-sm">Medium</div>
          </div>
        </div>
      </div>

      {/* All Findings with Full Details */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4">Complete Findings</h3>

        {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
          const findings = report.findings[severity];
          if (!findings || findings.length === 0) return null;

          return (
            <div key={severity} className="mb-6">
              <h4 className={`font-medium mb-3 ${
                severity === 'critical' ? 'text-red-400' :
                severity === 'high' ? 'text-orange-400' :
                severity === 'medium' ? 'text-yellow-400' :
                'text-slate-400'
              }`}>
                {severity.toUpperCase()} ({findings.length})
              </h4>
              <div className="space-y-2">
                {findings.map((f, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-slate-200 font-medium">{f.title}</p>
                        <p className="text-slate-400 text-sm mt-1">{f.description}</p>
                      </div>
                      {f.source && (
                        <span className="text-slate-500 text-xs bg-slate-800 px-2 py-1 rounded">
                          {f.source}
                        </span>
                      )}
                    </div>
                    {f.reference && (
                      <a
                        href={f.reference}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs hover:underline mt-2 block"
                      >
                        {f.reference}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw Data */}
      {showRawData && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">Raw Report Data</h3>
          <pre className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-96 text-xs text-slate-300">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}