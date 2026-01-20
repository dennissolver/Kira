"use client";

import React, { useState, useEffect } from 'react';

export default function KiraLandingPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-amber-50 text-stone-800 font-sans overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        .gradient-hero {
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(251, 191, 36, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(244, 114, 182, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(167, 139, 250, 0.15) 0%, transparent 60%),
            linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fce7f3 100%);
        }
        
        .gradient-coral { background: linear-gradient(135deg, #fb7185 0%, #f472b6 100%); }
        .gradient-sunny { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        .gradient-lavender { background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%); }
        .gradient-mint { background: linear-gradient(135deg, #34d399 0%, #10b981 100%); }
        
        .blob-1 {
          position: absolute; width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%);
          border-radius: 50%; filter: blur(60px); animation: float1 20s ease-in-out infinite;
        }
        .blob-2 {
          position: absolute; width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(244, 114, 182, 0.35) 0%, transparent 70%);
          border-radius: 50%; filter: blur(60px); animation: float2 25s ease-in-out infinite;
        }
        .blob-3 {
          position: absolute; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(167, 139, 250, 0.3) 0%, transparent 70%);
          border-radius: 50%; filter: blur(50px); animation: float3 18s ease-in-out infinite;
        }
        
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.1); }
          66% { transform: translate(30px, -30px) scale(0.9); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 40px) scale(1.15); }
        }
        
        .fade-up { opacity: 0; transform: translateY(30px); animation: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .fade-up-delay-1 { animation-delay: 0.15s; }
        .fade-up-delay-2 { animation-delay: 0.3s; }
        .fade-up-delay-3 { animation-delay: 0.45s; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        
        .hover-pop { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease; }
        .hover-pop:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); }
        
        .wiggle:hover { animation: wiggle 0.5s ease-in-out; }
        @keyframes wiggle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        
        .avatar-ring { background: linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%); padding: 3px; border-radius: 50%; }
        .chat-bubble-kira { background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%); border: 2px solid rgba(251, 191, 36, 0.3); }
        .chat-bubble-user { background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); }
        .fun-border { border: 3px solid transparent; background: linear-gradient(white, white) padding-box, linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%) border-box; }
        .cas-badge { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); transition: all 0.3s ease; }
        .cas-badge:hover { background: linear-gradient(135deg, #334155 0%, #475569 100%); }
        
        .journey-card { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .journey-card:hover { transform: translateY(-8px) scale(1.02); }
        
        .step-connector { position: relative; }
        .step-connector::after {
          content: ''; position: absolute; top: 50%; right: -2rem; width: 4rem; height: 3px;
          background: linear-gradient(90deg, #fbbf24, #f472b6); border-radius: 2px;
        }
        @media (max-width: 768px) { .step-connector::after { display: none; } }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-amber-50/80 backdrop-blur-lg border-b border-amber-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3 wiggle cursor-pointer">
              <div className="avatar-ring">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
                  <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
                </div>
              </div>
              <span className="font-display font-bold text-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Kira</span>
            </a>
            <a href="https://corporate-ai-solutions.vercel.app/marketplace" target="_blank" rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 cas-badge text-white px-3 py-1.5 rounded-full text-xs font-body">
              <span className="opacity-80">by</span>
              <span className="font-semibold">Corporate AI Solutions</span>
            </a>
          </div>
          <div className="flex items-center gap-8">
            <a href="#how-it-works" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium hidden sm:block">How it works</a>
            <a href="#pricing" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium hidden sm:block">Pricing</a>
            <a href="/about" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium hidden sm:block">About</a>
            <a href="/start" className="font-display gradient-sunny text-stone-800 px-5 py-2.5 rounded-full text-sm font-bold hover-pop shadow-md">Try Kira Free ✨</a>
          </div>
        </div>
      </nav>

      {/* Hero Section - Updated messaging */}
      <section className="gradient-hero min-h-screen flex items-center justify-center relative pt-20">
        <div className="blob-1 -top-20 -left-40 opacity-60" />
        <div className="blob-2 top-1/3 -right-20 opacity-50" />
        <div className="blob-3 bottom-20 left-1/4 opacity-40" />

        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10">
          <div className="text-center">
            <div className={`mb-6 ${isVisible ? 'fade-up' : 'opacity-0'}`}>
              <a href="https://corporate-ai-solutions.vercel.app/marketplace" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-stone-800/90 text-white px-4 py-2 rounded-full text-sm font-body hover:bg-stone-700 transition-colors">
                <span className="text-amber-400">⚡</span>
                <span>Part of the <span className="font-semibold text-amber-300">Corporate AI Solutions</span> Voice AI Suite</span>
                <span className="text-xs opacity-60">→</span>
              </a>
            </div>

            <div className={`mb-8 ${isVisible ? 'fade-up' : 'opacity-0'}`}>
              <div className="avatar-ring inline-block">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-white">
                  <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <h1 className={`font-display text-5xl lg:text-7xl font-bold text-stone-800 mb-6 leading-tight ${isVisible ? 'fade-up fade-up-delay-1' : 'opacity-0'}`}>
              Meet <span className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Kira</span>
              <br /><span className="text-3xl lg:text-4xl text-stone-600">Then meet <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">YOUR</span> Kira.</span>
            </h1>

            <p className={`font-body text-xl lg:text-2xl text-stone-600 max-w-2xl mx-auto mb-10 leading-relaxed ${isVisible ? 'fade-up fade-up-delay-2' : 'opacity-0'}`}>
              Not one AI for everyone. A unique thinking partner <span className="font-semibold text-stone-800">built around your specific goal</span> — whether that's figuring out your career, planning a trip, or growing your business.
            </p>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${isVisible ? 'fade-up fade-up-delay-3' : 'opacity-0'}`}>
              <a href="/start" className="font-display gradient-coral text-white px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-xl shadow-pink-200 inline-block">Create Your Kira →</a>
              <span className="font-body text-stone-500">Free for 30 days. Takes 2 minutes.</span>
            </div>
          </div>

          {/* Updated chat preview showing the journey */}
          <div className={`mt-16 max-w-lg mx-auto ${isVisible ? 'fade-up fade-up-delay-3' : 'opacity-0'}`}>
            <div className="bg-white/80 backdrop-blur rounded-3xl p-6 shadow-2xl border border-amber-100">
              <div className="text-center mb-4">
                <span className="text-xs font-body text-stone-400 bg-stone-100 px-3 py-1 rounded-full">Setup Kira learning about you...</span>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="avatar-ring flex-shrink-0"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                  <div className="chat-bubble-kira rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs"><p className="font-body text-stone-700 text-sm">Hey! I'm Kira. What's the one thing you're trying to figure out right now? 🎯</p></div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs"><p className="font-body text-white text-sm">I want to finally get my finances sorted out...</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="avatar-ring flex-shrink-0"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                  <div className="chat-bubble-kira rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs"><p className="font-body text-stone-700 text-sm">Got it. I'm creating a Kira just for this — she'll know your context and be ready to dig in with you. ✨</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Unique Approach */}
      <section className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-5xl mb-4 block">✨</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">Every Kira is <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">different.</span></h2>
            <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">Because every person is different. And every goal deserves its own dedicated guide.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gradient-to-br from-rose-50 to-pink-100 rounded-3xl p-8 border-2 border-rose-200">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">❌</span>
                <h3 className="font-display text-xl font-bold text-stone-800">Other AI assistants</h3>
              </div>
              <ul className="font-body text-stone-600 space-y-3">
                <li className="flex items-start gap-2"><span className="text-rose-400">•</span> Same generic AI for everyone</li>
                <li className="flex items-start gap-2"><span className="text-rose-400">•</span> You repeat context every conversation</li>
                <li className="flex items-start gap-2"><span className="text-rose-400">•</span> Tries to answer everything instantly</li>
                <li className="flex items-start gap-2"><span className="text-rose-400">•</span> No memory of what matters to you</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-3xl p-8 border-2 border-amber-300">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">✨</span>
                <h3 className="font-display text-xl font-bold text-stone-800">Your personal Kira</h3>
              </div>
              <ul className="font-body text-stone-700 space-y-3">
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span> <strong>Built around YOUR specific goal</strong></li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span> Knows your context from day one</li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span> Asks questions before jumping to answers</li>
                <li className="flex items-start gap-2"><span className="text-amber-500">•</span> Remembers and builds on every conversation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Choose Your Journey */}
      <section className="bg-gradient-to-br from-violet-100 via-pink-50 to-amber-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-5xl mb-4 block">🛤️</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">Two journeys. <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">One guide.</span></h2>
            <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">Whether it's personal growth or business strategy, Kira adapts to what you need.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="journey-card bg-white rounded-3xl p-8 shadow-xl border-2 border-violet-200 hover:border-violet-400">
              <div className="w-16 h-16 gradient-lavender rounded-2xl flex items-center justify-center mb-6 text-3xl">🧘</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">Personal Journey</h3>
              <p className="font-body text-stone-600 mb-6">Life decisions, career moves, habits, relationships, travel planning, learning new skills — the stuff that matters to YOU.</p>
              <div className="space-y-2">
                {["Career pivots & job decisions", "Financial planning", "Learning & skill building", "Travel & life experiences", "Personal projects"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-body text-stone-600">
                    <span className="text-violet-500">✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="journey-card bg-white rounded-3xl p-8 shadow-xl border-2 border-amber-200 hover:border-amber-400">
              <div className="w-16 h-16 gradient-sunny rounded-2xl flex items-center justify-center mb-6 text-3xl">💼</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">Business Journey</h3>
              <p className="font-body text-stone-600 mb-6">Strategy, operations, growth challenges, team decisions — a thinking partner for the hard stuff.</p>
              <div className="space-y-2">
                {["Business strategy & planning", "Market positioning", "Operational challenges", "Growth & scaling decisions", "Team & leadership"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-body text-stone-600">
                    <span className="text-amber-500">✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Actually Works - The Real Flow */}
      <section id="how-it-works" className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">How it works 🛠️</h2>
            <p className="font-body text-xl text-stone-600">From first hello to your personalized guide in under 5 minutes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center step-connector">
              <div className="gradient-sunny w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white font-display font-bold text-3xl shadow-lg">1</div>
              <h3 className="font-display text-xl font-bold text-stone-800 mb-3">Choose your journey</h3>
              <p className="font-body text-stone-600">Personal or Business? Pick what you're working on and tell Setup Kira what you're trying to figure out.</p>
            </div>
            <div className="text-center step-connector">
              <div className="gradient-coral w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white font-display font-bold text-3xl shadow-lg">2</div>
              <h3 className="font-display text-xl font-bold text-stone-800 mb-3">Setup Kira learns you</h3>
              <p className="font-body text-stone-600">A quick voice conversation to understand your context, constraints, and what success looks like for you.</p>
            </div>
            <div className="text-center">
              <div className="gradient-lavender w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white font-display font-bold text-3xl shadow-lg">3</div>
              <h3 className="font-display text-xl font-bold text-stone-800 mb-3">YOUR Kira is born</h3>
              <p className="font-body text-stone-600">We create a unique Kira just for you — loaded with your context, ready to think through problems together.</p>
            </div>
          </div>

          {/* Visual flow */}
          <div className="bg-gradient-to-r from-amber-50 via-pink-50 to-violet-50 rounded-3xl p-8 border border-amber-200">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 bg-white rounded-full px-5 py-3 shadow-sm">
                <span className="text-2xl">👤</span>
                <span className="font-body font-medium text-stone-700">You</span>
              </div>
              <span className="text-pink-400 text-2xl">→</span>
              <div className="flex items-center gap-3 bg-white rounded-full px-5 py-3 shadow-sm">
                <div className="avatar-ring"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                <span className="font-body font-medium text-stone-700">Setup Kira</span>
              </div>
              <span className="text-pink-400 text-2xl">→</span>
              <div className="flex items-center gap-3 bg-gradient-to-r from-amber-100 to-pink-100 rounded-full px-5 py-3 shadow-sm border-2 border-amber-300">
                <div className="avatar-ring"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                <span className="font-display font-bold text-stone-800">YOUR Kira</span>
                <span className="text-xs bg-amber-400 text-stone-800 px-2 py-0.5 rounded-full font-bold">Personalized</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Two-Way Partnership */}
      <section className="bg-gradient-to-b from-white to-amber-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-5xl mb-6 block">🤝</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">This is a <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">partnership.</span></h2>
            <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">Kira's honest about what she can and can't do. She needs you to show up too.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-amber-100">
              <h3 className="font-display text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">💬</span> What Kira brings
              </h3>
              <ul className="space-y-4 font-body text-stone-600">
                <li className="flex items-start gap-3"><span className="text-amber-500 mt-1">✓</span> Asks the questions you haven't thought of</li>
                <li className="flex items-start gap-3"><span className="text-amber-500 mt-1">✓</span> Pushes back when something's unclear</li>
                <li className="flex items-start gap-3"><span className="text-amber-500 mt-1">✓</span> Remembers your context and builds on it</li>
                <li className="flex items-start gap-3"><span className="text-amber-500 mt-1">✓</span> Admits when she doesn't know something</li>
              </ul>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-pink-100">
              <h3 className="font-display text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">🙋</span> What Kira needs from you
              </h3>
              <ul className="space-y-4 font-body text-stone-600">
                <li className="flex items-start gap-3"><span className="text-pink-500 mt-1">✓</span> Be honest about what's really going on</li>
                <li className="flex items-start gap-3"><span className="text-pink-500 mt-1">✓</span> Correct her when she's off track</li>
                <li className="flex items-start gap-3"><span className="text-pink-500 mt-1">✓</span> Add context — the more she knows, the better</li>
                <li className="flex items-start gap-3"><span className="text-pink-500 mt-1">✓</span> Think WITH her, not just ask for answers</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 bg-gradient-to-r from-violet-100 to-pink-100 rounded-2xl p-6 text-center">
            <p className="font-body text-stone-700 text-lg">
              <span className="font-bold">When it's not working?</span> Kira offers four paths: add more info, reset your goal, try a different approach, or end the conversation. <span className="text-stone-500">No judgment, just options.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Real Examples */}
      <section className="bg-gradient-to-b from-amber-50 to-pink-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">Real things. <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">Not party tricks.</span></h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { quote: "My Kira knows I hate cooking but need to eat healthier. She doesn't suggest elaborate recipes — she works with who I actually am.", emoji: "🍳", type: "Personal" },
              { quote: "I was stuck on a pricing decision for my SaaS. My Kira asked what my actual goal was — turns out I was solving the wrong problem.", emoji: "💰", type: "Business" },
              { quote: "Planning a career change at 45. My Kira didn't just list options — she helped me figure out what I was really scared of.", emoji: "🎯", type: "Personal" },
              { quote: "Needed to have a hard conversation with my co-founder. My Kira helped me figure out what I was actually trying to say first.", emoji: "💼", type: "Business" }
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 hover-pop shadow-sm border border-amber-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{item.emoji}</span>
                  <span className={`text-xs font-body px-3 py-1 rounded-full ${item.type === 'Personal' ? 'bg-violet-100 text-violet-600' : 'bg-amber-100 text-amber-600'}`}>{item.type}</span>
                </div>
                <p className="font-body text-stone-700 leading-relaxed">"{item.quote}"</p>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-stone-500 mt-8 text-lg">Every one of these came from a Kira built specifically for that person's goal. 💬</p>
        </div>
      </section>

      {/* The Offer */}
      <section id="pricing" className="bg-white py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="fun-border rounded-3xl p-10 lg:p-14 bg-gradient-to-br from-amber-50 to-pink-50">
            <span className="text-6xl mb-6 block">🎉</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">Create your Kira. <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">Free.</span></h2>
            <div className="font-body text-xl text-stone-600 leading-relaxed space-y-4 mb-10">
              <p>30 days free. No credit card. Just start talking and see if it clicks.</p>
              <p>If it works, keep going for <span className="font-bold text-stone-800 text-2xl">$12/month</span>.</p>
              <p>If it doesn't, Kira will want to know why. Honestly.</p>
            </div>
            <a href="/start" className="font-display gradient-coral text-white px-10 py-5 rounded-full text-xl font-bold hover-pop shadow-xl shadow-pink-200 inline-block">Create Your Kira — Free ✨</a>
            <p className="font-body text-stone-400 text-sm mt-4">Your personalized Kira in under 5 minutes ⚡</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gradient-to-b from-white to-amber-50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-stone-800 mb-12 text-center">Questions? 🙋‍♀️</h2>
          <div className="space-y-4">
            {[
              { q: "What do you mean 'my own Kira'?", a: "When you start, you'll have a quick conversation with Setup Kira. She learns what you're working on, your context, and what success looks like. Then we create a unique Kira agent just for you — one that knows your situation from day one." },
              { q: "What can Kira actually help with?", a: "Anything you'd work through with a smart, thoughtful friend. Career decisions, business strategy, trip planning, learning goals, hard conversations — she's a generalist who asks good questions and thinks with you." },
              { q: "Is she really free?", a: "For 30 days, yes. No credit card, no catch. After that it's $12/month if you want to keep going." },
              { q: "What if she gets something wrong?", a: "She will sometimes. When that happens, tell her. She'll adjust and do better. That's how this partnership works." },
              { q: "Is this like ChatGPT?", a: "Kira uses AI, but she's built to be YOUR guide, not a generic answer machine. She knows your specific context, asks questions before jumping to answers, and is designed for ongoing thinking partnerships — not one-off queries." },
              { q: "What happens to my conversations?", a: "They stay private. Kira learns from your conversations to help you better, but your data isn't shared or sold. Ever." },
              { q: "Can I have multiple Kiras for different goals?", a: "Coming soon! For now, each Kira is focused on one primary goal. If you finish that journey and want to start a new one, you can create a new Kira." }
            ].map((faq, index) => (
              <details key={index} className="bg-white rounded-2xl border border-amber-100 group">
                <summary className="font-display text-lg font-bold text-stone-800 p-6 cursor-pointer list-none flex items-center justify-between hover:bg-amber-50 rounded-2xl transition-colors">
                  {faq.q}
                  <span className="text-pink-400 group-open:rotate-45 transition-transform text-2xl">+</span>
                </summary>
                <div className="px-6 pb-6 font-body text-stone-600 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate AI Solutions Banner */}
      <section className="bg-stone-900 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="font-body text-stone-400 text-sm uppercase tracking-wider mb-4">Brought to you by</p>
          <h3 className="font-display text-3xl font-bold text-white mb-4">Corporate AI Solutions</h3>
          <p className="font-body text-stone-300 text-lg mb-8 max-w-2xl mx-auto">
            Kira is part of a suite of specialized AI Voice Agents. Each one built for a specific purpose. Each one designed to think WITH you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://corporate-ai-solutions.vercel.app/marketplace" target="_blank" rel="noopener noreferrer"
              className="font-display bg-amber-500 hover:bg-amber-400 text-stone-900 px-6 py-3 rounded-full font-bold transition-colors inline-flex items-center gap-2">
              Explore the Marketplace →
            </a>
            <a href="/about" className="font-display text-white hover:text-amber-400 px-6 py-3 font-medium transition-colors inline-flex items-center gap-2">Learn Our Story</a>
          </div>
        </div>
      </section>

      {/* Footer */}
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
              <a href="/about" className="hover:text-pink-400 transition-colors">About</a>
              <a href="#how-it-works" className="hover:text-pink-400 transition-colors">How it Works</a>
              <a href="#pricing" className="hover:text-pink-400 transition-colors">Pricing</a>
              <a href="#" className="hover:text-pink-400 transition-colors">Privacy</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-stone-700 text-center">
            <p className="font-body text-stone-500 text-sm">
              © 2025 Corporate AI Solutions · Created by Dennis McMahin ·
              <a href="https://corporate-ai-solutions.vercel.app/studio/thesis" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 ml-1">Longtail AI Ventures</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}