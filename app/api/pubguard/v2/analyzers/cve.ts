// app/api/pubguard/v2/analyzers/cve.ts
// CVE/NVD vulnerability database analysis - IMPROVED search term generation

import type { CVEAnalysis, CVEFinding, Finding } from '../types';

const NVD_API_KEY = process.env.NVD_API_KEY;

interface NVDResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: {
    cve: {
      id: string;
      descriptions: { lang: string; value: string }[];
      published: string;
      lastModified: string;
      vulnStatus: string;
      metrics?: {
        cvssMetricV31?: {
          cvssData: {
            baseScore: number;
            vectorString: string;
            baseSeverity: string;
          };
        }[];
        cvssMetricV30?: {
          cvssData: {
            baseScore: number;
            vectorString: string;
            baseSeverity: string;
          };
        }[];
      };
      configurations?: {
        nodes: {
          cpeMatch: {
            vulnerable: boolean;
            criteria: string;
            versionEndIncluding?: string;
            versionStartIncluding?: string;
          }[];
        }[];
      }[];
      references?: { url: string }[];
    };
  }[];
}

// Generate smart search terms from project name
function generateSearchTerms(projectName: string, owner: string, alternateNames: string[]): string[] {
  const terms = new Set<string>();

  // Original name
  terms.add(projectName);

  // With owner prefix (for disambiguation)
  terms.add(`${owner} ${projectName}`);

  // Handle hyphenated names - search both parts
  if (projectName.includes('-')) {
    const parts = projectName.split('-');
    parts.forEach(part => {
      if (part.length > 2) terms.add(part);
    });
    // Also search the combined form
    terms.add(parts.join(''));
  }

  // Handle underscored names
  if (projectName.includes('_')) {
    const parts = projectName.split('_');
    parts.forEach(part => {
      if (part.length > 2) terms.add(part);
    });
    terms.add(parts.join('-')); // hyphenated version
  }

  // Common library name patterns
  const lowerName = projectName.toLowerCase();

  // If ends with common suffixes, also search without
  const suffixes = ['-js', '-py', '-core', '-lib', '-node', '-cli', '-sdk', '-api'];
  for (const suffix of suffixes) {
    if (lowerName.endsWith(suffix)) {
      terms.add(projectName.slice(0, -suffix.length));
    }
  }

  // If starts with common prefixes, also search without
  const prefixes = ['node-', 'python-', 'js-', 'go-', 'rust-'];
  for (const prefix of prefixes) {
    if (lowerName.startsWith(prefix)) {
      terms.add(projectName.slice(prefix.length));
    }
  }

  // Known vulnerability-prone project mappings
  const knownMappings: Record<string, string[]> = {
    'uap-core': ['ua-parser', 'user-agent-parser', 'uaparser'],
    'ua-parser': ['uap-core', 'user-agent-parser', 'uaparser'],
    'minimist': ['minimist', 'substack minimist'],
    'lodash': ['lodash'],
    'log4j': ['log4j', 'apache log4j', 'log4shell'],
    'socket.io': ['socket.io', 'socketio'],
    'express': ['express', 'expressjs'],
    'jquery': ['jquery'],
    'angular': ['angular', 'angularjs'],
    'react': ['react', 'reactjs'],
    'axios': ['axios'],
    'moment': ['moment', 'momentjs'],
    'qs': ['qs', 'query-string'],
    'node-fetch': ['node-fetch'],
    'tar': ['node-tar', 'tar'],
    'path-parse': ['path-parse'],
    'glob-parent': ['glob-parent'],
    'ini': ['ini'],
    'y18n': ['y18n'],
    'elliptic': ['elliptic'],
    'highlight.js': ['highlight.js', 'highlightjs'],
    'serialize-javascript': ['serialize-javascript'],
    'decompress': ['decompress'],
    'netmask': ['netmask'],
    'ssri': ['ssri'],
    'hosted-git-info': ['hosted-git-info'],
    'normalize-url': ['normalize-url'],
    'trim-newlines': ['trim-newlines'],
    'is-svg': ['is-svg'],
    'browserslist': ['browserslist'],
    'dns-packet': ['dns-packet'],
    'ws': ['ws', 'websocket'],
    'postcss': ['postcss'],
    'nth-check': ['nth-check'],
    'ansi-regex': ['ansi-regex'],
    'nanoid': ['nanoid'],
    'follow-redirects': ['follow-redirects'],
    'markdown-it': ['markdown-it'],
    'prismjs': ['prismjs', 'prism'],
    'shell-quote': ['shell-quote'],
    'undici': ['undici'],
    'json5': ['json5'],
    'cookiejar': ['cookiejar', 'tough-cookie'],
    'semver': ['semver'],
    'xml2js': ['xml2js'],
  };

  const lowerProjectName = projectName.toLowerCase();
  if (knownMappings[lowerProjectName]) {
    knownMappings[lowerProjectName].forEach(term => terms.add(term));
  }

  // Add all provided alternate names
  alternateNames.forEach(name => terms.add(name));

  // Filter out very short terms (likely to cause false positives)
  return Array.from(terms).filter(term => term.length >= 2);
}

async function searchNVD(keyword: string): Promise<NVDResponse | null> {
  const url = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  url.searchParams.set('keywordSearch', keyword);
  url.searchParams.set('keywordExactMatch', 'false');
  url.searchParams.set('resultsPerPage', '50');

  const headers: Record<string, string> = {
    'User-Agent': 'PubGuard-Security-Scanner/2.0',
  };

  if (NVD_API_KEY) {
    headers['apiKey'] = NVD_API_KEY;
  }

  try {
    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`NVD API rate limit for: ${keyword}`);
        return null;
      }
      console.error(`NVD API error: ${response.status} for ${keyword}`);
      return null;
    }

    return response.json();
  } catch (err) {
    console.error('NVD fetch error:', err);
    return null;
  }
}

function extractCVSS(metrics: NVDResponse['vulnerabilities'][0]['cve']['metrics']): {
  score: number | null;
  severity: CVEFinding['severity'];
} {
  if (metrics?.cvssMetricV31?.[0]) {
    return {
      score: metrics.cvssMetricV31[0].cvssData.baseScore,
      severity: metrics.cvssMetricV31[0].cvssData.baseSeverity as CVEFinding['severity'],
    };
  }
  if (metrics?.cvssMetricV30?.[0]) {
    return {
      score: metrics.cvssMetricV30[0].cvssData.baseScore,
      severity: metrics.cvssMetricV30[0].cvssData.baseSeverity as CVEFinding['severity'],
    };
  }
  return { score: null, severity: 'MEDIUM' };
}

function extractAffectedVersions(
  configurations: NVDResponse['vulnerabilities'][0]['cve']['configurations']
): string[] {
  const versions: string[] = [];

  configurations?.forEach(config => {
    config.nodes?.forEach(node => {
      node.cpeMatch?.forEach(match => {
        if (match.vulnerable) {
          if (match.versionEndIncluding) {
            versions.push(`<= ${match.versionEndIncluding}`);
          }
          if (match.versionStartIncluding && match.versionEndIncluding) {
            versions.push(`${match.versionStartIncluding} - ${match.versionEndIncluding}`);
          }
        }
      });
    });
  });

  return [...new Set(versions)].slice(0, 5);
}

// Check if CVE is relevant to the project (reduce false positives)
function isRelevantCVE(cve: NVDResponse['vulnerabilities'][0]['cve'], projectName: string, searchTerm: string): boolean {
  const desc = cve.descriptions.find(d => d.lang === 'en')?.value?.toLowerCase() || '';
  const lowerProject = projectName.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();

  // Check if project name appears in description
  if (desc.includes(lowerProject) || desc.includes(lowerTerm)) {
    return true;
  }

  // Check CPE strings for the project
  const cpeStrings = cve.configurations?.flatMap(c =>
    c.nodes?.flatMap(n =>
      n.cpeMatch?.map(m => m.criteria.toLowerCase()) || []
    ) || []
  ) || [];

  for (const cpe of cpeStrings) {
    if (cpe.includes(lowerProject) || cpe.includes(lowerTerm.replace(/-/g, '_'))) {
      return true;
    }
  }

  return false;
}

export async function analyzeCVEs(
  projectName: string,
  owner: string = '',
  alternateNames: string[] = []
): Promise<{
  analysis: CVEAnalysis;
  findings: Finding[];
}> {
  // Generate comprehensive search terms
  const searchTerms = generateSearchTerms(projectName, owner, alternateNames);
  console.log(`[CVE] Searching for: ${searchTerms.join(', ')}`);

  const allVulnerabilities: CVEFinding[] = [];
  const seenIds = new Set<string>();

  // Search for each term (limit to avoid rate limits)
  const termsToSearch = searchTerms.slice(0, 5); // Max 5 searches

  for (const term of termsToSearch) {
    // Add delay between requests to respect rate limits
    if (termsToSearch.indexOf(term) > 0) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
    }

    console.log(`[CVE] Searching NVD for: "${term}"`);
    const result = await searchNVD(term);
    if (!result) continue;

    console.log(`[CVE] Found ${result.totalResults} results for "${term}"`);

    for (const vuln of result.vulnerabilities) {
      if (seenIds.has(vuln.cve.id)) continue;

      // Relevance check to reduce false positives
      if (!isRelevantCVE(vuln.cve, projectName, term)) {
        continue;
      }

      seenIds.add(vuln.cve.id);

      const { score, severity } = extractCVSS(vuln.cve.metrics);
      const englishDesc = vuln.cve.descriptions.find(d => d.lang === 'en');

      allVulnerabilities.push({
        id: vuln.cve.id,
        description: englishDesc?.value || 'No description available',
        severity,
        cvssScore: score,
        publishedDate: vuln.cve.published,
        affectedVersions: extractAffectedVersions(vuln.cve.configurations),
        references: vuln.cve.references?.map(r => r.url).slice(0, 5) || [],
        status: vuln.cve.vulnStatus === 'Analyzed' ? 'open' :
                vuln.cve.vulnStatus === 'Modified' ? 'fixed' : 'open',
      });
    }
  }

  // Sort by severity
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  allVulnerabilities.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Determine highest severity
  let highestSeverity: CVEAnalysis['highestSeverity'] = null;
  if (allVulnerabilities.length > 0) {
    highestSeverity = allVulnerabilities[0].severity;
  }

  const analysis: CVEAnalysis = {
    searchTerms: termsToSearch,
    totalFound: allVulnerabilities.length,
    vulnerabilities: allVulnerabilities,
    highestSeverity,
  };

  // Generate findings
  const findings: Finding[] = [];

  const criticalCVEs = allVulnerabilities.filter(v => v.severity === 'CRITICAL');
  const highCVEs = allVulnerabilities.filter(v => v.severity === 'HIGH');
  const mediumCVEs = allVulnerabilities.filter(v => v.severity === 'MEDIUM');

  if (criticalCVEs.length > 0) {
    findings.push({
      severity: 'critical',
      category: 'CVE Database',
      title: `${criticalCVEs.length} CRITICAL CVE(s) found`,
      description: criticalCVEs.slice(0, 3).map(c => `${c.id}: ${c.description.slice(0, 100)}...`).join('\n'),
      source: 'NVD Database',
      sourceUrl: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(projectName)}`,
    });
  }

  if (highCVEs.length > 0) {
    findings.push({
      severity: 'high',
      category: 'CVE Database',
      title: `${highCVEs.length} HIGH severity CVE(s) found`,
      description: highCVEs.slice(0, 3).map(c => `${c.id}: ${c.description.slice(0, 100)}...`).join('\n'),
      source: 'NVD Database',
      sourceUrl: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(projectName)}`,
    });
  }

  if (mediumCVEs.length > 0) {
    findings.push({
      severity: 'medium',
      category: 'CVE Database',
      title: `${mediumCVEs.length} MEDIUM severity CVE(s) found`,
      description: mediumCVEs.slice(0, 2).map(c => `${c.id}: ${c.description.slice(0, 80)}...`).join('\n'),
      source: 'NVD Database',
      sourceUrl: `https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(projectName)}`,
    });
  }

  if (allVulnerabilities.length === 0) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'No CVEs found in NVD database',
      description: `No known vulnerabilities registered for search terms: ${termsToSearch.join(', ')}`,
      source: 'NVD Database',
    });
  }

  console.log(`[CVE] Total unique CVEs found: ${allVulnerabilities.length}`);

  return { analysis, findings };
}

// Search for CVEs related to dependencies
export async function analyzeDependencyCVEs(
  dependencies: string[]
): Promise<CVEFinding[]> {
  const allVulns: CVEFinding[] = [];
  const seenIds = new Set<string>();

  // Only check major/notable dependencies to avoid rate limits
  const majorDeps = dependencies.slice(0, 10);

  for (const dep of majorDeps) {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = await searchNVD(dep);
    if (!result) continue;

    for (const vuln of result.vulnerabilities) {
      if (seenIds.has(vuln.cve.id)) continue;
      seenIds.add(vuln.cve.id);

      const { score, severity } = extractCVSS(vuln.cve.metrics);

      // Only include HIGH/CRITICAL
      if (severity !== 'CRITICAL' && severity !== 'HIGH') continue;

      const englishDesc = vuln.cve.descriptions.find(d => d.lang === 'en');

      allVulns.push({
        id: vuln.cve.id,
        description: `[${dep}] ${englishDesc?.value || 'No description'}`,
        severity,
        cvssScore: score,
        publishedDate: vuln.cve.published,
        affectedVersions: extractAffectedVersions(vuln.cve.configurations),
        references: vuln.cve.references?.map(r => r.url).slice(0, 3) || [],
        status: 'open',
      });
    }
  }

  return allVulns;
}