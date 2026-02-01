// app/api/pubguard/v2/analyzers/cve.ts
// CVE/NVD vulnerability database analysis - FIXED for XZ and high-profile CVEs

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

// HIGH-PROFILE CVE MAPPINGS - Projects with known critical vulnerabilities
// These bypass normal search and directly query for specific CVE IDs
const HIGH_PROFILE_CVES: Record<string, string[]> = {
  'xz': ['CVE-2024-3094'],
  'xz-utils': ['CVE-2024-3094'],
  'liblzma': ['CVE-2024-3094'],
  'tukaani-project/xz': ['CVE-2024-3094'],
  'log4j': ['CVE-2021-44228', 'CVE-2021-45046', 'CVE-2021-45105', 'CVE-2021-44832'],
  'apache/log4j': ['CVE-2021-44228', 'CVE-2021-45046'],
  'spring-framework': ['CVE-2022-22965'],
  'spring-core': ['CVE-2022-22965'],
  'openssl': ['CVE-2022-3602', 'CVE-2022-3786', 'CVE-2014-0160'],
  'heartbleed': ['CVE-2014-0160'],
  'struts': ['CVE-2017-5638'],
  'apache/struts': ['CVE-2017-5638'],
  'shellshock': ['CVE-2014-6271'],
  'bash': ['CVE-2014-6271'],
  'polkit': ['CVE-2021-4034'],
  'pkexec': ['CVE-2021-4034'],
  'sudo': ['CVE-2021-3156'],
  'dirty-pipe': ['CVE-2022-0847'],
  'dirty-cow': ['CVE-2016-5195'],
};

// Generate smart search terms from project name
function generateSearchTerms(projectName: string, owner: string, alternateNames: string[]): string[] {
  const terms = new Set<string>();

  // Original name
  terms.add(projectName);

  // Full path format
  if (owner) {
    terms.add(`${owner}/${projectName}`);
    terms.add(`${owner} ${projectName}`);
  }

  // Handle hyphenated names - search both parts
  if (projectName.includes('-')) {
    const parts = projectName.split('-');
    parts.forEach(part => {
      if (part.length > 2) terms.add(part);
    });
    terms.add(parts.join(''));
  }

  // Handle underscored names
  if (projectName.includes('_')) {
    const parts = projectName.split('_');
    parts.forEach(part => {
      if (part.length > 2) terms.add(part);
    });
    terms.add(parts.join('-'));
  }

  // Common library name patterns
  const lowerName = projectName.toLowerCase();

  // If ends with common suffixes, also search without
  const suffixes = ['-js', '-py', '-core', '-lib', '-node', '-cli', '-sdk', '-api', '-utils'];
  for (const suffix of suffixes) {
    if (lowerName.endsWith(suffix)) {
      terms.add(projectName.slice(0, -suffix.length));
    }
  }

  // If starts with common prefixes, also search without
  const prefixes = ['node-', 'python-', 'js-', 'go-', 'rust-', 'lib'];
  for (const prefix of prefixes) {
    if (lowerName.startsWith(prefix)) {
      terms.add(projectName.slice(prefix.length));
    }
  }

  // Known vulnerability-prone project mappings
  const knownMappings: Record<string, string[]> = {
    'xz': ['xz', 'xz-utils', 'liblzma', 'tukaani xz'],
    'xz-utils': ['xz', 'xz-utils', 'liblzma'],
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

// Search NVD by keyword
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
        console.warn(`[CVE] NVD API rate limit for: ${keyword}`);
        return null;
      }
      console.error(`[CVE] NVD API error: ${response.status} for ${keyword}`);
      return null;
    }

    return response.json();
  } catch (err) {
    console.error('[CVE] NVD fetch error:', err);
    return null;
  }
}

// Search NVD by specific CVE ID
async function searchNVDByCVEId(cveId: string): Promise<NVDResponse | null> {
  const url = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  url.searchParams.set('cveId', cveId);

  const headers: Record<string, string> = {
    'User-Agent': 'PubGuard-Security-Scanner/2.0',
  };

  if (NVD_API_KEY) {
    headers['apiKey'] = NVD_API_KEY;
  }

  try {
    console.log(`[CVE] Fetching specific CVE: ${cveId}`);
    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`[CVE] NVD API rate limit for CVE ID: ${cveId}`);
        return null;
      }
      console.error(`[CVE] NVD API error: ${response.status} for CVE ID ${cveId}`);
      return null;
    }

    return response.json();
  } catch (err) {
    console.error('[CVE] NVD fetch error for CVE ID:', err);
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

// IMPROVED: Check if CVE is relevant to the project (reduce false positives)
// Now more lenient and includes high-profile CVE bypass
function isRelevantCVE(
  cve: NVDResponse['vulnerabilities'][0]['cve'],
  projectName: string,
  searchTerm: string,
  isHighProfileCVE: boolean = false
): boolean {
  // High-profile CVEs from direct lookup are always relevant
  if (isHighProfileCVE) {
    return true;
  }

  const desc = cve.descriptions.find(d => d.lang === 'en')?.value?.toLowerCase() || '';
  const lowerProject = projectName.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();

  // Check if project name appears in description (with variations)
  const searchVariations = [
    lowerProject,
    lowerTerm,
    lowerProject.replace(/-/g, ''),
    lowerProject.replace(/-/g, ' '),
    lowerTerm.replace(/-/g, ''),
    lowerTerm.replace(/-/g, ' '),
  ];

  for (const variant of searchVariations) {
    if (variant.length > 2 && desc.includes(variant)) {
      return true;
    }
  }

  // Check CVE ID itself contains relevant info
  const cveId = cve.id.toLowerCase();

  // Check CPE strings for the project
  const cpeStrings = cve.configurations?.flatMap(c =>
    c.nodes?.flatMap(n =>
      n.cpeMatch?.map(m => m.criteria.toLowerCase()) || []
    ) || []
  ) || [];

  for (const cpe of cpeStrings) {
    for (const variant of searchVariations) {
      if (variant.length > 2 && cpe.includes(variant)) {
        return true;
      }
    }
    // Also check underscore variants for CPE
    if (cpe.includes(lowerProject.replace(/-/g, '_'))) {
      return true;
    }
  }

  // Check references for GitHub repo
  const references = cve.references?.map(r => r.url.toLowerCase()) || [];
  for (const ref of references) {
    if (ref.includes(lowerProject) || ref.includes(lowerTerm)) {
      return true;
    }
  }

  return false;
}

// Get high-profile CVE IDs for a project
function getHighProfileCVEs(projectName: string, owner: string): string[] {
  const cveIds: string[] = [];
  const lowerName = projectName.toLowerCase();
  const fullPath = `${owner}/${projectName}`.toLowerCase();

  // Check all variations
  const keysToCheck = [lowerName, fullPath, owner.toLowerCase()];

  for (const key of keysToCheck) {
    if (HIGH_PROFILE_CVES[key]) {
      cveIds.push(...HIGH_PROFILE_CVES[key]);
    }
  }

  return [...new Set(cveIds)];
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

  // ==========================================================================
  // PHASE 1: Check for HIGH-PROFILE CVEs first (direct CVE ID lookup)
  // ==========================================================================
  const highProfileCVEIds = getHighProfileCVEs(projectName, owner);

  if (highProfileCVEIds.length > 0) {
    console.log(`[CVE] ⚠️ HIGH-PROFILE project detected! Checking specific CVEs: ${highProfileCVEIds.join(', ')}`);

    for (const cveId of highProfileCVEIds) {
      if (seenIds.has(cveId)) continue;

      // Add delay between requests
      if (highProfileCVEIds.indexOf(cveId) > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const result = await searchNVDByCVEId(cveId);
      if (!result || result.vulnerabilities.length === 0) continue;

      const vuln = result.vulnerabilities[0];
      seenIds.add(vuln.cve.id);

      const { score, severity } = extractCVSS(vuln.cve.metrics);
      const englishDesc = vuln.cve.descriptions.find(d => d.lang === 'en');

      console.log(`[CVE] 🚨 Found high-profile CVE: ${vuln.cve.id} (${severity}, CVSS: ${score})`);

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

  // ==========================================================================
  // PHASE 2: Standard keyword search (if no high-profile CVEs found)
  // ==========================================================================
  const termsToSearch = searchTerms.slice(0, 5); // Max 5 searches

  for (const term of termsToSearch) {
    // Add delay between requests to respect rate limits
    if (termsToSearch.indexOf(term) > 0 || highProfileCVEIds.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
    }

    console.log(`[CVE] Searching NVD for: "${term}"`);
    const result = await searchNVD(term);
    if (!result) continue;

    console.log(`[CVE] Found ${result.totalResults} results for "${term}"`);

    for (const vuln of result.vulnerabilities) {
      if (seenIds.has(vuln.cve.id)) continue;

      // Relevance check to reduce false positives
      if (!isRelevantCVE(vuln.cve, projectName, term, false)) {
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
      title: `🚨 ${criticalCVEs.length} CRITICAL CVE(s) found`,
      description: criticalCVEs.slice(0, 3).map(c =>
        `${c.id} (CVSS ${c.cvssScore}): ${c.description.slice(0, 150)}...`
      ).join('\n\n'),
      source: 'NVD Database',
      sourceUrl: `https://nvd.nist.gov/vuln/detail/${criticalCVEs[0].id}`,
    });
  }

  if (highCVEs.length > 0) {
    findings.push({
      severity: 'high',
      category: 'CVE Database',
      title: `⚠️ ${highCVEs.length} HIGH severity CVE(s) found`,
      description: highCVEs.slice(0, 3).map(c =>
        `${c.id} (CVSS ${c.cvssScore}): ${c.description.slice(0, 100)}...`
      ).join('\n\n'),
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
  if (criticalCVEs.length > 0) {
    console.log(`[CVE] 🚨 CRITICAL CVEs: ${criticalCVEs.map(c => c.id).join(', ')}`);
  }

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