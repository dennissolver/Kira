'use client';

import { useState } from 'react';

interface TestExplanation {
  name: string;
  icon: string;
  whatItDoes: string;
  whyItMatters: string;
  ifFailed: string;
  dataSources: string[];
}

const securityTests: TestExplanation[] = [
  {
    name: 'Credential Storage Audit',
    icon: '🔐',
    whatItDoes: 'Analyzes how the software stores and handles sensitive credentials like API keys, tokens, passwords, and secrets.',
    whyItMatters: 'Poor credential storage is the #1 cause of data breaches. If credentials are stored in plaintext, hardcoded, or in easily accessible locations, attackers can steal them.',
    ifFailed: 'HIGH RISK: Your API keys, passwords, or tokens could be exposed. Attackers could gain access to your accounts, cloud services, or sensitive data. Consider using environment variables or a secrets manager instead.',
    dataSources: ['Repository code analysis', 'Configuration file scanning', 'Documentation review']
  },
  {
    name: 'Permission Scope Analysis',
    icon: '🎯',
    whatItDoes: 'Evaluates what permissions and access levels the software requests—file system access, network access, API scopes, etc.',
    whyItMatters: 'Software should follow the principle of least privilege. Excessive permissions mean greater damage if the software is compromised or malicious.',
    ifFailed: 'MEDIUM-HIGH RISK: The software requests more access than it needs. A compromised or malicious version could read your files, access your network, or control your system beyond its stated purpose.',
    dataSources: ['Manifest files', 'OAuth scope declarations', 'API permission requests', 'System call analysis']
  },
  {
    name: 'Prompt Injection Vulnerability',
    icon: '💉',
    whatItDoes: 'For AI/LLM-based tools, tests whether user inputs can manipulate the AI to bypass safety measures, leak data, or perform unintended actions.',
    whyItMatters: 'Prompt injection is the OWASP #1 vulnerability for LLM applications. Attackers can hijack AI agents to exfiltrate data, execute commands, or bypass security controls.',
    ifFailed: 'CRITICAL RISK: Malicious users could manipulate the AI to reveal sensitive information, ignore safety guidelines, or take unauthorized actions. This is especially dangerous for AI agents with tool access.',
    dataSources: ['LLM integration patterns', 'Input sanitization review', 'System prompt exposure analysis']
  },
  {
    name: 'Supply Chain Security',
    icon: '📦',
    whatItDoes: 'Examines dependencies, third-party packages, and the software distribution chain for vulnerabilities or tampering risks.',
    whyItMatters: 'Supply chain attacks (like SolarWinds, Log4j, and npm package hijacking) compromise software through its dependencies rather than directly.',
    ifFailed: 'HIGH RISK: The software may include vulnerable or malicious dependencies. Attackers could compromise the software through a dependency update, injecting malware that affects all users.',
    dataSources: ['package.json / requirements.txt analysis', 'Dependency vulnerability databases', 'Package integrity verification']
  },
  {
    name: 'Default Configuration Security',
    icon: '⚙️',
    whatItDoes: 'Reviews whether the software ships with secure defaults or requires users to manually enable security features.',
    whyItMatters: 'Most users never change default settings. Insecure defaults (like disabled authentication, open ports, or debug mode) leave systems vulnerable out of the box.',
    ifFailed: 'MEDIUM RISK: You may be running the software in an insecure configuration without realizing it. Check the documentation for hardening guides and ensure security features are explicitly enabled.',
    dataSources: ['Default configuration files', 'Installation documentation', 'Quick start guides']
  },
  {
    name: 'Internet Exposure (Shodan)',
    icon: '🌐',
    whatItDoes: 'Searches Shodan and similar services to find instances of this software exposed on the public internet, often misconfigured.',
    whyItMatters: 'If many instances are found exposed online, it indicates the software is commonly misconfigured or lacks adequate security warnings. Your instance could be next.',
    ifFailed: 'HIGH RISK: This software is frequently found exposed on the internet with minimal protection. If you deploy it, ensure it is behind authentication, a VPN, or firewall. Do not expose to the public internet.',
    dataSources: ['Shodan.io', 'Censys', 'Security researcher reports']
  },
  {
    name: 'Identity Stability (Rename Detection)',
    icon: '🔄',
    whatItDoes: 'Checks if the repository, organization, or maintainer has been renamed, transferred, or changed identity over time.',
    whyItMatters: 'Abandoned or renamed repositories can be hijacked. Attackers claim old package names or repo URLs to distribute malware to users expecting the original software.',
    ifFailed: 'MEDIUM RISK: This project has changed names or ownership. Verify you are using the correct, current source. Old links may redirect to malicious forks or abandoned versions with unpatched vulnerabilities.',
    dataSources: ['GitHub API history', 'Package registry records', 'Redirect analysis']
  },
  {
    name: 'Maintainer Responsiveness',
    icon: '👤',
    whatItDoes: 'Analyzes how quickly maintainers respond to security issues, bug reports, and pull requests.',
    whyItMatters: 'Unresponsive maintainers mean security vulnerabilities go unpatched. A project with no recent activity may have known vulnerabilities that will never be fixed.',
    ifFailed: 'MEDIUM RISK: Security issues may not be addressed promptly. If a vulnerability is discovered, you may be left exposed while waiting for a fix that never comes. Consider the project\'s bus factor.',
    dataSources: ['Issue response times', 'PR merge velocity', 'Last commit date', 'Security advisory response history']
  },
  {
    name: 'SECURITY.md Policy',
    icon: '📋',
    whatItDoes: 'Checks for the presence and quality of a security policy file that tells researchers how to report vulnerabilities.',
    whyItMatters: 'Projects without a security policy often have no process for handling vulnerability reports. Researchers may disclose publicly or not report at all.',
    ifFailed: 'LOW-MEDIUM RISK: No clear process for reporting security issues. Vulnerabilities may be disclosed publicly before patches are available, or researchers may not report issues they find.',
    dataSources: ['SECURITY.md file', 'GitHub security tab', 'Project documentation']
  },
  {
    name: 'Community Health Indicators',
    icon: '🏥',
    whatItDoes: 'Evaluates overall project health: contributor diversity, documentation quality, test coverage, CI/CD practices, and code review processes.',
    whyItMatters: 'Healthy projects catch bugs and vulnerabilities faster. Single-maintainer projects, poor test coverage, and lack of code review increase the risk of security issues.',
    ifFailed: 'LOW-MEDIUM RISK: The project may have quality issues that lead to security vulnerabilities. Limited contributors mean limited review. Poor tests mean bugs slip through.',
    dataSources: ['Contributor statistics', 'CI/CD configuration', 'Test coverage reports', 'Code review practices']
  },
  {
    name: 'CVE Database Lookup',
    icon: '🔍',
    whatItDoes: 'Searches the National Vulnerability Database (NVD) and other CVE sources for known vulnerabilities affecting this software or its dependencies.',
    whyItMatters: 'Known vulnerabilities with CVE identifiers are actively exploited by attackers. Using software with unpatched CVEs is like leaving your door unlocked.',
    ifFailed: 'CRITICAL-HIGH RISK (depending on CVE severity): Known vulnerabilities exist. Check if patches are available and apply them immediately. If unpatched, consider alternatives.',
    dataSources: ['NIST NVD', 'GitHub Security Advisories', 'OSV Database', 'Snyk Vulnerability DB']
  },
  {
    name: 'Security News & Researcher Warnings',
    icon: '📰',
    whatItDoes: 'Searches security news, blogs, Twitter/X, and researcher publications for warnings, incidents, or concerns about this software.',
    whyItMatters: 'Security researchers often discover and publicize issues before CVEs are assigned. News coverage of breaches or vulnerabilities provides early warning.',
    ifFailed: 'VARIES: Security researchers have raised concerns. Read the specific warnings to understand the risk. Some may be theoretical; others may describe active exploitation.',
    dataSources: ['Security news sites', 'Researcher blogs', 'Twitter/X security community', 'Conference presentations']
  },
  {
    name: 'GitHub Repository Analysis',
    icon: '🐙',
    whatItDoes: 'Comprehensive analysis of the GitHub repository including stars, forks, issues, commit history, contributor patterns, and repository settings.',
    whyItMatters: 'Repository metadata reveals project maturity, community trust, and maintenance status. Sudden changes in patterns can indicate compromise or abandonment.',
    ifFailed: 'VARIES: Specific concerns depend on findings. Could indicate low adoption, abandonment, suspicious activity, or lack of security practices.',
    dataSources: ['GitHub API', 'Commit history', 'Issue tracker', 'Repository settings']
  },
  {
    name: 'License & Legal Review',
    icon: '⚖️',
    whatItDoes: 'Identifies the software license and checks for legal obligations, restrictions, or concerns that could affect your use.',
    whyItMatters: 'Some licenses have viral clauses (GPL), restrict commercial use, or have been changed unexpectedly. Understanding license obligations prevents legal issues.',
    ifFailed: 'LOW RISK (usually): License may have restrictions you need to comply with. Review the specific license terms for your use case. Not a security risk per se, but important for compliance.',
    dataSources: ['LICENSE file', 'Package metadata', 'SPDX identifiers']
  }
];

const faqItems = [
  {
    question: 'How accurate are these scans?',
    answer: 'PubGuard combines automated analysis with multiple data sources to provide a comprehensive risk assessment. However, no automated tool can catch everything. Our scans should be considered one input into your security decision-making, not the final word. False positives and false negatives are possible.'
  },
  {
    question: 'What does the traffic light rating mean?',
    answer: 'GREEN (0-39): No significant concerns found. Normal caution advised. AMBER (40-69): Some concerns identified that warrant attention. Review findings before proceeding. RED (70-100): Significant security concerns. Proceed with extreme caution or consider alternatives.'
  },
  {
    question: 'How is the risk score calculated?',
    answer: 'The risk score (0-100) is calculated by weighting findings across all security tests. Critical findings (like known CVEs or credential exposure) have high weight. Medium findings (like missing security policy) have moderate weight. The score also factors in the number and severity of findings, maintainer responsiveness, and community health.'
  },
  {
    question: 'Why might a popular project get a high risk score?',
    answer: 'Popularity does not equal security. Some of the most popular projects have had serious vulnerabilities (Log4j had billions of downloads). High stars/downloads may actually increase attacker interest. We evaluate security practices, not popularity.'
  },
  {
    question: 'What should I do if a project I need has a RED rating?',
    answer: 'Review the specific findings to understand the risks. Some risks may not apply to your use case. Consider: (1) Can you mitigate the specific risks? (2) Is there a more secure alternative? (3) Can you isolate/sandbox the software? (4) Is the risk acceptable given your threat model?'
  },
  {
    question: 'How often should I re-scan projects?',
    answer: 'Re-scan when: (1) You are about to update to a new version, (2) You hear about security incidents, (3) Periodically (monthly for critical dependencies), (4) Before publishing content recommending the software.'
  },
  {
    question: 'Does PubGuard access my private repositories?',
    answer: 'PubGuard can scan private repositories if you provide a GitHub token with appropriate permissions. Your token is used only for the scan and is not stored. Without a token, only public repository information is accessible.'
  },
  {
    question: 'What data sources does PubGuard use?',
    answer: 'We aggregate data from: GitHub API, National Vulnerability Database (NVD), OSV Database, Shodan, security news sources, researcher publications, package registries (npm, PyPI), and our own code analysis. All sources are cited in the report.'
  }
];

export default function PubGuardMethodology() {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tests' | 'faq'>('tests');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mt-8">
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 border-b border-slate-700 pb-4">
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'tests'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔬 Security Tests Explained
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'faq'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          ❓ FAQ
        </button>
      </div>

      {/* Security Tests Tab */}
      {activeTab === 'tests' && (
        <div>
          <p className="text-slate-400 mb-6">
            PubGuard runs {securityTests.length} automated security tests on every scan. 
            Click each test to learn what it checks, why it matters, and what failed results mean.
          </p>
          
          <div className="space-y-3">
            {securityTests.map((test) => (
              <div
                key={test.name}
                className="border border-slate-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTest(expandedTest === test.name ? null : test.name)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{test.icon}</span>
                    <span className="font-medium text-white">{test.name}</span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      expandedTest === test.name ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedTest === test.name && (
                  <div className="px-4 pb-4 space-y-4 bg-slate-800/30">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-1">What It Does</h4>
                      <p className="text-slate-400 text-sm">{test.whatItDoes}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-1">Why It Matters</h4>
                      <p className="text-slate-400 text-sm">{test.whyItMatters}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400 mb-1">⚠️ If This Test Fails</h4>
                      <p className="text-amber-200/80 text-sm">{test.ifFailed}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-1">Data Sources</h4>
                      <div className="flex flex-wrap gap-2">
                        {test.dataSources.map((source) => (
                          <span
                            key={source}
                            className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          {faqItems.map((item) => (
            <div
              key={item.question}
              className="border border-slate-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === item.question ? null : item.question)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
              >
                <span className="font-medium text-white">{item.question}</span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-4 ${
                    expandedFaq === item.question ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedFaq === item.question && (
                <div className="px-4 pb-4 bg-slate-800/30">
                  <p className="text-slate-400 text-sm leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Methodology Note */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          PubGuard methodology is based on OWASP guidelines, NIST Cybersecurity Framework, 
          and industry best practices. Scans are point-in-time assessments and should be 
          repeated periodically. For critical systems, supplement with professional security audits.
        </p>
      </div>
    </div>
  );
}
