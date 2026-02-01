// components/KiraBranding.tsx
// Branding and attribution components for Corporate AI Solutions / Kira AI
// Use on ALL client-facing pages

'use client';

import { Calendar, ExternalLink, Sparkles } from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CORPORATE_AI_SOLUTIONS = {
  name: 'Corporate AI Solutions',
  website: 'https://corporateaisolutions.com',
  booking: 'https://calendly.com/mcmdennis',
  email: 'dennis@corporateaisolutions.com',
};

export const KIRA_AI = {
  name: 'Kira AI',
  tagline: 'Your Friendly Guide Through Anything',
  description: 'Voice-powered AI agents for business',
};

// ============================================================================
// POWERED BY BADGE (Small, for headers)
// ============================================================================

export function PoweredByKira({ className = '' }: { className?: string }) {
  return (
    <a
      href={CORPORATE_AI_SOLUTIONS.website}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 hover:border-red-500/40 transition-all group ${className}`}
    >
      <Sparkles className="w-4 h-4 text-red-400" />
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
        Powered by <span className="font-semibold text-red-400">Kira AI</span>
      </span>
    </a>
  );
}

// ============================================================================
// FULL FOOTER (For bottom of pages)
// ============================================================================

export function KiraFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-white/10 bg-slate-950/80 backdrop-blur-sm ${className}`}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Branding */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">Kira AI</p>
              <p className="text-sm text-slate-400">by Corporate AI Solutions</p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <p className="text-slate-400 text-sm text-center sm:text-left">
              Want Kira for your business?
            </p>
            <a
              href={CORPORATE_AI_SOLUTIONS.booking}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-red-500/20"
            >
              <Calendar className="w-4 h-4" />
              Book a Demo
            </a>
          </div>
        </div>

        {/* Bottom Links */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-slate-500">
            © {new Date().getFullYear()} Corporate AI Solutions. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href={CORPORATE_AI_SOLUTIONS.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              Our Services <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`mailto:${CORPORATE_AI_SOLUTIONS.email}`}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// CTA BANNER (For inline promotion)
// ============================================================================

export function KiraCTABanner({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/20 rounded-2xl p-6 ${className}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">Like what Kira can do?</h3>
            <p className="text-slate-400 text-sm">
              Get a custom AI voice agent for your business
            </p>
          </div>
        </div>
        <a
          href={CORPORATE_AI_SOLUTIONS.booking}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-red-500/20 whitespace-nowrap"
        >
          <Calendar className="w-5 h-5" />
          Book a Free Consultation
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// MINI ATTRIBUTION (For tight spaces)
// ============================================================================

export function KiraMiniAttribution({ className = '' }: { className?: string }) {
  return (
    <a
      href={CORPORATE_AI_SOLUTIONS.website}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-slate-500 hover:text-slate-300 transition-colors ${className}`}
    >
      Built with ❤️ by <span className="text-red-400">Corporate AI Solutions</span>
    </a>
  );
}