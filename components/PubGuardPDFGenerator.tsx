// components/PubGuardPDFGenerator.tsx
// Client-side PDF generation using jsPDF - no server needed

'use client';

import { useState } from 'react';
import { FileText, Loader2, Download } from 'lucide-react';
import jsPDF from 'jspdf';

interface Props {
  report: any;
  userType: 'writer' | 'developer' | 'user' | 'analyst';
}

// Colors
const COLORS = {
  green: [16, 185, 129],    // #10B981
  amber: [245, 158, 11],    // #F59E0B
  red: [239, 68, 68],       // #EF4444
  primary: [99, 102, 241],  // #6366F1
  dark: [30, 41, 59],       // #1E293B
  gray: [100, 116, 139],    // #64748B
  lightGray: [241, 245, 249], // #F1F5F9
};

function getTrafficLightColor(light: string): number[] {
  return COLORS[light as keyof typeof COLORS] || COLORS.gray;
}

export default function PubGuardPDFGenerator({ report, userType }: Props) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let y = margin;

      // Helper functions
      const addText = (text: string, x: number, yPos: number, options: any = {}) => {
        const { fontSize = 10, fontStyle = 'normal', color = COLORS.dark, maxWidth } = options;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(color[0], color[1], color[2]);

        if (maxWidth) {
          const lines = doc.splitTextToSize(text, maxWidth);
          doc.text(lines, x, yPos);
          return lines.length * (fontSize * 0.4);
        }
        doc.text(text, x, yPos);
        return fontSize * 0.4;
      };

      const addLine = (yPos: number, color = COLORS.primary) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
      };

      const checkPageBreak = (neededSpace: number) => {
        if (y + neededSpace > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // ========================================
      // HEADER
      // ========================================

      // Title
      addText('PubGuard Security Report', pageWidth / 2, y, {
        fontSize: 24,
        fontStyle: 'bold',
        color: COLORS.dark,
      });
      doc.text('PubGuard Security Report', pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Powered by
      addText('Powered by Kira AI', pageWidth / 2, y, {
        fontSize: 10,
        color: COLORS.gray,
      });
      doc.text('Powered by Kira AI', pageWidth / 2, y, { align: 'center' });
      y += 10;

      addLine(y);
      y += 10;

      // Repository info
      const targetName = report.target?.name || 'Unknown';
      addText(`Repository: ${targetName}`, margin, y, { fontSize: 12, fontStyle: 'bold' });
      y += 7;

      const generatedAt = report.generatedAt || new Date().toISOString();
      const formattedDate = new Date(generatedAt).toLocaleString();
      addText(`Scan Date: ${formattedDate}`, margin, y, { fontSize: 10 });
      y += 5;

      addText(`Report ID: ${report.id || 'N/A'}`, margin, y, { fontSize: 8, color: COLORS.gray });
      y += 15;

      // ========================================
      // TRAFFIC LIGHT RATING
      // ========================================

      const trafficLight = report.trafficLight || 'amber';
      const riskScore = report.overallRiskScore || 50;
      const tlColor = getTrafficLightColor(trafficLight);

      // Rating box
      doc.setFillColor(tlColor[0], tlColor[1], tlColor[2]);
      doc.roundedRect(margin, y, pageWidth - (margin * 2), 30, 3, 3, 'F');

      // Rating text
      const ratingEmoji = trafficLight === 'green' ? 'LOW RISK' : trafficLight === 'amber' ? 'MODERATE RISK' : 'HIGH RISK';
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(trafficLight.toUpperCase(), pageWidth / 2, y + 12, { align: 'center' });
      doc.setFontSize(12);
      doc.text(ratingEmoji, pageWidth / 2, y + 22, { align: 'center' });
      y += 40;

      // Risk score
      addText(`Risk Score: ${riskScore}/100`, margin, y, { fontSize: 11 });

      const recommendation = report.recommendation || 'PROCEED_WITH_CAUTION';
      const recText = recommendation.replace(/_/g, ' ');
      addText(`Recommendation: ${recText}`, pageWidth / 2, y, { fontSize: 11 });
      y += 15;

      // ========================================
      // EXECUTIVE SUMMARY
      // ========================================

      addText('EXECUTIVE SUMMARY', margin, y, { fontSize: 14, fontStyle: 'bold', color: COLORS.primary });
      y += 8;

      // Count findings
      const findings = report.findings || {};
      const criticalCount = (findings.critical || []).length;
      const highCount = (findings.high || []).length;
      const positiveCount = (findings.positive || []).length;

      let summary = '';
      if (trafficLight === 'green') {
        summary = `${targetName} has been assessed as LOW RISK with a risk score of ${riskScore}/100. Our automated security analysis found no critical vulnerabilities or significant security concerns. The project demonstrates good security practices and active maintenance.`;
      } else if (trafficLight === 'amber') {
        summary = `${targetName} has been assessed as MODERATE RISK with a risk score of ${riskScore}/100. Our analysis identified some security considerations that warrant attention. We found ${criticalCount} critical and ${highCount} high severity issues that should be evaluated before adoption.`;
      } else {
        summary = `${targetName} has been assessed as HIGH RISK with a risk score of ${riskScore}/100. Our analysis identified significant security concerns including ${criticalCount} critical and ${highCount} high severity issues. We recommend thorough security review before any adoption or recommendation.`;
      }

      const summaryHeight = addText(summary, margin, y, { maxWidth: pageWidth - (margin * 2) });
      y += summaryHeight + 10;

      // User-type specific guidance
      addText(`For ${userType.charAt(0).toUpperCase() + userType.slice(1)}s:`, margin, y, { fontSize: 11, fontStyle: 'bold' });
      y += 6;

      const guidance = report.writerGuidance || {};
      if (userType === 'writer') {
        if (guidance.canRecommend) {
          addText('✓ This tool can be recommended to readers with standard security disclaimers.', margin, y, { fontSize: 10 });
        } else {
          addText('⚠ Exercise caution when recommending. Include prominent security warnings.', margin, y, { fontSize: 10, color: COLORS.amber });
        }
        y += 6;

        const disclosures = guidance.mustDisclose || [];
        if (disclosures.length > 0) {
          addText('Required Disclosures:', margin, y, { fontSize: 10, fontStyle: 'bold' });
          y += 5;
          disclosures.slice(0, 3).forEach((d: string) => {
            addText(`• ${d}`, margin + 5, y, { fontSize: 9, maxWidth: pageWidth - (margin * 2) - 10 });
            y += 5;
          });
        }
      } else if (userType === 'developer') {
        if (criticalCount > 0 || highCount > 0) {
          addText(`⚠ Address ${criticalCount + highCount} critical/high issues before shipping to production.`, margin, y, { fontSize: 10, color: COLORS.amber });
        } else {
          addText('✓ No critical issues blocking production deployment.', margin, y, { fontSize: 10, color: COLORS.green });
        }
      } else if (userType === 'user') {
        if (trafficLight === 'green') {
          addText('✓ This tool appears safe to install and use with normal precautions.', margin, y, { fontSize: 10, color: COLORS.green });
        } else if (trafficLight === 'amber') {
          addText('⚠ Review the security findings before installing. Use with caution.', margin, y, { fontSize: 10, color: COLORS.amber });
        } else {
          addText('⛔ We recommend NOT installing this tool until security issues are resolved.', margin, y, { fontSize: 10, color: COLORS.red });
        }
      }
      y += 15;

      // ========================================
      // RISK BREAKDOWN
      // ========================================

      checkPageBreak(60);

      addText('RISK SCORE BREAKDOWN', margin, y, { fontSize: 14, fontStyle: 'bold', color: COLORS.primary });
      y += 10;

      const riskCategories = report.riskCategories || [];

      if (riskCategories.length > 0) {
        // Table header
        doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Category', margin + 3, y + 5.5);
        doc.text('Score', margin + 80, y + 5.5);
        doc.text('Weight', margin + 110, y + 5.5);
        doc.text('Weighted', margin + 140, y + 5.5);
        y += 8;

        // Table rows
        riskCategories.forEach((cat: any, index: number) => {
          const bgColor = index % 2 === 0 ? COLORS.lightGray : [255, 255, 255];
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');

          doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(cat.name || 'Unknown', margin + 3, y + 5);
          doc.text(`${cat.score || 0}/100`, margin + 80, y + 5);
          doc.text(`${cat.weight || 0}%`, margin + 110, y + 5);
          doc.text(`${(cat.weightedScore || 0).toFixed(1)}`, margin + 140, y + 5);
          y += 7;
        });

        // Total row
        doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Overall Risk Score', margin + 3, y + 5.5);
        doc.text(`${riskScore}/100`, margin + 140, y + 5.5);
        y += 15;
      }

      // ========================================
      // SECURITY FINDINGS
      // ========================================

      checkPageBreak(40);

      addText('SECURITY FINDINGS', margin, y, { fontSize: 14, fontStyle: 'bold', color: COLORS.primary });
      y += 10;

      const severityOrder = [
        { key: 'critical', label: 'Critical', color: COLORS.red },
        { key: 'high', label: 'High', color: COLORS.amber },
        { key: 'medium', label: 'Medium', color: [234, 179, 8] },
        { key: 'low', label: 'Low', color: [59, 130, 246] },
        { key: 'positive', label: 'Positive', color: COLORS.green },
      ];

      let totalFindings = 0;

      for (const sev of severityOrder) {
        const sevFindings = findings[sev.key] || [];
        if (sevFindings.length === 0) continue;

        totalFindings += sevFindings.length;

        checkPageBreak(20);

        // Severity header
        doc.setFillColor(sev.color[0], sev.color[1], sev.color[2]);
        doc.rect(margin, y, 4, 6, 'F');
        addText(`${sev.label} (${sevFindings.length})`, margin + 7, y + 4.5, { fontSize: 11, fontStyle: 'bold' });
        y += 10;

        // Findings
        sevFindings.slice(0, 5).forEach((finding: any) => {
          checkPageBreak(15);

          addText(`• ${finding.title || 'Unknown'}`, margin + 5, y, { fontSize: 9, fontStyle: 'bold' });
          y += 4;

          if (finding.description) {
            const desc = finding.description.length > 150 ? finding.description.substring(0, 150) + '...' : finding.description;
            const descHeight = addText(desc, margin + 8, y, { fontSize: 8, color: COLORS.gray, maxWidth: pageWidth - (margin * 2) - 15 });
            y += descHeight + 2;
          }

          addText(`Source: ${finding.source || 'Unknown'}`, margin + 8, y, { fontSize: 7, color: COLORS.gray });
          y += 6;
        });

        y += 5;
      }

      if (totalFindings === 0) {
        addText('No significant security findings were identified during this scan.', margin, y, { fontSize: 10 });
        y += 10;
      }

      // ========================================
      // SOURCES CHECKED
      // ========================================

      checkPageBreak(50);

      addText('SOURCES CHECKED', margin, y, { fontSize: 14, fontStyle: 'bold', color: COLORS.primary });
      y += 10;

      const sources = report.sourcesChecked || [];

      if (sources.length > 0) {
        // Table header
        doc.setFillColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Source', margin + 3, y + 5.5);
        doc.text('Status', margin + 90, y + 5.5);
        doc.text('Found', margin + 130, y + 5.5);
        y += 8;

        sources.forEach((source: any, index: number) => {
          const bgColor = index % 2 === 0 ? COLORS.lightGray : [255, 255, 255];
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');

          doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);

          const statusIcon = source.status === 'success' ? '✓' : source.status === 'partial' ? '⚠' : '✗';
          doc.text(source.name || 'Unknown', margin + 3, y + 5);
          doc.text(`${statusIcon} ${(source.status || 'unknown').charAt(0).toUpperCase() + (source.status || 'unknown').slice(1)}`, margin + 90, y + 5);
          doc.text(String(source.found || 0), margin + 130, y + 5);
          y += 7;
        });
        y += 10;
      }

      // ========================================
      // FOOTER / DISCLAIMER
      // ========================================

      checkPageBreak(40);

      addLine(y, COLORS.gray);
      y += 8;

      addText('DISCLAIMER', margin, y, { fontSize: 10, fontStyle: 'bold', color: COLORS.gray });
      y += 6;

      const disclaimer = report.disclaimer || 'This report is for informational purposes only and does not constitute legal advice. Security conditions may change. Always verify current status before making recommendations.';
      const disclaimerHeight = addText(disclaimer, margin, y, { fontSize: 7, color: COLORS.gray, maxWidth: pageWidth - (margin * 2) });
      y += disclaimerHeight + 5;

      addText(`Report Hash: ${report.reportHash || 'N/A'}`, margin, y, { fontSize: 7, color: COLORS.gray });
      y += 8;

      // Branding
      addText('Generated by PubGuard powered by Kira AI | Corporate AI Solutions', pageWidth / 2, y, { fontSize: 8, color: COLORS.gray });
      doc.text('Generated by PubGuard powered by Kira AI | Corporate AI Solutions', pageWidth / 2, y, { align: 'center' });

      // ========================================
      // SAVE PDF
      // ========================================

      const filename = `pubguard-report-${targetName.replace('/', '-')}-${Date.now()}.pdf`;
      doc.save(filename);

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pubguard-report-${report.target?.name?.replace('/', '-') || 'unknown'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* PDF Download Button */}
      <button
        onClick={generatePDF}
        disabled={generating}
        className={`
          flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium
          transition-all duration-200
          ${generating 
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl'
          }
        `}
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            Download PDF Report
          </>
        )}
      </button>

      {/* JSON Download Button */}
      <button
        onClick={downloadJSON}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium
          bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
      >
        <Download className="w-4 h-4" />
        Download JSON Data
      </button>

      {/* Info Text */}
      <p className="text-xs text-slate-500 text-center">
        PDF includes executive summary tailored for {userType}s
      </p>
    </div>
  );
}