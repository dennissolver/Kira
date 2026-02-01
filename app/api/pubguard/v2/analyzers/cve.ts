// app/api/pubguard/v2/analyzers/cve.ts
// CVE/NVD vulnerability database analysis

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

async function searchNVD(keyword: string): Promise<NVDResponse | null> {
  const url = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  url.searchParams.set('keywordSearch', keyword);
  url.searchParams.set('keywordExactMatch', 'false');
  url.searchParams.set('resultsPerPage', '50');

  const headers: Record<string, string> = {
    'User-Agent': 'PubGuard-Security-Scanner',
  };

  if (NVD_API_KEY) {
    headers['apiKey'] = NVD_API_KEY;
  }

  try {
    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('NVD API rate limit - waiting...');
        return null;
      }
      console.error(`NVD API error: ${response.status}`);
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

export async function analyzeCVEs(
  projectName: string,
  alternateNames: string[] = []
): Promise<{
  analysis: CVEAnalysis;
  findings: Finding[];
}> {
  const searchTerms = [projectName, ...alternateNames].filter(Boolean);
  const allVulnerabilities: CVEFinding[] = [];
  const seenIds = new Set<string>();

  // Search for each term
  for (const term of searchTerms) {
    // Add delay between requests to respect rate limits
    if (searchTerms.indexOf(term) > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const result = await searchNVD(term);
    if (!result) continue;

    for (const vuln of result.vulnerabilities) {
      if (seenIds.has(vuln.cve.id)) continue;
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
    searchTerms,
    totalFound: allVulnerabilities.length,
    vulnerabilities: allVulnerabilities,
    highestSeverity,
  };

  // Generate findings
  const findings: Finding[] = [];

  const criticalCVEs = allVulnerabilities.filter(v => v.severity === 'CRITICAL');
  const highCVEs = allVulnerabilities.filter(v => v.severity === 'HIGH');

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

  if (allVulnerabilities.length === 0) {
    findings.push({
      severity: 'low',
      category: 'Positive',
      title: 'No CVEs found in NVD database',
      description: `No known vulnerabilities registered for search terms: ${searchTerms.join(', ')}`,
      source: 'NVD Database',
    });
  }

  return { analysis, findings };
}

// Search for CVEs related to dependencies
export async function analyzeDepencyCVEs(
  dependencies: string[]
): Promise<CVEFinding[]> {
  const allVulns: CVEFinding[] = [];
  const seenIds = new Set<string>();

  // Only check major/notable dependencies to avoid rate limits
  const majorDeps = dependencies.slice(0, 10);

  for (const dep of majorDeps) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
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
