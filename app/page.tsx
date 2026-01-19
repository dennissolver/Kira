"use client";

import React, { useState, useEffect } from 'react';

// Kira Landing Page — Vibrant, Warm, Energetic
// She's friendly, approachable, and has personality

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
        
        .gradient-warm {
          background: linear-gradient(135deg, #fef3c7 0%, #fbcfe8 100%);
        }
        
        .gradient-coral {
          background: linear-gradient(135deg, #fb7185 0%, #f472b6 100%);
        }
        
        .gradient-sunny {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        }
        
        .gradient-lavender {
          background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
        }
        
        .gradient-mint {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
        }
        
        .blob-1 {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(60px);
          animation: float1 20s ease-in-out infinite;
        }
        
        .blob-2 {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(244, 114, 182, 0.35) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(60px);
          animation: float2 25s ease-in-out infinite;
        }
        
        .blob-3 {
          position: absolute;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(167, 139, 250, 0.3) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(50px);
          animation: float3 18s ease-in-out infinite;
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
        
        .fade-up {
          opacity: 0;
          transform: translateY(30px);
          animation: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        .fade-up-delay-1 { animation-delay: 0.15s; }
        .fade-up-delay-2 { animation-delay: 0.3s; }
        .fade-up-delay-3 { animation-delay: 0.45s; }
        
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .hover-pop {
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        }
        
        .hover-pop:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .wiggle:hover {
          animation: wiggle 0.5s ease-in-out;
        }
        
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        
        .avatar-ring {
          background: linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%);
          padding: 3px;
          border-radius: 50%;
        }
        
        .chat-bubble-kira {
          background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%);
          border: 2px solid rgba(251, 191, 36, 0.3);
        }
        
        .chat-bubble-user {
          background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        }
        
        .fun-border {
          border: 3px solid transparent;
          background: 
            linear-gradient(white, white) padding-box,
            linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%) border-box;
        }
        
        .section-divider {
          height: 6px;
          background: linear-gradient(90deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%);
          border-radius: 3px;
        }
        
        .card-coral { border-top: 4px solid #fb7185; }
        .card-sunny { border-top: 4px solid #fbbf24; }
        .card-lavender { border-top: 4px solid #a78bfa; }
        .card-mint { border-top: 4px solid #34d399; }
        
        .marquee {
          animation: marquee 30s linear infinite;
        }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-amber-50/80 backdrop-blur-lg border-b border-amber-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 wiggle cursor-pointer">
            <div className="avatar-ring">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
                <img
                  src="/kira-avatar.jpg"
                  alt="Kira"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <span className="font-display font-bold text-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
              Kira
            </span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#how-it-works" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium">How it works</a>
            <a href="#pricing" className="font-body text-stone-600 hover:text-pink-500 transition-colors font-medium">Pricing</a>
            <button className="font-display gradient-coral text-white px-6 py-2.5 rounded-full font-semibold hover-pop shadow-lg shadow-pink-200">
              Talk to Kira ✨
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-hero min-h-screen flex items-center pt-20 relative overflow-hidden">
        {/* Animated blobs */}
        <div className="blob-1 -top-40 -left-40"></div>
        <div className="blob-2 top-1/3 -right-20"></div>
        <div className="blob-3 bottom-20 left-1/4"></div>

        <div className="max-w-6xl mx-auto px-6 py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className={isVisible ? 'fade-up' : 'opacity-0'}>
              <h1 className="font-display text-5xl lg:text-7xl font-bold text-stone-800 leading-tight mb-6">
                Tired of figuring
                <br />
                <span className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
                  it
                </span>
                <span className="text-stone-400 text-3xl lg:text-4xl font-normal italic ml-2">(whatever your it is)</span>
                <br />
                out alone?
              </h1>
              <div className="font-body text-xl text-stone-600 leading-relaxed mb-8 max-w-lg space-y-4">
                <p>
                  You've Googled it. You've asked ChatGPT. You've read the articles, watched the videos, scrolled the threads.
                </p>
                <p>
                  But you're still stuck — because what you actually need isn't more information.
                </p>
                <p className="text-stone-800 font-medium">
                  You need someone to talk it through with. Someone who asks the right questions. Someone who gives you the time.
                </p>
                <p className="text-2xl">
                  That's <span className="font-display font-bold bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Kira</span>.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <button className="font-display gradient-sunny text-stone-800 px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-lg shadow-amber-200 flex items-center gap-2">
                  Start Talking to Kira — Free
                  <span className="text-xl">→</span>
                </button>
              </div>
              <p className="font-body text-stone-500 text-sm mt-4">
                No credit card. No walls of text. Just a real conversation.
              </p>
            </div>

            <div className={isVisible ? 'fade-up fade-up-delay-2' : 'opacity-0'}>
              <div className="relative">
                <div className="absolute -inset-4 gradient-warm rounded-3xl blur-2xl opacity-60"></div>
                <div className="relative bg-white rounded-3xl p-6 shadow-2xl border-2 border-amber-100">
                  {/* Chat header */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-100">
                    <div className="avatar-ring">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white">
                        <img
                          src="/kira-avatar.jpg"
                          alt="Kira"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-display font-bold text-stone-800">Kira</div>
                      <div className="flex items-center gap-1 text-sm text-green-500">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Online now
                      </div>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-amber-200">
                        <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
                      </div>
                      <div className="chat-bubble-kira rounded-2xl rounded-tl-md px-4 py-3 font-body text-stone-700 max-w-xs">
                        Hey! 👋 What are we working on today?
                      </div>
                    </div>

                    <div className="flex items-start gap-3 justify-end">
                      <div className="chat-bubble-user rounded-2xl rounded-tr-md px-4 py-3 font-body text-white max-w-xs">
                        I need to plan a trip to Portugal but I have no idea where to start 😅
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-amber-200">
                        <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
                      </div>
                      <div className="chat-bubble-kira rounded-2xl rounded-tl-md px-4 py-3 font-body text-stone-700 max-w-xs">
                        Ooh Portugal is amazing! 🇵🇹 Before we dive in — what kind of trip do you actually want? Beach vibes, city exploring, food adventures? And who's coming with?
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Colorful divider */}
      <div className="section-divider mx-6"></div>

      {/* Choose Your Path Section */}
      <section className="bg-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 mb-4">
              So, what's your <span className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent italic">it</span>?
            </h2>
            <p className="font-body text-xl text-stone-500">
              Choose your path — Kira will meet you where you are.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Personal Path */}
            <a
              href="/start?type=personal"
              className="group bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border-2 border-amber-200 hover:border-amber-400 hover-pop cursor-pointer block"
            >
              <div className="text-5xl mb-4">🏠</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">
                It's personal
              </h3>
              <p className="font-body text-stone-600 leading-relaxed mb-6">
                Life stuff. Planning a trip. Making a decision. Writing something hard. Figuring out what's next. Meal planning. Event organizing. The stuff you'd ask a smart friend about.
              </p>
              <ul className="font-body text-stone-500 text-sm space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">✓</span> Trip & event planning
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">✓</span> Big life decisions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">✓</span> Writing help (emails, messages, posts)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-500">✓</span> Learning & figuring things out
                </li>
              </ul>
              <div className="flex items-center gap-2 font-display font-semibold text-amber-600 group-hover:text-amber-700">
                Start my personal journey
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </a>

            {/* Business Path */}
            <a
              href="/start?type=business"
              className="group bg-gradient-to-br from-violet-50 to-pink-50 rounded-3xl p-8 border-2 border-violet-200 hover:border-violet-400 hover-pop cursor-pointer block"
            >
              <div className="text-5xl mb-4">💼</div>
              <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">
                It's business
              </h3>
              <p className="font-body text-stone-600 leading-relaxed mb-6">
                Work stuff. Strategy. Projects. Team challenges. Client problems. The pitch you're stuck on. The decision that keeps you up at night. The thing you'd talk to a mentor about.
              </p>
              <ul className="font-body text-stone-500 text-sm space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">✓</span> Strategy & planning
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">✓</span> Project problem-solving
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">✓</span> Business writing & comms
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-violet-500">✓</span> Thinking through tough calls
                </li>
              </ul>
              <div className="flex items-center gap-2 font-display font-semibold text-violet-600 group-hover:text-violet-700">
                Start my business journey
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </a>
          </div>

          <p className="text-center font-body text-stone-400 text-sm mt-8">
            Both paths get a free month. No credit card required.
          </p>
        </div>
      </section>

      {/* Colorful divider */}

      {/* The Deal Section */}
      <section className="bg-white py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-5xl mb-4 block">🤝</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              This is a <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">two-way</span> thing.
            </h2>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-pink-50 rounded-3xl p-8 lg:p-12 border-2 border-amber-100">
            <div className="font-body text-xl text-stone-600 leading-relaxed space-y-6 max-w-2xl mx-auto">
              <p>
                Kira will ask you questions. She'll push back when something's unclear. She'll tell you when she doesn't know.
              </p>
              <p className="text-2xl">
                And she needs <span className="font-bold text-pink-500">you</span> to show up too.
              </p>
              <p>
                Be honest with her. Give her context. Tell her when she's off. The more you put in, the better she gets.
              </p>
              <p className="font-display font-bold text-stone-800 text-2xl pt-4">
                That's how good advice works. From anyone. ✨
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Kira Helps With */}
      <section id="how-it-works" className="bg-gradient-to-b from-white to-amber-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              She helps you <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">think through</span> things.
            </h2>
            <p className="font-body text-xl text-stone-500">
              Not a search engine. A thinking partner. 🧠
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Planning",
                description: "Trips, events, meals, moves, projects. She'll help you figure out what you're actually trying to do — and then how to do it.",
                emoji: "🗺️",
                color: "card-sunny",
                bg: "bg-amber-50"
              },
              {
                title: "Decisions",
                description: "Trade-offs, priorities, \"what should I do?\" She'll ask the questions you're not asking yourself.",
                emoji: "🤔",
                color: "card-coral",
                bg: "bg-pink-50"
              },
              {
                title: "Writing",
                description: "Emails, messages, posts, anything you're stuck on. She'll help you say what you mean.",
                emoji: "✍️",
                color: "card-lavender",
                bg: "bg-violet-50"
              },
              {
                title: "Figuring it out",
                description: "When you don't know where to start. She'll help you untangle it.",
                emoji: "💡",
                color: "card-mint",
                bg: "bg-emerald-50"
              }
            ].map((item, index) => (
              <div
                key={index}
                className={`${item.bg} ${item.color} rounded-2xl p-8 hover-pop`}
              >
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="font-display text-2xl font-bold text-stone-800 mb-3">
                  {item.title}
                </h3>
                <p className="font-body text-stone-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Honest Part */}
      <section className="bg-gradient-to-br from-stone-800 via-stone-900 to-stone-800 py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-40 h-40 bg-pink-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-60 h-60 bg-amber-500 rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="text-5xl mb-6 block">💯</span>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white mb-8">
            Sometimes she'll get it wrong.
          </h2>
          <div className="font-body text-xl text-stone-300 leading-relaxed space-y-6 max-w-2xl mx-auto">
            <p>
              Kira's a guide. She'll do her best — but she's not perfect.
            </p>
            <p>
              Neither is any friend you'd ask for advice. Neither is any expert you'd hire. <span className="text-amber-400">Neither is anyone.</span>
            </p>
            <p>
              Sometimes she'll miss something. Sometimes you didn't tell her what she needed to know. Sometimes it's just not a fit.
            </p>
            <p className="text-white font-display font-bold text-2xl pt-6">
              When that happens, you'll figure out why together. <span className="text-pink-400">That's the deal.</span>
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Steps */}
      <section className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Talk to her like a <span className="bg-gradient-to-r from-pink-500 to-amber-500 bg-clip-text text-transparent">friend</span>.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                number: "1",
                title: "Start chatting",
                description: "No setup. No quiz. Just say what's on your mind.",
                color: "gradient-sunny"
              },
              {
                number: "2",
                title: "She asks questions",
                description: "Kira makes sure she gets what you actually need.",
                color: "gradient-coral"
              },
              {
                number: "3",
                title: "Work together",
                description: "She guides, you push back, she adjusts.",
                color: "gradient-lavender"
              },
              {
                number: "4",
                title: "She learns",
                description: "More context = better help. Every time.",
                color: "gradient-mint"
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className={`${step.color} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-display font-bold text-2xl shadow-lg`}>
                  {step.number}
                </div>
                <h3 className="font-display text-xl font-bold text-stone-800 mb-2">
                  {step.title}
                </h3>
                <p className="font-body text-stone-600 text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real Examples */}
      <section className="bg-gradient-to-b from-amber-50 to-pink-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-4">
              Real things. <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">Not party tricks.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                quote: "I was planning a trip to Portugal and had no idea where to start. Kira asked me what kind of trip I actually wanted — I hadn't even thought about it.",
                emoji: "✈️"
              },
              {
                quote: "I needed to write a hard email to my boss. Kira didn't just write it for me — she helped me figure out what I was really trying to say.",
                emoji: "📧"
              },
              {
                quote: "I was stuck on whether to take a new job. Kira asked better questions than I was asking myself.",
                emoji: "🎯"
              },
              {
                quote: "She helped me meal plan for the week. I told her I hate cooking — she worked with that.",
                emoji: "🍳"
              }
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 hover-pop shadow-sm border border-amber-100"
              >
                <div className="text-3xl mb-4">{item.emoji}</div>
                <p className="font-body text-stone-700 leading-relaxed">
                  "{item.quote}"
                </p>
              </div>
            ))}
          </div>
          <p className="text-center font-body text-stone-500 mt-8 text-lg">
            These aren't magic. They're conversations. 💬
          </p>
        </div>
      </section>

      {/* The Offer */}
      <section id="pricing" className="bg-white py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="fun-border rounded-3xl p-10 lg:p-14 bg-gradient-to-br from-amber-50 to-pink-50">
            <span className="text-6xl mb-6 block">🎉</span>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-stone-800 mb-6">
              Try her for a month. <span className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">Free.</span>
            </h2>
            <div className="font-body text-xl text-stone-600 leading-relaxed space-y-4 mb-10">
              <p>
                No credit card. No commitment. Just start talking and see if it clicks.
              </p>
              <p>
                If it works, keep going for <span className="font-bold text-stone-800 text-2xl">$12/month</span>.
              </p>
              <p>
                If it doesn't, Kira will want to know why. Honestly.
              </p>
            </div>
            <button className="font-display gradient-coral text-white px-10 py-5 rounded-full text-xl font-bold hover-pop shadow-xl shadow-pink-200">
              Start Talking to Kira — Free ✨
            </button>
            <p className="font-body text-stone-400 text-sm mt-4">
              You'll be talking to her in about 10 seconds ⚡
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gradient-to-b from-white to-amber-50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-stone-800 mb-12 text-center">
            Questions? 🙋‍♀️
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "What can Kira actually help with?",
                a: "Anything you'd ask a smart, thoughtful friend. Planning, decisions, writing, thinking things through. She's not a specialist — she's a generalist who asks good questions."
              },
              {
                q: "Is she really free?",
                a: "For the first month, yes! No credit card, no catch. After that it's $12/month if you want to keep going."
              },
              {
                q: "What if she gets something wrong?",
                a: "She will sometimes. When that happens, tell her. She'll adjust, learn, and do better. That's how this works."
              },
              {
                q: "Is this like ChatGPT?",
                a: "Kira uses AI, but she's built to be a guide, not an answer machine. She asks questions, pushes back, and works with you — not just for you."
              },
              {
                q: "What happens to my conversations?",
                a: "They stay private. Kira learns from your conversations to help you better, but your data isn't shared or sold. Ever."
              },
              {
                q: "What if I decide it's not for me?",
                a: "That's okay! Kira will ask you what happened — not to guilt you, but because she actually wants to get better. You can walk away anytime."
              }
            ].map((faq, index) => (
              <details
                key={index}
                className="bg-white rounded-2xl border border-amber-100 group"
              >
                <summary className="font-display text-lg font-bold text-stone-800 p-6 cursor-pointer list-none flex items-center justify-between hover:bg-amber-50 rounded-2xl transition-colors">
                  {faq.q}
                  <span className="text-pink-400 group-open:rotate-45 transition-transform text-2xl">+</span>
                </summary>
                <div className="px-6 pb-6 font-body text-stone-600 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-800 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-display text-2xl text-stone-300 mb-8">
              Kira's not trying to be perfect.<br />
              <span className="text-white font-bold">She's trying to be useful.</span> ✨
            </p>
            <button className="font-display gradient-sunny text-stone-800 px-8 py-4 rounded-full text-lg font-bold hover-pop shadow-lg">
              Start Talking to Kira →
            </button>
          </div>
          <div className="border-t border-stone-700 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="avatar-ring">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
                  <img
                    src="/kira-avatar.jpg"
                    alt="Kira"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <span className="font-display font-bold text-white">Kira</span>
            </div>
            <div className="flex items-center gap-6 font-body text-sm text-stone-400">
              <a href="#" className="hover:text-pink-400 transition-colors">About</a>
              <a href="#" className="hover:text-pink-400 transition-colors">How it Works</a>
              <a href="#" className="hover:text-pink-400 transition-colors">Pricing</a>
              <a href="#" className="hover:text-pink-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-pink-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}