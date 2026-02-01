// app/pubguard/page.tsx
// PubGuard Landing Page - BRANDED with Corporate AI Solutions / Kira AI

'use client';

import Link from 'next/link';
import { Shield, CheckCircle, AlertTriangle, XCircle, Sparkles, Calendar, ArrowRight, ExternalLink } from 'lucide-react';
import { PoweredByKira, KiraFooter, KiraCTABanner, CORPORATE_AI_SOLUTIONS } from '@/components/KiraBranding';

export default function PubGuardLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-slate-200 flex flex-col">
      <div className="flex-1">
        {/* Header */}
        <header className="border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">
                  <span>Pub</span><span className="text-red-500">Guard</span>
                </h1>
              </div>
            </div>
            <PoweredByKira />
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <span className="inline-block bg-green-500/15 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-green-500/30">
            🛡️ Free Security Scanner
          </span>

          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="text-white">Pub</span>
            <span className="text-red-500">Guard</span>
          </h1>

          <p className="text-2xl text-slate-300 mb-4">
            Software Security Scanner powered by <span className="text-red-400 font-semibold">Kira AI</span>
          </p>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto">
            Know the risks before you publish, ship, or install.
            Get instant security assessments with actionable insights.
          </p>

          <Link
            href="/pubguard/scan"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl hover:from-red-600 hover:to-red-700 hover:shadow-xl hover:shadow-red-500/20 transition-all"
          >
            Start Scanning Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>

        {/* Who It's For */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Who Uses PubGuard?</h2>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
              <div className="flex items-start gap-4">
                <span className="text-3xl">✏️</span>
                <div>
                  <h3 className="font-semibold text-white text-xl mb-2">Tech Writers & Bloggers</h3>
                  <p className="text-slate-300">
                    Vet tools before recommending them. Protect your reputation and reduce liability risk.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start gap-4">
                <span className="text-3xl">💻</span>
                <div>
                  <h3 className="font-semibold text-white text-xl mb-2">Software Developers</h3>
                  <p className="text-slate-300">
                    Audit your own projects before release. Get actionable security feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-colors">
              <div className="flex items-start gap-4">
                <span className="text-3xl">👤</span>
                <div>
                  <h3 className="font-semibold text-white text-xl mb-2">Prospective Users</h3>
                  <p className="text-slate-300">
                    Check if software is safe before you install it. Understand the risks.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-amber-500/50 transition-colors">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🔍</span>
                <div>
                  <h3 className="font-semibold text-white text-xl mb-2">Security Analysts</h3>
                  <p className="text-slate-300">
                    Rapid security assessments with technical depth. CVE lookups and exposure scans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Traffic Light System */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Traffic Light Rating System</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <div className="text-5xl mb-4">🟢</div>
              <h3 className="font-bold text-emerald-400 text-xl mb-2">GREEN</h3>
              <p className="text-slate-300 text-sm">Safe to recommend, ship, or install</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center">
              <div className="text-5xl mb-4">🟠</div>
              <h3 className="font-bold text-amber-400 text-xl mb-2">AMBER</h3>
              <p className="text-slate-300 text-sm">Proceed with caution, disclose risks</p>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <div className="text-5xl mb-4">🔴</div>
              <h3 className="font-bold text-red-400 text-xl mb-2">RED</h3>
              <p className="text-slate-300 text-sm">Do not recommend or use</p>
            </div>
          </div>
        </section>

        {/* What We Check */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">14 Automated Security Tests</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: '📊', name: 'GitHub Repository Analysis' },
              { icon: '🛡️', name: 'CVE Database Lookup' },
              { icon: '📰', name: 'Security News Scan' },
              { icon: '👥', name: 'Expert Warning Check' },
              { icon: '🔐', name: 'Credential Storage Audit' },
              { icon: '🔒', name: 'Permission Scope Analysis' },
              { icon: '💉', name: 'Prompt Injection Risk' },
              { icon: '📦', name: 'Supply Chain Security' },
              { icon: '⚙️', name: 'Default Config Security' },
              { icon: '🌐', name: 'Internet Exposure Scan' },
              { icon: '👤', name: 'Identity Stability Check' },
              { icon: '🔧', name: 'Maintainer Responsiveness' },
              { icon: '🔬', name: 'Risk Score Calculation' },
              { icon: '📋', name: 'Report Generation' },
            ].map((test) => (
              <div key={test.name} className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3">
                <span className="text-xl">{test.icon}</span>
                <span className="text-slate-300">{test.name}</span>
                <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          <KiraCTABanner />
        </section>

        {/* Final CTA */}
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to scan?</h2>
          <p className="text-slate-400 mb-8">It's free, instant, and powered by Kira AI.</p>

          <Link
            href="/pubguard/scan"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-lg font-semibold rounded-xl hover:from-red-600 hover:to-red-700 hover:shadow-xl hover:shadow-red-500/20 transition-all"
          >
            Start Your Free Scan
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>
      </div>

      {/* Footer */}
      <KiraFooter />
    </div>
  );
}