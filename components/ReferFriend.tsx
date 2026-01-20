// components/ReferFriend.tsx
'use client';

import { useState } from 'react';
import { X, Gift, Send, Check } from 'lucide-react';

interface ReferFriendProps {
  userId?: string;  // To track who referred
  className?: string;
}

export default function ReferFriend({ userId, className = '' }: ReferFriendProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    yourName: '',
    yourEmail: '',
    friendEmail: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/refer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          referrerId: userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send referral');
      }

      setStatus('sent');

      // Reset after 3 seconds
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
        setFormData({ yourName: '', yourEmail: '', friendEmail: '' });
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <>
      {/* Trigger Button - subtle but visible */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 text-sm text-gray-500 hover:text-kira-coral transition-colors ${className}`}
      >
        <Gift className="w-4 h-4" />
        <span>Know someone who'd love Kira? Share the link</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          {/* Modal Content */}
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {status === 'sent' ? (
              /* Success State */
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Invite sent! 🎉
                </h3>
                <p className="text-gray-600">
                  Your friend will receive an email from you shortly.
                </p>
              </div>
            ) : (
              /* Form State */
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-kira-coral/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Gift className="w-6 h-6 text-kira-coral" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    Share Kira with a friend
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Think a friend could use a helpful guide? Send them an invite from you.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="yourName" className="block text-sm font-medium text-gray-700 mb-1">
                      Your name
                    </label>
                    <input
                      type="text"
                      id="yourName"
                      required
                      value={formData.yourName}
                      onChange={(e) => setFormData(prev => ({ ...prev, yourName: e.target.value }))}
                      placeholder="Dennis"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-kira-coral/50 focus:border-kira-coral transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="yourEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Your email
                    </label>
                    <input
                      type="email"
                      id="yourEmail"
                      required
                      value={formData.yourEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, yourEmail: e.target.value }))}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-kira-coral/50 focus:border-kira-coral transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="friendEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Friend's email
                    </label>
                    <input
                      type="email"
                      id="friendEmail"
                      required
                      value={formData.friendEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, friendEmail: e.target.value }))}
                      placeholder="friend@example.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-kira-coral/50 focus:border-kira-coral transition"
                    />
                  </div>

                  {status === 'error' && (
                    <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full bg-kira-coral text-white py-3 rounded-lg font-medium hover:bg-opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {status === 'sending' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Invite
                      </>
                    )}
                  </button>
                </form>

                <p className="text-xs text-gray-400 text-center mt-4">
                  We'll send them one friendly email. No spam, ever.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}