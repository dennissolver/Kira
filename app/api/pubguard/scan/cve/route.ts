// app/api/pubguard/scan/cve/route.ts
// CVE/NVD Vulnerability Database Scanner

import { NextRequest, NextResponse } from 'next/server';
import type { CVEResult, CVEScanResult } from '../../types';

// NVD API base URL (v2.0)
const NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

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
        cvssMetricV2?: {
          cvssData: {
            baseScore: number;
            vectorString: string;
          };
          baseSeverity: string;
        }[];
      };
      weaknesses?: {
        description: { lang: string; value: string }[];
      }[];
      references?: {
        url: string;
        source: string;
      }[];
      configurations?: {
        nodes: {
          cpeMatch: {
            vulnerable: boolean;
            criteria: string;
          }[];
        }[];
      }[];
    };
  }[];
}

// Parse severity from CVSS score
function getSeverityFromScore(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

// Extract CVSS data from NVD response
function extractCVSS(metrics: NVDResponse['vulnerabilities'][0]['cve']['metrics']): {
  score: number | null;
  vector: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
} {
  // Prefer v3.1, then v3.0, then v2
  if (metrics?.cvssMetricV31?.[0]) {
    const cvss = metrics.cvssMetricV31[0].cvssData;
    return {
      score: cvss.baseScore,
      vector: cvss.vectorString,
      severity: cvss.baseSeverity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    };
  }
  
  if (metrics?.cvssMetricV30?.[0]) {
    const cvss = metrics.cvssMetricV30[0].cvssData;
    return {
      score: cvss.baseScore,
      vector: cvss.vectorString,
      severity: cvss.baseSeverity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    };
  }
  
  if (metrics?.cvssMetricV2?.[0]) {
    const cvss = metrics.cvssMetricV2[0];
    return {
      score: cvss.cvssData.baseScore,
      vector: cvss.cvssData.vectorString,
      severity: cvss.baseSeverity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    };
  }
  
  return { score: null, vector: null, severity: 'MEDIUM' };
}

// Extract affected products from CPE strings
function extractAffectedProducts(configurations: NVDResponse['vulnerabilities'][0]['cve']['configurations']): string[] {
  const products = new Set<string>();
  
  configurations?.forEach(config => {
    config.nodes?.forEach(node => {
      node.cpeMatch?.forEach(match => {
        if (match.vulnerable) {
          // Parse CPE string: cpe:2.3:a:vendor:product:version:...
          const parts = match.criteria.split(':');
          if (parts.length >= 5) {
            const vendor = parts[3];
            const product = parts[4];
            const version = parts[5] !== '*' ? parts[5] : '';
            products.add(`${vendor}/${product}${version ? `:${version}` : ''}`);
          }
        }
      });
    });
  });
  
  return Array.from(products).slice(0, 10); // Limit to 10 products
}

// Transform NVD response to our format
function transformCVE(nvdCve: NVDResponse['vulnerabilities'][0]['cve']): CVEResult {
  const cvss = extractCVSS(nvdCve.metrics);
  
  const englishDesc = nvdCve.descriptions.find(d => d.lang === 'en');
  
  const cweIds = nvdCve.weaknesses?.flatMap(w => 
    w.description
      .filter(d => d.lang === 'en' && d.value.startsWith('CWE-'))
      .map(d => d.value)
  ) || [];
  
  return {
    id: nvdCve.id,
    description: englishDesc?.value || 'No description available',
    severity: cvss.severity,
    cvssScore: cvss.score,
    cvssVector: cvss.vector,
    publishedDate: nvdCve.published,
    lastModifiedDate: nvdCve.lastModified,
    references: nvdCve.references?.map(r => r.url).slice(0, 5) || [],
    affectedProducts: extractAffectedProducts(nvdCve.configurations),
    cweIds: [...new Set(cweIds)],
  };
}

// Search NVD API
async function searchNVD(params: {
  keyword?: string;
  cveId?: string;
  cpeMatchString?: string;
  lastModStartDate?: string;
  lastModEndDate?: string;
  resultsPerPage?: number;
  startIndex?: number;
}): Promise<NVDResponse> {
  const url = new URL(NVD_API_BASE);
  
  if (params.keyword) {
    url.searchParams.set('keywordSearch', params.keyword);
    url.searchParams.set('keywordExactMatch', 'false');
  }
  if (params.cveId) url.searchParams.set('cveId', params.cveId);
  if (params.cpeMatchString) url.searchParams.set('cpeMatchString', params.cpeMatchString);
  if (params.lastModStartDate) url.searchParams.set('lastModStartDate', params.lastModStartDate);
  if (params.lastModEndDate) url.searchParams.set('lastModEndDate', params.lastModEndDate);
  url.searchParams.set('resultsPerPage', String(params.resultsPerPage || 20));
  url.searchParams.set('startIndex', String(params.startIndex || 0));
  
  const headers: Record<string, string> = {
    'User-Agent': 'PubGuard-Scanner',
  };
  
  // Add API key if available (increases rate limit)
  if (process.env.NVD_API_KEY) {
    headers['apiKey'] = process.env.NVD_API_KEY;
  }
  
  const response = await fetch(url.toString(), { headers });
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('NVD API rate limit exceeded. Try again later or add an API key.');
    }
    throw new Error(`NVD API error: ${response.status}`);
  }
  
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query,           // Keyword search
      cveId,           // Specific CVE ID
      product,         // Product name (for CPE search)
      vendor,          // Vendor name (for CPE search)
      daysBack = 90,   // How far back to search
      limit = 20,      // Max results
    } = body;

    if (!query && !cveId && !product) {
      return NextResponse.json(
        { error: 'Query, CVE ID, or product name is required' },
        { status: 400 }
      );
    }

    // Build search parameters
    const searchParams: Parameters<typeof searchNVD>[0] = {
      resultsPerPage: Math.min(limit, 50),
    };

    if (cveId) {
      // Direct CVE lookup
      searchParams.cveId = cveId.toUpperCase();
    } else if (product || vendor) {
      // CPE-based search
      const cpeParts = ['cpe:2.3:*', vendor || '*', product || '*', '*'].join(':');
      searchParams.cpeMatchString = cpeParts;
    } else if (query) {
      // Keyword search
      searchParams.keyword = query;
      
      // Add date range for keyword searches
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      
      searchParams.lastModStartDate = startDate.toISOString();
      searchParams.lastModEndDate = endDate.toISOString();
    }

    const nvdResponse = await searchNVD(searchParams);

    // Transform results
    const vulnerabilities: CVEResult[] = nvdResponse.vulnerabilities
      .map(v => transformCVE(v.cve))
      .sort((a, b) => {
        // Sort by severity, then by date
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
      });

    const result: CVEScanResult = {
      query: cveId || product || query || '',
      totalResults: nvdResponse.totalResults,
      vulnerabilities,
      scannedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('CVE scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan CVE database' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  const cveId = request.nextUrl.searchParams.get('cveId');
  const product = request.nextUrl.searchParams.get('product');
  const vendor = request.nextUrl.searchParams.get('vendor');
  const daysBack = request.nextUrl.searchParams.get('daysBack');
  const limit = request.nextUrl.searchParams.get('limit');

  if (!query && !cveId && !product) {
    return NextResponse.json(
      { error: 'Query, cveId, or product parameter is required' },
      { status: 400 }
    );
  }

  const fakeRequest = {
    json: async () => ({
      query,
      cveId,
      product,
      vendor,
      daysBack: daysBack ? parseInt(daysBack) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    }),
  } as NextRequest;

  return POST(fakeRequest);
}
