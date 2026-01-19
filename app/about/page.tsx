"use client";

import React from 'react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .gradient-hero { background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%); }
        .gradient-coral { background: linear-gradient(135deg, #fb7185 0%, #f472b6 100%); }
        .gradient-sunny { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        .hover-pop { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .hover-pop:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .avatar-ring { background: linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%); padding: 3px; border-radius: 50%; }
        .glow-amber { box-shadow: 0 0 60px rgba(251, 191, 36, 0.3); }
      `}</style>

      <nav className="fixed top-0 left-0 right-0 z-50 bg-stone-50/80 backdrop-blur-lg border-b border-stone-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="avatar-ring"><div className="w-10 h-10 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
            <span className="font-display font-bold text-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Kira</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="/" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium">Home</a>
            <a href="/start" className="font-display gradient-sunny text-stone-800 px-5 py-2.5 rounded-full text-sm font-bold hover-pop shadow-md">Try Kira Free</a>
          </div>
        </div>
      </nav>

      <section className="gradient-hero pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="font-body text-amber-400 text-sm uppercase tracking-wider mb-4">The Story Behind Kira</p>
          <h1 className="font-display text-4xl lg:text-6xl font-bold text-white mb-6">Built by one developer.<br /><span className="text-amber-400">Powered by a vision.</span></h1>
          <p className="font-body text-xl text-stone-300 max-w-2xl mx-auto leading-relaxed">Kira is part of Corporate AI Solutions — a suite of AI Voice Agent platforms created to make powerful AI accessible to everyone.</p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div><div className="w-48 h-48 mx-auto md:mx-0 rounded-2xl bg-gradient-to-br from-amber-100 to-pink-100 flex items-center justify-center glow-amber"><span className="text-7xl">👨‍💻</span></div></div>
            <div>
              <p className="font-body text-amber-600 text-sm uppercase tracking-wider mb-2">Meet the Creator</p>
              <h2 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 mb-4">Dennis McMahon</h2>
              <p className="font-body text-stone-600 leading-relaxed mb-4">Solo AI developer. Builder of voice agents. Believer that the best AI feels less like software and more like a conversation with someone who actually gets it.</p>
              <p className="font-body text-stone-600 leading-relaxed mb-6">Every platform in the Corporate AI Solutions suite — including Kira — is designed, built, and maintained by one person with a singular focus: making AI that actually helps.</p>
              <p className="font-body text-stone-500 text-sm italic mb-6">"I don't want to build AI that replaces human connection. I want to build AI that makes human potential easier to reach."</p>
              
              {/* Contact Links */}
              <div className="flex flex-wrap gap-3">
                <a href="https://www.linkedin.com/in/denniskl/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#0077B5] text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-[#006396] transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </a>
                <a href="https://calendly.com/mcmdennis" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-amber-500 text-stone-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-amber-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Book a Meeting
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-stone-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl font-bold text-stone-800 mb-2">Get in Touch</h2>
            <p className="font-body text-stone-600">Have questions? Want to collaborate? Reach out directly.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <a href="mailto:dennis@corporateaisolutions.com" className="bg-white rounded-2xl p-6 text-center hover-pop shadow-sm group">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="font-display font-bold text-stone-800 mb-1">Email</h3>
              <p className="font-body text-stone-600 text-sm">dennis@corporateaisolutions.com</p>
            </a>
            <a href="https://wa.me/61402612471" target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl p-6 text-center hover-pop shadow-sm group">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <h3 className="font-display font-bold text-stone-800 mb-1">WhatsApp</h3>
              <p className="font-body text-stone-600 text-sm">+61 402 612 471</p>
            </a>
            <a href="https://calendly.com/mcmdennis" target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl p-6 text-center hover-pop shadow-sm group">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="font-display font-bold text-stone-800 mb-1">Book a Meeting</h3>
              <p className="font-body text-stone-600 text-sm">calendly.com/mcmdennis</p>
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-body text-amber-600 text-sm uppercase tracking-wider mb-2">The Platform</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 mb-4">Corporate AI Solutions</h2>
            <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto">A marketplace of specialized AI Voice Agents, each built to excel at one thing.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-stone-50 rounded-2xl p-6 hover-pop shadow-sm"><div className="text-3xl mb-4">🎯</div><h3 className="font-display font-bold text-stone-800 mb-2">Specialized Agents</h3><p className="font-body text-stone-600 text-sm">Each agent is purpose-built — not a jack-of-all-trades, but a master of one.</p></div>
            <div className="bg-stone-50 rounded-2xl p-6 hover-pop shadow-sm"><div className="text-3xl mb-4">🗣️</div><h3 className="font-display font-bold text-stone-800 mb-2">Voice-First</h3><p className="font-body text-stone-600 text-sm">Designed for natural conversation. Talk, don't type. It's faster and more human.</p></div>
            <div className="bg-stone-50 rounded-2xl p-6 hover-pop shadow-sm"><div className="text-3xl mb-4">🔧</div><h3 className="font-display font-bold text-stone-800 mb-2">Always Improving</h3><p className="font-body text-stone-600 text-sm">Every agent learns, adapts, and gets better with every conversation.</p></div>
          </div>
          <div className="text-center"><a href="https://corporate-ai-solutions.vercel.app/marketplace" target="_blank" rel="noopener noreferrer" className="font-display gradient-coral text-white px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-xl shadow-pink-200 inline-block">Explore the Marketplace →</a></div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-stone-900 to-stone-800">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-body text-amber-400 text-sm uppercase tracking-wider mb-2">The Vision</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-white mb-4">Longtail AI Ventures</h2>
            <p className="font-body text-xl text-stone-300 max-w-2xl mx-auto leading-relaxed">The thesis behind everything we build.</p>
          </div>
          <div className="bg-stone-800/50 rounded-3xl p-8 lg:p-12 border border-stone-700">
            <div className="space-y-6 font-body text-stone-300 leading-relaxed">
              <p>The future of AI isn't one giant model that does everything. It's thousands of specialized agents, each brilliant at one specific thing.</p>
              <p><span className="text-amber-400 font-semibold">Longtail AI Ventures</span> is built on this thesis: that the long tail of AI — the niche use cases, the specific needs, the problems that big tech ignores — is where the real value lies.</p>
              <p>Kira exists because not everyone needs a general-purpose AI. Some people just need a thinking partner. Someone to talk through decisions with. Someone who asks better questions than they're asking themselves.</p>
              <p className="text-white font-semibold">That's the bet. That's the vision. And we're just getting started.</p>
            </div>
            <div className="mt-8 pt-8 border-t border-stone-700 text-center"><a href="https://corporate-ai-solutions.vercel.app/studio/thesis" target="_blank" rel="noopener noreferrer" className="font-display text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-2 transition-colors">Read the Full Thesis →</a></div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-amber-50 to-pink-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="avatar-ring inline-block mb-6"><div className="w-24 h-24 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 mb-4">Where Kira Fits</h2>
          <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed mb-8">Kira is the personal guide in the Corporate AI Solutions family. She's not trying to be everything — she's trying to be the best thinking partner you've ever had.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/start" className="font-display gradient-sunny text-stone-800 px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-lg inline-block">Start Talking to Kira →</a>
            <a href="/" className="font-display text-stone-600 hover:text-pink-500 px-6 py-3 font-medium transition-colors">Back to Home</a>
          </div>
        </div>
      </section>

      <footer className="bg-stone-800 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="avatar-ring"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
              <span className="font-display font-bold text-white">Kira</span>
              <span className="text-stone-500">|</span>
              <a href="https://corporate-ai-solutions.vercel.app/marketplace" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-stone-400 hover:text-amber-400 transition-colors">A Corporate AI Solutions Product</a>
            </div>
            <div className="flex items-center gap-6 font-body text-sm text-stone-400">
              <a href="/" className="hover:text-pink-400 transition-colors">Home</a>
              <a href="/#how-it-works" className="hover:text-pink-400 transition-colors">How it Works</a>
              <a href="/#pricing" className="hover:text-pink-400 transition-colors">Pricing</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-stone-700 text-center">
            <p className="font-body text-stone-500 text-sm">© 2025 Corporate AI Solutions · Created by Dennis McMahon · <a href="https://corporate-ai-solutions.vercel.app/studio/thesis" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 ml-1">Longtail AI Ventures</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}