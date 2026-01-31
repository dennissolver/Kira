// app/api/pubguard/scan/exposures/route.ts
// Infrastructure Exposure Scanner - checks for open ports, SSL issues, security headers

import { NextRequest, NextResponse } from 'next/server';
import type { ExposureResult, ExposureScanResult, RiskLevel } from '../../types';

// Required security headers and their importance
const SECURITY_HEADERS = [
  { name: 'Strict-Transport-Security', critical: true },
  { name: 'Content-Security-Policy', critical: true },
  { name: 'X-Content-Type-Options', critical: false },
  { name: 'X-Frame-Options', critical: false },
  { name: 'X-XSS-Protection', critical: false },
  { name: 'Referrer-Policy', critical: false },
  { name: 'Permissions-Policy', critical: false },
];

// Known risky ports
const RISKY_PORTS = [
  { port: 21, service: 'FTP', risk: 'Unencrypted file transfer' },
  { port: 23, service: 'Telnet', risk: 'Unencrypted remote access' },
  { port: 25, service: 'SMTP', risk: 'Email relay (if open)' },
  { port: 135, service: 'MSRPC', risk: 'Windows RPC vulnerability target' },
  { port: 139, service: 'NetBIOS', risk: 'Windows file sharing' },
  { port: 445, service: 'SMB', risk: 'Ransomware target (EternalBlue)' },
  { port: 1433, service: 'MSSQL', risk: 'Database exposure' },
  { port: 1521, service: 'Oracle', risk: 'Database exposure' },
  { port: 3306, service: 'MySQL', risk: 'Database exposure' },
  { port: 3389, service: 'RDP', risk: 'Remote desktop brute force target' },
  { port: 5432, service: 'PostgreSQL', risk: 'Database exposure' },
  { port: 5900, service: 'VNC', risk: 'Remote desktop exposure' },
  { port: 6379, service: 'Redis', risk: 'Often unauthenticated' },
  { port: 9200, service: 'Elasticsearch', risk: 'Often unauthenticated' },
  { port: 27017, service: 'MongoDB', risk: 'Often unauthenticated' },
];

// Check if domain/IP resolves
async function resolveDomain(target: string): Promise<{ ip?: string; error?: string }> {
  try {
    // Use DNS over HTTPS for resolution
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(target)}&type=A`);
    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      return { ip: data.Answer[0].data };
    }
    
    return { error: 'Domain does not resolve' };
  } catch (error) {
    return { error: 'DNS resolution failed' };
  }
}

// Check SSL certificate
async function checkSSL(domain: string): Promise<ExposureResult['certificates']> {
  try {
    // We'll use a free SSL checker API
    // Alternative: Use Node's TLS module directly in a serverless function
    const response = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&fromCache=on&maxAge=24`, {
      headers: { 'User-Agent': 'PubGuard-Scanner' },
    });
    
    if (!response.ok) {
      // Fallback: Just check if HTTPS works
      try {
        const httpsCheck = await fetch(`https://${domain}`, {
          method: 'HEAD',
          redirect: 'manual',
        });
        
        // If we get here, SSL is working
        return [{
          issuer: 'Unknown (basic check only)',
          subject: domain,
          validFrom: '',
          validTo: '',
          isExpired: false,
          daysUntilExpiry: -1, // Unknown
        }];
      } catch {
        return undefined;
      }
    }

    const data = await response.json();
    
    if (data.endpoints && data.endpoints[0]?.details?.cert) {
      const cert = data.endpoints[0].details.cert;
      const notAfter = new Date(cert.notAfter);
      const now = new Date();
      const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return [{
        issuer: cert.issuerSubject || 'Unknown',
        subject: cert.subject || domain,
        validFrom: new Date(cert.notBefore).toISOString(),
        validTo: notAfter.toISOString(),
        isExpired: daysUntilExpiry < 0,
        daysUntilExpiry,
      }];
    }
    
    return undefined;
  } catch (error) {
    console.error('SSL check error:', error);
    return undefined;
  }
}

// Check security headers
async function checkHeaders(domain: string): Promise<ExposureResult['headers']> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      redirect: 'follow',
    });

    const serverHeader = response.headers.get('server');
    
    const securityHeaders = SECURITY_HEADERS.map(header => ({
      name: header.name,
      present: response.headers.has(header.name),
      value: response.headers.get(header.name) || undefined,
    }));

    return {
      server: serverHeader || undefined,
      securityHeaders,
    };
  } catch (error) {
    // Try HTTP fallback
    try {
      const response = await fetch(`http://${domain}`, {
        method: 'HEAD',
        redirect: 'follow',
      });

      return {
        server: response.headers.get('server') || undefined,
        securityHeaders: SECURITY_HEADERS.map(header => ({
          name: header.name,
          present: response.headers.has(header.name),
          value: response.headers.get(header.name) || undefined,
        })),
      };
    } catch {
      return undefined;
    }
  }
}

// Check for open ports using Shodan API (if available)
async function checkPortsWithShodan(ip: string): Promise<ExposureResult['ports']> {
  const apiKey = process.env.SHODAN_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`https://api.shodan.io/shodan/host/${ip}?key=${apiKey}`);
    
    if (!response.ok) {
      if (response.status === 404) return []; // No data for this IP
      throw new Error(`Shodan API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.data || []).map((service: any) => {
      const riskyPort = RISKY_PORTS.find(p => p.port === service.port);
      
      return {
        port: service.port,
        protocol: service.transport || 'tcp',
        service: service.product || service._shodan?.module || 'Unknown',
        version: service.version || undefined,
        vulnerable: riskyPort !== undefined,
      };
    });
  } catch (error) {
    console.error('Shodan check error:', error);
    return [];
  }
}

// Alternative: Check common ports directly (limited without Shodan)
async function checkCommonPorts(domain: string): Promise<ExposureResult['ports']> {
  // In a browser/edge environment, we can't do port scanning directly
  // This is a placeholder that would work in a Node.js environment with net module
  // For now, we'll just check if common web ports respond
  
  const ports: ExposureResult['ports'] = [];
  
  // Check HTTPS (443)
  try {
    await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    ports.push({ port: 443, protocol: 'tcp', service: 'HTTPS', vulnerable: false });
  } catch {
    // Port might be closed or blocked
  }
  
  // Check HTTP (80)
  try {
    await fetch(`http://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    ports.push({ port: 80, protocol: 'tcp', service: 'HTTP', vulnerable: true }); // HTTP is inherently less secure
  } catch {
    // Port might be closed or blocked
  }
  
  return ports;
}

// Calculate risk score and factors
function calculateRisk(exposure: Omit<ExposureResult, 'riskFactors' | 'riskScore' | 'riskLevel'>): {
  riskFactors: string[];
  riskScore: number;
  riskLevel: RiskLevel;
} {
  const riskFactors: string[] = [];
  let score = 0;

  // Check SSL certificate issues
  if (exposure.certificates) {
    exposure.certificates.forEach(cert => {
      if (cert.isExpired) {
        score += 30;
        riskFactors.push('SSL certificate is expired');
      } else if (cert.daysUntilExpiry >= 0 && cert.daysUntilExpiry < 30) {
        score += 15;
        riskFactors.push(`SSL certificate expires in ${cert.daysUntilExpiry} days`);
      }
    });
  } else {
    score += 20;
    riskFactors.push('No SSL certificate detected or HTTPS not configured');
  }

  // Check security headers
  if (exposure.headers) {
    const missingCritical = exposure.headers.securityHeaders.filter(
      h => !h.present && SECURITY_HEADERS.find(sh => sh.name === h.name)?.critical
    );
    
    if (missingCritical.length > 0) {
      score += missingCritical.length * 10;
      riskFactors.push(`Missing critical security headers: ${missingCritical.map(h => h.name).join(', ')}`);
    }

    const missingOther = exposure.headers.securityHeaders.filter(
      h => !h.present && !SECURITY_HEADERS.find(sh => sh.name === h.name)?.critical
    );
    
    if (missingOther.length > 0) {
      score += missingOther.length * 3;
      riskFactors.push(`Missing recommended headers: ${missingOther.map(h => h.name).join(', ')}`);
    }

    // Server header disclosure
    if (exposure.headers.server) {
      score += 5;
      riskFactors.push(`Server version disclosed: ${exposure.headers.server}`);
    }
  }

  // Check exposed ports
  if (exposure.ports) {
    const vulnerablePorts = exposure.ports.filter(p => p.vulnerable);
    if (vulnerablePorts.length > 0) {
      vulnerablePorts.forEach(p => {
        const riskyPort = RISKY_PORTS.find(rp => rp.port === p.port);
        score += 15;
        riskFactors.push(`Risky port ${p.port} (${p.service}) open${riskyPort ? `: ${riskyPort.risk}` : ''}`);
      });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let riskLevel: RiskLevel;
  if (score >= 70) riskLevel = 'critical';
  else if (score >= 50) riskLevel = 'high';
  else if (score >= 25) riskLevel = 'medium';
  else riskLevel = 'low';

  return { riskFactors, riskScore: score, riskLevel };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { target } = body; // Domain or IP address

    if (!target) {
      return NextResponse.json(
        { error: 'Target domain or IP is required' },
        { status: 400 }
      );
    }

    // Clean target
    const cleanTarget = target
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();

    // Determine if IP or domain
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanTarget);
    const type = isIP ? 'ip' : 'domain';

    // Resolve domain to IP if needed
    let ip: string | undefined;
    if (!isIP) {
      const resolution = await resolveDomain(cleanTarget);
      if (resolution.error) {
        return NextResponse.json(
          { error: resolution.error },
          { status: 400 }
        );
      }
      ip = resolution.ip;
    } else {
      ip = cleanTarget;
    }

    // Run checks in parallel
    const [certificates, headers, shodanPorts, basicPorts] = await Promise.all([
      !isIP ? checkSSL(cleanTarget) : Promise.resolve(undefined),
      !isIP ? checkHeaders(cleanTarget) : Promise.resolve(undefined),
      ip ? checkPortsWithShodan(ip) : Promise.resolve([]),
      !isIP ? checkCommonPorts(cleanTarget) : Promise.resolve([]),
    ]);

    // Merge port results
    const ports = [...shodanPorts];
    basicPorts.forEach(bp => {
      if (!ports.find(p => p.port === bp.port)) {
        ports.push(bp);
      }
    });

    // Build exposure object
    const partialExposure = {
      ip,
      domain: !isIP ? cleanTarget : undefined,
      ports,
      certificates,
      headers,
    };

    // Calculate risk
    const { riskFactors, riskScore, riskLevel } = calculateRisk(partialExposure);

    const exposure: ExposureResult = {
      ...partialExposure,
      riskFactors,
      riskScore,
      riskLevel,
    };

    const result: ExposureScanResult = {
      target: cleanTarget,
      type,
      exposure,
      scannedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Exposure scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan for exposures' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('target');

  if (!target) {
    return NextResponse.json(
      { error: 'Target parameter is required' },
      { status: 400 }
    );
  }

  const fakeRequest = {
    json: async () => ({ target }),
  } as NextRequest;

  return POST(fakeRequest);
}
