// components/PubGuardReport.tsx
// PubGuard Security Report with Professional PDF Generation

'use client';

import React, { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, ExternalLink, FileText,
  Loader2, Download, Printer, ArrowLeft, AlertCircle, Clock, Users,
  GitBranch, Star, Code, Database
} from 'lucide-react';
import jsPDF from 'jspdf';

// Type definitions
interface CVEFinding {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore: number | null;
  publishedDate: string;
  affectedVersions: string[];
  references: string[];
  status: 'open' | 'fixed' | 'disputed';
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  source?: string;
  sourceUrl?: string;
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

interface PubGuardReport {
  id: string;
  version: string;
  generatedAt: string;
  target: { url: string; name: string; type: string; };
  trafficLight: 'green' | 'amber' | 'red';
  recommendation: 'SAFE_TO_RECOMMEND' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_RECOMMEND';
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
  github: any | null;
  cve: { searchTerms: string[]; totalFound: number; vulnerabilities: CVEFinding[]; highestSeverity: string | null; } | null;
  news: any | null;
  social: any | null;
  codebase: any | null;
  securityTests: any | null;
  writerGuidance: { canRecommend: boolean; mustDisclose: string[]; suggestedDisclaimer: string; keyPointsToMention: string[]; alternativesToConsider: string[]; };
  disclaimer: string;
  reportHash: string;
}

type UserType = 'writer' | 'developer' | 'user' | 'analyst';

const USER_TYPE_CONFIG: Record<UserType, { label: string; primaryQuestion: string; }> = {
  writer: { label: 'Tech Writer', primaryQuestion: 'Can I recommend this tool?' },
  developer: { label: 'Developer', primaryQuestion: 'What should I fix before shipping?' },
  user: { label: 'User', primaryQuestion: 'Is this safe to install?' },
  analyst: { label: 'Security Analyst', primaryQuestion: 'What are the security implications?' },
};

// PDF Colors
const PDF_COLORS = {
  red: { r: 220, g: 53, b: 69 },
  amber: { r: 255, g: 193, b: 7 },
  green: { r: 40, g: 167, b: 69 },
  darkGray: { r: 52, g: 58, b: 64 },
  lightGray: { r: 108, g: 117, b: 125 },
  white: { r: 255, g: 255, b: 255 },
  critical: { r: 220, g: 53, b: 69 },
  high: { r: 253, g: 126, b: 20 },
};

function getTrafficLightColor(light: string) {
  if (light === 'red') return PDF_COLORS.red;
  if (light === 'amber') return PDF_COLORS.amber;
  return PDF_COLORS.green;
}

function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/[🚨⚠️✓✗🛡️📊🔒❌✅]/g, '').replace(/Ø=Þ¨/g, '').replace(/\r?\n/g, ' ').trim();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Professional PDF Generator
function generatePDF(report: PubGuardReport, userType: UserType): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const setColor = (c: {r:number;g:number;b:number}) => doc.setTextColor(c.r, c.g, c.b);
  const setFill = (c: {r:number;g:number;b:number}) => doc.setFillColor(c.r, c.g, c.b);
  const checkPage = (h: number) => { if (y + h > pageHeight - 25) { doc.addPage(); y = margin; } };

  const tlColor = getTrafficLightColor(report.trafficLight);

  // Header
  setFill(tlColor);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Header background - make it taller for branding
  setFill(tlColor);
  doc.rect(0, 0, pageWidth, 62, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(PDF_COLORS.white);
  doc.text('PUBGUARD SECURITY REPORT', margin, 16);

  // Branding subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered by Kira AI | Corporate AI Solutions', margin, 24);

  // Contact details
  doc.setFontSize(8);
  doc.text('Dennis McMahon | Ph/WhatsApp: +61 402 612 471 | dennis@corporateaisolutions.com', margin, 32);
  doc.text('Web: corporateaisolutions.com | LinkedIn: linkedin.com/in/denniskl', margin, 38);

  // Report details
  doc.setFontSize(10);
  doc.text(`Repository: ${report.target.name}`, margin, 48);
  doc.text(`Generated: ${formatDate(report.generatedAt)}`, margin, 55);
  doc.text(`Report for: ${USER_TYPE_CONFIG[userType].label}`, margin, 62);

  // Rating badge
  const badgeX = pageWidth - margin - 35;
  setFill(PDF_COLORS.white);
  doc.roundedRect(badgeX, 8, 35, 32, 3, 3, 'F');
  doc.setFontSize(9);
  setColor(PDF_COLORS.darkGray);
  doc.text('RATING', badgeX + 17.5, 16, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  setColor(tlColor);
  doc.text(report.trafficLight.toUpperCase(), badgeX + 17.5, 26, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${report.overallRiskScore}/100`, badgeX + 17.5, 36, { align: 'center' });

  y = 70;

  // Executive Summary
  setFill({ r: 248, g: 249, b: 250 });
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(PDF_COLORS.darkGray);
  doc.text('EXECUTIVE SUMMARY', margin + 5, y);

  y += 7;
  const recText = report.recommendation === 'DO_NOT_RECOMMEND'
    ? 'CRITICAL ISSUES FOUND - Do not use this software'
    : report.recommendation === 'PROCEED_WITH_CAUTION'
    ? 'Proceed with caution - review findings before use'
    : 'Appears safe to use with standard precautions';
  setColor(tlColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(recText, margin + 5, y);

  y += 7;
  setColor(PDF_COLORS.darkGray);
  doc.setFont('helvetica', 'normal');
  const counts = `Findings: ${report.findings.critical?.length||0} Critical | ${report.findings.high?.length||0} High | ${report.findings.medium?.length||0} Medium | ${report.findings.positive?.length||0} Positive`;
  doc.text(counts, margin + 5, y);

  y += 15;

  // CVE Section
  if (report.cve && report.cve.vulnerabilities.length > 0) {
    const critCVEs = report.cve.vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const highCVEs = report.cve.vulnerabilities.filter(v => v.severity === 'HIGH');

    if (critCVEs.length > 0) {
      checkPage(50);
      setFill(PDF_COLORS.critical);
      doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
      setColor(PDF_COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CRITICAL VULNERABILITIES - IMMEDIATE ACTION REQUIRED', margin + 5, y + 6);
      y += 14;

      for (const cve of critCVEs) {
        checkPage(40);
        setFill({ r: 255, g: 235, b: 235 });
        doc.roundedRect(margin, y, contentWidth, 35, 2, 2, 'F');

        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        setColor(PDF_COLORS.critical);
        doc.text(cve.id, margin + 5, y);

        if (cve.cvssScore !== null) {
          setFill(PDF_COLORS.critical);
          doc.roundedRect(margin + 40, y - 4, 25, 7, 2, 2, 'F');
          setColor(PDF_COLORS.white);
          doc.setFontSize(8);
          doc.text(`CVSS ${cve.cvssScore}`, margin + 52.5, y, { align: 'center' });
        }

        setColor(PDF_COLORS.lightGray);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Published: ${new Date(cve.publishedDate).toLocaleDateString()}`, margin + 75, y);

        y += 7;
        setColor(PDF_COLORS.darkGray);
        doc.setFontSize(8);
        const desc = cleanText(cve.description);
        const lines = doc.splitTextToSize(desc, contentWidth - 10);
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
          doc.text(lines[i], margin + 5, y);
          y += 4;
        }

        if (cve.references && cve.references[0]) {
          y += 2;
          setColor(PDF_COLORS.lightGray);
          doc.setFontSize(7);
          doc.text(`Ref: ${cve.references[0].substring(0, 65)}...`, margin + 5, y);
        }
        y += 10;
      }
    }

    if (highCVEs.length > 0) {
      checkPage(25);
      setFill(PDF_COLORS.high);
      doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
      setColor(PDF_COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`HIGH SEVERITY VULNERABILITIES (${highCVEs.length})`, margin + 5, y + 5.5);
      y += 12;

      for (const cve of highCVEs.slice(0, 3)) {
        checkPage(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setColor(PDF_COLORS.high);
        doc.text(cve.id, margin + 5, y);
        setColor(PDF_COLORS.lightGray);
        doc.setFont('helvetica', 'normal');
        doc.text(cve.cvssScore ? `CVSS ${cve.cvssScore}` : '', margin + 35, y);
        setColor(PDF_COLORS.darkGray);
        doc.text(cleanText(cve.description).substring(0, 70) + '...', margin + 55, y);
        y += 6;
      }
      y += 5;
    }
  }

  // Risk Breakdown
  checkPage(50);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(PDF_COLORS.darkGray);
  doc.text('RISK SCORE BREAKDOWN', margin, y);
  y += 7;

  setFill(PDF_COLORS.darkGray);
  doc.rect(margin, y, contentWidth, 7, 'F');
  setColor(PDF_COLORS.white);
  doc.setFontSize(8);
  doc.text('Category', margin + 3, y + 5);
  doc.text('Score', margin + 80, y + 5);
  doc.text('Weight', margin + 100, y + 5);
  doc.text('Weighted', margin + 122, y + 5);
  doc.text('Key Factor', margin + 145, y + 5);
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const cat of report.riskCategories) {
    checkPage(8);
    const rowBg = cat.score >= 70 ? { r: 255, g: 235, b: 235 } : cat.score >= 40 ? { r: 255, g: 248, b: 225 } : { r: 235, g: 250, b: 235 };
    setFill(rowBg);
    doc.rect(margin, y, contentWidth, 7, 'F');
    setColor(PDF_COLORS.darkGray);
    doc.setFontSize(7);
    doc.text(cat.name.substring(0, 25), margin + 3, y + 5);
    const scoreCol = cat.score >= 70 ? PDF_COLORS.critical : cat.score >= 40 ? PDF_COLORS.high : PDF_COLORS.green;
    setColor(scoreCol);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cat.score}`, margin + 80, y + 5);
    setColor(PDF_COLORS.lightGray);
    doc.setFont('helvetica', 'normal');
    doc.text(`${Math.round(cat.weight * 100)}%`, margin + 100, y + 5);
    doc.text(`${cat.weightedScore.toFixed(1)}`, margin + 122, y + 5);
    if (cat.factors?.[0]) {
      setColor(PDF_COLORS.darkGray);
      doc.text(cleanText(cat.factors[0]).substring(0, 22), margin + 145, y + 5);
    }
    y += 7;
  }

  setFill(PDF_COLORS.darkGray);
  doc.rect(margin, y, contentWidth, 7, 'F');
  setColor(PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL RISK SCORE', margin + 3, y + 5);
  doc.text(`${report.overallRiskScore}/100`, margin + 122, y + 5);
  y += 12;

  // Findings
  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(PDF_COLORS.darkGray);
  doc.text('FINDINGS SUMMARY', margin, y);
  y += 7;

  const allFindings = [
    ...(report.findings.critical || []).map(f => ({ ...f, level: 'CRITICAL', color: PDF_COLORS.critical })),
    ...(report.findings.high || []).map(f => ({ ...f, level: 'HIGH', color: PDF_COLORS.high })),
    ...(report.findings.positive || []).map(f => ({ ...f, level: 'POSITIVE', color: PDF_COLORS.green })),
  ];

  for (const f of allFindings.slice(0, 10)) {
    checkPage(10);
    setFill(f.color);
    const badgeW = f.level === 'CRITICAL' ? 18 : f.level === 'HIGH' ? 12 : 18;
    doc.roundedRect(margin, y, badgeW, 5, 1, 1, 'F');
    setColor(PDF_COLORS.white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(f.level, margin + badgeW/2, y + 3.5, { align: 'center' });
    setColor(PDF_COLORS.darkGray);
    doc.setFontSize(8);
    doc.text(cleanText(f.title).substring(0, 70), margin + badgeW + 4, y + 3.5);
    y += 7;
  }

  // Writer Guidance
  if (report.trafficLight !== 'green' && report.writerGuidance?.mustDisclose?.length > 0) {
    checkPage(35);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(PDF_COLORS.darkGray);
    doc.text('DISCLOSURE REQUIREMENTS', margin, y);
    y += 6;

    setFill(report.trafficLight === 'red' ? { r: 255, g: 230, b: 230 } : { r: 255, g: 245, b: 220 });
    const boxH = 6 + report.writerGuidance.mustDisclose.length * 5;
    doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'F');
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(PDF_COLORS.darkGray);
    for (const item of report.writerGuidance.mustDisclose.slice(0, 5)) {
      doc.text('• ' + cleanText(item).substring(0, 80), margin + 5, y);
      y += 5;
    }
    y += 5;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    setColor(PDF_COLORS.lightGray);
    doc.text(`PubGuard Security Report | ${report.target.name}`, margin, pageHeight - 13);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 13, { align: 'center' });
    doc.text(`ID: ${report.id.substring(0, 25)}`, pageWidth - margin, pageHeight - 13, { align: 'right' });

    // Branding line
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor({ r: 99, g: 102, b: 241 }); // Indigo color
    doc.text('Powered by Kira AI | Corporate AI Solutions', pageWidth / 2, pageHeight - 7, { align: 'center' });
  }

  return doc;
}

// PDF Button Component
function PDFButton({ report, userType }: { report: PubGuardReport; userType: UserType }) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const doc = generatePDF(report, userType);
      doc.save(`pubguard-${report.target.name.replace('/', '-')}.pdf`);
    } catch (e) {
      console.error('PDF failed:', e);
      alert('PDF generation failed');
    }
    setLoading(false);
  };

  const btnClass = report.trafficLight === 'red'
    ? 'bg-red-500 hover:bg-red-600'
    : report.trafficLight === 'amber'
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-green-500 hover:bg-green-600';

  return (
    <button onClick={download} disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg ${btnClass} disabled:opacity-50`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? 'Generating...' : 'Download PDF'}
    </button>
  );
}

// Main Component
interface Props {
  report: PubGuardReport;
  userType?: UserType;
  onNewScan?: () => void;
}

export default function PubGuardReport({ report, userType = 'writer', onNewScan }: Props) {
  const [tab, setTab] = useState('summary');

  const styles = {
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-500', icon: <CheckCircle className="w-12 h-12 text-green-500" /> },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500', icon: <AlertTriangle className="w-12 h-12 text-amber-500" /> },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500', icon: <XCircle className="w-12 h-12 text-red-500" /> },
  }[report.trafficLight];

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pubguard-${report.target.name.replace('/', '-')}.json`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className={`rounded-xl ${styles.bg} ${styles.border} border-2 p-6`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{USER_TYPE_CONFIG[userType].label} View</p>
            <h1 className="text-2xl font-bold text-gray-900">🛡️ {report.target.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Scanned {formatDate(report.generatedAt)}</p>
            <p className={`text-sm ${styles.text} mt-1 font-medium`}>{USER_TYPE_CONFIG[userType].primaryQuestion}</p>
          </div>
          <div className="text-center">
            {styles.icon}
            <div className={`mt-2 px-4 py-1 rounded-full ${styles.badge} text-white font-bold text-lg`}>
              {report.trafficLight.toUpperCase()}
            </div>
          </div>
        </div>

        <div className={`mt-4 p-4 rounded-lg ${styles.bg} border ${styles.border}`}>
          <div className={`text-lg font-semibold ${styles.text}`}>{report.recommendation.replace(/_/g, ' ')}</div>
          <div className="text-sm text-gray-600">Risk Score: <span className="font-bold">{report.overallRiskScore}/100</span></div>
        </div>

        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { n: report.findings.critical?.length || 0, l: 'Critical', c: 'text-red-600' },
            { n: report.findings.high?.length || 0, l: 'High', c: 'text-orange-500' },
            { n: report.findings.medium?.length || 0, l: 'Medium', c: 'text-yellow-500' },
            { n: report.findings.low?.length || 0, l: 'Low', c: 'text-blue-500' },
            { n: report.findings.positive?.length || 0, l: 'Positive', c: 'text-green-500' },
          ].map(x => (
            <div key={x.l} className="text-center p-2 bg-white rounded-lg shadow-sm">
              <div className={`text-xl font-bold ${x.c}`}>{x.n}</div>
              <div className="text-xs text-gray-500">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {['summary', 'findings', 'technical', 'sources'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? `${styles.badge} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {tab === 'summary' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Risk Score Breakdown</h2>
            {report.riskCategories.map((cat, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{cat.name}</h3>
                    <p className="text-sm text-gray-500">{cat.description}</p>
                  </div>
                  <div className={`text-2xl font-bold ${cat.score >= 70 ? 'text-red-600' : cat.score >= 40 ? 'text-amber-500' : 'text-green-600'}`}>
                    {cat.score}/100
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className={`h-2 rounded-full ${cat.score >= 70 ? 'bg-red-500' : cat.score >= 40 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${cat.score}%` }} />
                </div>
                {cat.factors?.length > 0 && (
                  <ul className="mt-2 text-sm text-gray-600">
                    {cat.factors.map((f, j) => <li key={j}>• {f}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'findings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Detailed Findings</h2>
            {report.findings.critical?.map((f, i) => (
              <div key={i} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">CRITICAL</span>
                <h4 className="font-semibold mt-2">{f.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{f.description}</p>
                {f.sourceUrl && <a href={f.sourceUrl} target="_blank" className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center gap-1">View Source <ExternalLink className="w-3 h-3" /></a>}
              </div>
            ))}
            {report.findings.high?.map((f, i) => (
              <div key={i} className="border-l-4 border-orange-400 bg-orange-50 p-4 rounded-r-lg">
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded">HIGH</span>
                <h4 className="font-semibold mt-2">{f.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{f.description}</p>
              </div>
            ))}
            {report.findings.positive?.map((f, i) => (
              <div key={i} className="border-l-4 border-green-400 bg-green-50 p-4 rounded-r-lg">
                <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded">POSITIVE</span>
                <h4 className="font-medium mt-2">{f.title}</h4>
              </div>
            ))}
          </div>
        )}

        {tab === 'technical' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Technical Details</h2>
            {report.cve?.vulnerabilities?.map((cve, i) => (
              <div key={i} className={`border rounded-lg p-4 ${cve.severity === 'CRITICAL' ? 'border-red-300 bg-red-50' : cve.severity === 'HIGH' ? 'border-orange-300 bg-orange-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold text-white ${cve.severity === 'CRITICAL' ? 'bg-red-600' : cve.severity === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'}`}>{cve.severity}</span>
                  <a href={`https://nvd.nist.gov/vuln/detail/${cve.id}`} target="_blank" className="font-mono font-bold text-blue-600 hover:underline">{cve.id}</a>
                  {cve.cvssScore && <span className="font-semibold">CVSS: {cve.cvssScore}</span>}
                </div>
                <p className="text-sm text-gray-700 mt-2">{cve.description}</p>
                <p className="text-xs text-gray-500 mt-1">Published: {new Date(cve.publishedDate).toLocaleDateString()}</p>
              </div>
            ))}
            {report.github && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-50 p-3 rounded-lg text-center"><Star className="w-5 h-5 mx-auto text-yellow-500" /><div className="text-xl font-bold">{report.github.stars?.toLocaleString()}</div><div className="text-xs text-gray-500">Stars</div></div>
                <div className="bg-gray-50 p-3 rounded-lg text-center"><GitBranch className="w-5 h-5 mx-auto text-gray-500" /><div className="text-xl font-bold">{report.github.forks?.toLocaleString()}</div><div className="text-xs text-gray-500">Forks</div></div>
                <div className="bg-gray-50 p-3 rounded-lg text-center"><Users className="w-5 h-5 mx-auto text-blue-500" /><div className="text-xl font-bold">{report.github.contributors}</div><div className="text-xs text-gray-500">Contributors</div></div>
                <div className="bg-gray-50 p-3 rounded-lg text-center"><Clock className="w-5 h-5 mx-auto text-green-500" /><div className="text-xl font-bold">{report.github.daysSinceLastCommit}</div><div className="text-xs text-gray-500">Days Since Commit</div></div>
              </div>
            )}
          </div>
        )}

        {tab === 'sources' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Data Sources</h2>
            {report.sourcesChecked.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {s.status === 'success' ? <CheckCircle className="w-5 h-5 text-green-500" /> : s.status === 'partial' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                  <div><div className="font-medium">{s.name}</div><div className="text-xs text-gray-500">{s.searched.slice(0, 3).join(', ')}</div></div>
                </div>
                <div className="text-right"><div className="font-semibold">{s.found} found</div><div className="text-xs text-gray-500">{s.status}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 bg-white rounded-xl shadow-sm border p-4">
        {onNewScan && <button onClick={onNewScan} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"><ArrowLeft className="w-4 h-4" />New Scan</button>}
        <PDFButton report={report} userType={userType} />
        <button onClick={downloadJSON} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"><Download className="w-4 h-4" />Download JSON</button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"><Printer className="w-4 h-4" />Print</button>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-4">
        <p>{report.disclaimer}</p>
        <p className="mt-2">Report ID: {report.id} | Hash: {report.reportHash}</p>
      </div>
    </div>
  );
}