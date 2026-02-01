// app/pubguard/scan/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Shield, Search, ArrowLeft, Volume2, VolumeX, Mic, User, Pencil, Code, FlaskConical, FileSearch } from 'lucide-react';
import PubGuardScanProgress from '@/components/PubGuardScanProgress';
import PubGuardReportDisplay from '@/components/PubGuardReport';
import PubGuardMethodology from '@/components/PubGuardMethodology';
import { WriterReport, DeveloperReport, UserReport, AnalystReport } from '@/components/UserTypeReports';
import { useConversation } from '@elevenlabs/react';

type ViewState = 'input' | 'scanning' | 'report';

type UserType = 'writer' | 'developer' | 'user' | 'analyst';

interface UserTypeOption {
  id: UserType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const USER_TYPES: UserTypeOption[] = [
  {
    id: 'writer',
    label: 'Tech Writer',
    description: 'Writing about this software for publication',
    icon: <Pencil className="w-5 h-5" />,
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Testing my own project before release',
    icon: <Code className="w-5 h-5" />,
  },
  {
    id: 'user',
    label: 'Prospective User',
    description: 'Evaluating before using this software',
    icon: <User className="w-5 h-5" />,
  },
  {
    id: 'analyst',
    label: 'Security Analyst',
    description: 'Expert analysis for a security report',
    icon: <FileSearch className="w-5 h-5" />,
  },
];

// Generate Kira's spoken summary tailored to user type
function generateKiraSummary(report: any, userType: UserType): string {
  const { trafficLight, overallRiskScore, target, findings, writerGuidance } = report;

  const totalCritical = findings.critical?.length || 0;
  const totalHigh = findings.high?.length || 0;
  const totalMedium = findings.medium?.length || 0;
  const totalPositive = findings.positive?.length || 0;

  let intro = '';
  let details = '';
  let recommendation = '';

  // User-type specific greeting
  const greetings: Record<UserType, string> = {
    writer: `I've completed the security scan of ${target.name} for your article.`,
    developer: `I've finished auditing your project, ${target.name}.`,
    user: `I've checked ${target.name} to help you decide if it's safe to use.`,
    analyst: `Security assessment complete for ${target.name}.`,
  };

  intro = greetings[userType];

  // Rating info
  if (trafficLight === 'red') {
    intro += ` This software has a RED rating with a risk score of ${overallRiskScore} out of 100.`;
  } else if (trafficLight === 'amber') {
    intro += ` This software has an AMBER rating with a risk score of ${overallRiskScore} out of 100.`;
  } else {
    intro += ` Good news - it has a GREEN rating with a risk score of just ${overallRiskScore} out of 100.`;
  }

  // Key findings
  if (totalCritical > 0 || totalHigh > 0) {
    const criticalText = totalCritical > 0 ? `${totalCritical} critical` : '';
    const highText = totalHigh > 0 ? `${totalHigh} high severity` : '';
    const connector = criticalText && highText ? ' and ' : '';

    details = ` I found ${criticalText}${connector}${highText} issues. `;

    const topFinding = findings.critical?.[0] || findings.high?.[0];
    if (topFinding) {
      details += `The most serious concern is: ${topFinding.title}. `;
    }
  } else if (totalMedium > 0) {
    details = ` I found ${totalMedium} medium severity issues worth noting. `;
  } else if (totalPositive > 0) {
    details = ` I found ${totalPositive} positive security indicators. `;
  }

  // User-type specific recommendations
  if (userType === 'writer') {
    if (writerGuidance?.canRecommend === false) {
      recommendation = `My recommendation is to NOT recommend this software in your article. The risks are too significant for your readers.`;
    } else if (writerGuidance?.mustDisclose?.length > 0) {
      recommendation = `You can write about this software, but you should disclose ${writerGuidance.mustDisclose.length} risk factors to your readers.`;
    } else {
      recommendation = `This software is safe to recommend in your article without major caveats.`;
    }
  } else if (userType === 'developer') {
    if (trafficLight === 'red') {
      recommendation = `I'd strongly recommend addressing these security issues before releasing. They could put your users at risk and damage trust in your project.`;
    } else if (trafficLight === 'amber') {
      recommendation = `There are some issues to address before release. I can walk you through each one and suggest fixes.`;
    } else {
      recommendation = `Your security posture looks solid. A few minor improvements could make it even better.`;
    }
  } else if (userType === 'user') {
    if (trafficLight === 'red') {
      recommendation = `I'd advise against using this software. The security risks could compromise your system or data.`;
    } else if (trafficLight === 'amber') {
      recommendation = `You can use this software, but be aware of the risks. I can explain what precautions to take.`;
    } else {
      recommendation = `This software appears safe to use. I found no major security concerns.`;
    }
  } else if (userType === 'analyst') {
    recommendation = `I can provide detailed technical breakdowns of each finding for your report. The full data is available in the report below.`;
  }

  return `${intro}${details}${recommendation} Would you like me to explain any of the findings in more detail?`;
}

// Generate Kira's system prompt based on user type
function generateKiraPrompt(report: any, userType: UserType): string {
  const baseContext = `You are Kira, a security analyst AI. You just completed a PubGuard security scan with these results:
- Software: ${report.target.name}
- Rating: ${report.trafficLight.toUpperCase()}
- Risk Score: ${report.overallRiskScore}/100
- Critical Issues: ${report.findings.critical?.length || 0}
- High Issues: ${report.findings.high?.length || 0}
- Medium Issues: ${report.findings.medium?.length || 0}

Key findings:
${report.findings.critical?.slice(0, 3).map((f: any) => `- CRITICAL: ${f.title}: ${f.description}`).join('\n') || ''}
${report.findings.high?.slice(0, 3).map((f: any) => `- HIGH: ${f.title}: ${f.description}`).join('\n') || ''}
${report.findings.medium?.slice(0, 2).map((f: any) => `- MEDIUM: ${f.title}`).join('\n') || ''}

Writer guidance:
- Can recommend: ${report.writerGuidance?.canRecommend ? 'Yes with disclosures' : 'No'}
- Must disclose: ${report.writerGuidance?.mustDisclose?.join(', ') || 'Nothing specific'}
- Suggested caveats: ${report.writerGuidance?.suggestedCaveats?.join('; ') || 'None'}`;

  const userTypeContexts: Record<UserType, string> = {
    writer: `
    
The user is a TECH WRITER writing about this software for publication.
- Focus on what they should tell their readers
- Explain risks in terms of reader safety
- Suggest specific disclosure language they can use
- Help them write accurate, balanced coverage
- If they can't recommend it, suggest alternative angles for the article`,

    developer: `

The user is the DEVELOPER of this software, testing before release.
- Be constructive and solution-oriented
- For each issue, suggest specific fixes
- Prioritize issues by impact and effort to fix
- Acknowledge what they're doing right
- Help them improve their security posture
- Suggest security best practices they could adopt`,

    user: `

The user is a PROSPECTIVE USER evaluating this software before using it.
- Focus on practical risks to their system and data
- Explain what could go wrong in plain terms
- Suggest precautions if they decide to use it anyway
- Compare to what secure alternatives might offer
- Help them make an informed decision`,

    analyst: `

The user is a SECURITY ANALYST conducting expert analysis for a report.
- Provide technical depth and specifics
- Reference security frameworks (OWASP, CWE) where relevant
- Discuss attack vectors and exploitation scenarios
- Offer severity justifications
- Be precise about evidence and confidence levels
- Support their professional analysis`,
  };

  return baseContext + userTypeContexts[userType] + `

Answer follow-up questions about this security report. Be concise, helpful, and tailored to their role.`;
}

// User-Type Specific Report Section
function UserTypeReportSection({ report, userType }: { report: any; userType: UserType }) {
  const userTypeLabels: Record<UserType, string> = {
    writer: '📝 Writer View',
    developer: '🔧 Developer View',
    user: '👤 User View',
    analyst: '🔬 Analyst View',
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{userTypeLabels[userType]}</span>
        <span className="text-slate-500 text-sm">— Personalized for your needs</span>
      </div>

      {userType === 'writer' && <WriterReport report={report} />}
      {userType === 'developer' && <DeveloperReport report={report} />}
      {userType === 'user' && <UserReport report={report} />}
      {userType === 'analyst' && <AnalystReport report={report} />}
    </div>
  );
}

// Kira Voice Component
function KiraVoiceNarrator({
  report,
  userType,
  autoStart = true
}: {
  report: any;
  userType: UserType;
  autoStart?: boolean;
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log('[Kira] Connected');
    },
    onDisconnect: () => {
      console.log('[Kira] Disconnected');
      setIsSpeaking(false);
    },
    onError: (err) => {
      console.error('[Kira] Error:', err);
      setError('Voice connection failed');
      setIsSpeaking(false);
    },
    onMessage: (message) => {
      console.log('[Kira] Message:', message);
    },
  });

  useEffect(() => {
    if (autoStart && report && !hasStarted.current) {
      hasStarted.current = true;
      setTimeout(() => startNarration(), 500);
    }
  }, [report, autoStart]);

  const startNarration = async () => {
    try {
      setError(null);
      setIsSpeaking(true);

      // Use TTS directly for now - conversational agent has SDK compatibility issues
      // TODO: Re-enable conversational agent once ElevenLabs SDK issue is resolved
      console.log('[Kira] Using TTS mode');
      await speakWithTTS(generateKiraSummary(report, userType));

    } catch (err) {
      console.error('[Kira] Start error:', err);
      setIsSpeaking(false);
      setError('Voice narration failed. Please try again.');
    }
  };

  const stopNarration = async () => {
    try {
      await conversation.endSession();
      setIsSpeaking(false);
    } catch (err) {
      console.error('[Kira] Stop error:', err);
      setIsSpeaking(false);
    }
  };

  const speakWithTTS = async (text: string) => {
    try {
      const voiceId = process.env.NEXT_PUBLIC_KIRA_VOICE_ID || 'M7ya1YbaeFaPXljg9BpK'; // Hannah
      const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

      if (!apiKey) {
        console.log('[Kira] No API key, skipping voice');
        setError('Voice not configured');
        setIsSpeaking(false);
        return;
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setError('Audio playback failed');
      };

      await audio.play();
    } catch (err) {
      console.error('[Kira] TTS error:', err);
      setError('Voice playback failed');
      setIsSpeaking(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Kira Avatar */}
      <div className={`relative w-14 h-14 rounded-full overflow-hidden border-2 flex-shrink-0 ${
        isSpeaking ? 'border-red-500 animate-pulse' : 'border-slate-600'
      }`}>
        <Image
          src="/kira-avatar.jpg"
          alt="Kira"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Status */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">Kira</span>
          {isSpeaking && (
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full animate-pulse">
              Speaking...
            </span>
          )}
          {error && (
            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
              {error}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">Security Analyst</p>
      </div>

      {/* Voice Toggle */}
      <button
        onClick={isSpeaking ? stopNarration : startNarration}
        className={`p-3 rounded-xl transition-all ${
          isSpeaking 
            ? 'bg-red-500 text-white hover:bg-red-600' 
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
        title={isSpeaking ? 'Stop Kira' : 'Replay'}
      >
        {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </div>
  );
}

export default function PubGuardScanPage() {
  const [view, setView] = useState<ViewState>('input');
  const [url, setUrl] = useState('');
  const [userType, setUserType] = useState<UserType>('writer');
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartScan = () => {
    if (!url.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }

    if (!url.includes('github.com/')) {
      setError('Please enter a valid GitHub repository URL');
      return;
    }

    setError(null);
    setView('scanning');
  };

  const handleScanComplete = (reportData: any) => {
    setReport(reportData);
    setView('report');
  };

  const handleNewScan = () => {
    setUrl('');
    setReport(null);
    setView('input');
  };

  // INPUT VIEW
  if (view === 'input') {
    return (
      <main className="min-h-screen bg-slate-950">
        {/* Top Bar - Contact & Disclaimer */}
        <div className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4 text-slate-400">
              <a href="mailto:dennis@corporateaisolutions.com" className="hover:text-white transition-colors">
                dennis@corporateaisolutions.com
              </a>
              <span className="text-slate-600">|</span>
              <a
                href="https://www.calendly.com/mcmdennis"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Book a call
              </a>
            </div>
            <span className="text-slate-500">
              Corporate AI Solutions
            </span>
          </div>
        </div>

        {/* Header with Kira */}
        <div className="bg-slate-900 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              {/* Kira Avatar */}
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 flex-shrink-0">
                <Image
                  src="/kira-avatar.jpg"
                  alt="Kira"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="font-bold text-white text-xl">PubGuard</h1>
                  <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                    by Kira
                  </span>
                </div>
                <p className="text-slate-400 text-sm">Software Security Scanner</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">
              Scan a Software Project
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Enter a GitHub repository URL and I'll run a comprehensive security assessment for you.
            </p>
          </div>

          {/* User Type Selector */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              I am a...
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {USER_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setUserType(type.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    userType === type.id
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      userType === type.id ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {type.icon}
                    </div>
                    <span className={`font-medium ${
                      userType === type.id ? 'text-white' : 'text-slate-300'
                    }`}>
                      {type.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 pl-11">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* URL Input Card */}
          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
            {/* Disclaimer */}
            <div className="mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="text-amber-500 font-medium">Disclaimer:</span> PubGuard scans are performed in good faith using automated analysis.
                Results are informational only and do not constitute professional security advice.
                Users must conduct their own due diligence before using any software.
                By using this service, you accept full responsibility for your own decisions.
                No liability is assumed for any outcomes resulting from software assessed here.
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-300 mb-2">
              GitHub Repository URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleStartScan()}
            />

            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}

            <button
              onClick={handleStartScan}
              className="w-full mt-6 py-4 bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-500/20"
            >
              <Search className="w-5 h-5" />
              Start Security Scan
            </button>

            {/* What We Check */}
            <div className="mt-8 pt-6 border-t border-slate-800">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                What I Check
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> GitHub Analysis
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> CVE Database
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Security News
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Expert Warnings
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Credential Storage
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Permission Scope
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Prompt Injection Risk
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span> Supply Chain
                </div>
              </div>
            </div>
          </div>

          {/* Corporate AI Solutions Footer */}
          <footer className="mt-12 pt-8 border-t border-slate-800">
            <div className="text-center mb-6">
              <p className="text-slate-500 text-sm mb-2">This service brought to you by</p>
              <a
                href="https://www.corporateaisolutions.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-bold text-white hover:text-red-400 transition-colors"
              >
                Corporate AI Solutions
              </a>
              <p className="text-slate-400 text-sm mt-1">
                <a
                  href="https://www.corporateaisolutions.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-red-400 transition-colors"
                >
                  www.corporateaisolutions.com
                </a>
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">
                Contact
              </h4>
              <div className="flex flex-col items-center gap-3 text-sm">
                <p className="text-white font-medium">Dennis McMahon</p>
                <div className="flex flex-wrap justify-center gap-4 text-slate-400">
                  <a
                    href="https://www.linkedin.com/in/denniskl/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <a
                    href="tel:+61402612471"
                    className="flex items-center gap-2 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    +61 402 612 471
                  </a>
                  <a
                    href="https://wa.me/61402612471"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <a
                    href="mailto:dennis@corporateaisolutions.com"
                    className="flex items-center gap-2 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                </div>
              </div>
            </div>

            <p className="text-center text-slate-600 text-xs mt-6">
              © {new Date().getFullYear()} Corporate AI Solutions. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    );
  }

  // SCANNING VIEW
  if (view === 'scanning') {
    return (
      <PubGuardScanProgress
        targetUrl={url}
        onComplete={handleScanComplete}
        onCancel={handleNewScan}
      />
    );
  }

  // REPORT VIEW WITH KIRA
  if (view === 'report' && report) {
    return (
      <main className="min-h-screen bg-slate-950">
        {/* Top Bar - Contact */}
        <div className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4 text-slate-400">
              <a href="mailto:dennis@corporateaisolutions.com" className="hover:text-white transition-colors">
                dennis@corporateaisolutions.com
              </a>
              <span className="text-slate-600">|</span>
              <a
                href="https://www.calendly.com/mcmdennis"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Book a call
              </a>
            </div>
            <span className="text-slate-500">
              Corporate AI Solutions
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleNewScan}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-slate-600">
                  <Image
                    src="/kira-avatar.jpg"
                    alt="Kira"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="font-bold text-white text-lg">PubGuard Report</h1>
                  <p className="text-slate-500 text-sm">{report.target.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl">
                  {report.trafficLight === 'green' ? '🟢' :
                   report.trafficLight === 'amber' ? '🟠' : '🔴'}
                </span>
                <span className={`text-lg font-bold uppercase ${
                  report.trafficLight === 'green' ? 'text-emerald-400' :
                  report.trafficLight === 'amber' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {report.trafficLight}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kira Narrator Bar */}
        <div className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <KiraVoiceNarrator report={report} userType={userType} autoStart={true} />
          </div>
        </div>

        {/* Report Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* User-Type Specific Report Section */}
          <UserTypeReportSection report={report} userType={userType} />

          {/* Full Technical Report */}
          <details className="mb-8">
            <summary className="cursor-pointer text-slate-400 hover:text-white transition-colors py-2 flex items-center gap-2">
              <span>📋 Full Technical Report</span>
              <span className="text-xs text-slate-500">(click to expand)</span>
            </summary>
            <div className="mt-4">
              <PubGuardReportDisplay
                report={report}
                onNewScan={handleNewScan}
              />
            </div>
          </details>

          {/* Methodology & FAQ Section */}
          <PubGuardMethodology />
        </div>
      </main>
    );
  }

  return null;
}