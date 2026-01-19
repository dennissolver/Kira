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

      {/* Hero Section */}
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
              <br /><span className="text-4xl lg:text-5xl">Your guide through... whatever it is.</span>
            </h1>

            <p className={`font-body text-xl lg:text-2xl text-stone-600 max-w-2xl mx-auto mb-10 leading-relaxed ${isVisible ? 'fade-up fade-up-delay-2' : 'opacity-0'}`}>
              She's not a magic answer machine. She's a thinking partner who asks questions, pushes back, and actually helps you figure things out.
            </p>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${isVisible ? 'fade-up fade-up-delay-3' : 'opacity-0'}`}>
              <a href="/start" className="font-display gradient-coral text-white px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-xl shadow-pink-200 inline-block">Start Talking to Kira →</a>
              <span className="font-body text-stone-500">Free for 30 days. No credit card.</span>
            </div>
          </div>

          <div className={`mt-16 max-w-lg mx-auto ${isVisible ? 'fade-up fade-up-delay-3' : 'opacity-0'}`}>
            <div className="bg-white/80 backdrop-blur rounded-3xl p-6 shadow-2xl border border-amber-100">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="avatar-ring flex-shrink-0"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                  <div className="chat-bubble-kira rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs"><p className="font-body text-stone-700 text-sm">Hey! What's on your mind today? 💭</p></div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs"><p className="font-body text-white text-sm">I need to make a decision about my job...</p></div>
                </div>
                <div className="flex gap-3">
                  <div className="avatar-ring flex-shrink-0"><div className="w-8 h-8 rounded-full overflow-hidden bg-white"><img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" /></div></div>
                  <div className="chat-bubble-kira rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs"><p className="font-body text-stone-700 text-sm">Okay, let's think through this together. What's making the decision hard?</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Real Deal Section */}
      <section className="bg-white py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-5xl mb-4 block">🤝</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">Here's the deal.</h2>
            <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">Kira's not going to pretend she has all the answers. She doesn't. Nobody does.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 hover-pop">
              <div className="text-4xl mb-4">💡</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">She asks questions</h3>
              <p className="font-body text-stone-600 leading-relaxed">Before jumping to solutions, Kira figures out what you actually need. Sometimes that's the whole point.</p>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-8 hover-pop">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">She pushes back</h3>
              <p className="font-body text-stone-600 leading-relaxed">If something's unclear or you're missing context, she'll say so. That's not being difficult — that's being useful.</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-8 hover-pop">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">She learns you</h3>
              <p className="font-body text-stone-600 leading-relaxed">The more you talk, the more context she has. She remembers what matters to you and builds on it.</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 hover-pop">
              <div className="text-4xl mb-4">✋</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">She owns mistakes</h3>
              <p className="font-body text-stone-600 leading-relaxed">When she gets it wrong (she will sometimes), tell her. She'll adjust and do better. That's how this works.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Way Street */}
      <section className="bg-gradient-to-br from-violet-100 via-pink-50 to-amber-50 py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-5xl mb-6 block">↔️</span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">This is a <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">two-way</span> thing.</h2>
          <p className="font-body text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed mb-12">Kira does her best with what she knows. But she needs you to show up too.</p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-2xl mb-3">🗣️</div>
              <h3 className="font-display font-bold text-stone-800 mb-2">Be honest</h3>
              <p className="font-body text-stone-600 text-sm">Tell her what's really going on. The more context, the better she can help.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-2xl mb-3">🔧</div>
              <h3 className="font-display font-bold text-stone-800 mb-2">Correct her</h3>
              <p className="font-body text-stone-600 text-sm">If she's off, say so. She'll adjust. That's not rude — it's helpful.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-2xl mb-3">🤔</div>
              <h3 className="font-display font-bold text-stone-800 mb-2">Think with her</h3>
              <p className="font-body text-stone-600 text-sm">She's a guide, not a genie. The best results come from working together.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">How it works 🛠️</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: "1", title: "Just start talking", description: "No onboarding quiz. Just tell Kira what's on your mind.", color: "gradient-sunny" },
              { number: "2", title: "She asks questions", description: "Kira makes sure she gets what you actually need.", color: "gradient-coral" },
              { number: "3", title: "Work together", description: "She guides, you push back, she adjusts.", color: "gradient-lavender" },
              { number: "4", title: "She learns", description: "More context = better help. Every time.", color: "gradient-mint" }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className={`${step.color} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-display font-bold text-2xl shadow-lg`}>{step.number}</div>
                <h3 className="font-display text-xl font-bold text-stone-800 mb-2">{step.title}</h3>
                <p className="font-body text-stone-600 text-sm">{step.description}</p>
              </div>
            ))}
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
              { quote: "I was planning a trip to Portugal and had no idea where to start. Kira asked me what kind of trip I actually wanted — I hadn't even thought about it.", emoji: "✈️" },
              { quote: "I needed to write a hard email to my boss. Kira didn't just write it for me — she helped me figure out what I was really trying to say.", emoji: "📧" },
              { quote: "I was stuck on whether to take a new job. Kira asked better questions than I was asking myself.", emoji: "🎯" },
              { quote: "She helped me meal plan for the week. I told her I hate cooking — she worked with that.", emoji: "🍳" }
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 hover-pop shadow-sm border border-amber-100">
                <div className="text-3xl mb-4">{item.emoji}</div>
                <p className="font-body text-stone-700 leading-relaxed">"{item.quote}"</p>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-stone-500 mt-8 text-lg">These aren't magic. They're conversations. 💬</p>
        </div>
      </section>

      {/* The Offer */}
      <section id="pricing" className="bg-white py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="fun-border rounded-3xl p-10 lg:p-14 bg-gradient-to-br from-amber-50 to-pink-50">
            <span className="text-6xl mb-6 block">🎉</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">Try her for a month. <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">Free.</span></h2>
            <div className="font-body text-xl text-stone-600 leading-relaxed space-y-4 mb-10">
              <p>No credit card. No commitment. Just start talking and see if it clicks.</p>
              <p>If it works, keep going for <span className="font-bold text-stone-800 text-2xl">$12/month</span>.</p>
              <p>If it doesn't, Kira will want to know why. Honestly.</p>
            </div>
            <a href="/start" className="font-display gradient-coral text-white px-10 py-5 rounded-full text-xl font-bold hover-pop shadow-xl shadow-pink-200 inline-block">Start Talking to Kira — Free ✨</a>
            <p className="font-body text-stone-400 text-sm mt-4">You'll be talking to her in about 10 seconds ⚡</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gradient-to-b from-white to-amber-50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-stone-800 mb-12 text-center">Questions? 🙋‍♀️</h2>
          <div className="space-y-4">
            {[
              { q: "What can Kira actually help with?", a: "Anything you'd ask a smart, thoughtful friend. Planning, decisions, writing, thinking things through. She's not a specialist — she's a generalist who asks good questions." },
              { q: "Is she really free?", a: "For the first month, yes! No credit card, no catch. After that it's $12/month if you want to keep going." },
              { q: "What if she gets something wrong?", a: "She will sometimes. When that happens, tell her. She'll adjust, learn, and do better. That's how this works." },
              { q: "Is this like ChatGPT?", a: "Kira uses AI, but she's built to be a guide, not an answer machine. She asks questions, pushes back, and works with you — not just for you." },
              { q: "What happens to my conversations?", a: "They stay private. Kira learns from your conversations to help you better, but your data isn't shared or sold. Ever." },
              { q: "What if I decide it's not for me?", a: "That's okay! Kira will ask you what happened — not to guilt you, but because she actually wants to get better. You can walk away anytime." }
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
            Kira is one of a suite of AI Voice Agent platforms, created by the masters of Voice AI Solutions.
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