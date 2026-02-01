// components/PubGuardReportDownload.tsx
// Download buttons for PubGuard reports - PDF and JSON

'use client';

import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';

interface Props {
  report: any;
  userType: 'writer' | 'developer' | 'user' | 'analyst';
}

export default function PubGuardReportDownload({ report, userType }: Props) {
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const downloadPDF = async () => {
    setGeneratingPDF(true);
    setError(null);

    try {
      const response = await fetch('/api/pubguard/v2/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, userType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get the PDF blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `pubguard-report-${report.target?.name?.replace('/', '-') || 'unknown'}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('PDF generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* PDF Download Button */}
      <button
        onClick={downloadPDF}
        disabled={generatingPDF}
        className={`
          flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium
          transition-all duration-200
          ${generatingPDF 
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl'
          }
        `}
      >
        {generatingPDF ? (
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

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Info Text */}
      <p className="text-xs text-slate-500 text-center">
        PDF includes executive summary tailored for {userType}s
      </p>
    </div>
  );
}

// Simpler inline version for embedding in other components
export function PDFDownloadButton({ report, userType, className = '' }: Props & { className?: string }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/pubguard/v2/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, userType }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pubguard-report-${report.target?.name?.replace('/', '-')}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className={`flex items-center gap-2 ${className}`}
    >
      {generating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
      {generating ? 'Generating...' : 'PDF Report'}
    </button>
  );
}