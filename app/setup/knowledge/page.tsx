"use client";

import React, { useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'complete' | 'error';
  progress: number;
}

interface AddedUrl {
  id: string;
  url: string;
  title?: string;
  status: 'pending' | 'crawling' | 'complete' | 'error';
}

function KnowledgeUploadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const journey = searchParams.get('journey') as 'personal' | 'business' || 'personal';
  const sessionId = searchParams.get('session'); // From Setup Kira conversation

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [urls, setUrls] = useState<AddedUrl[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accepted file types
  const acceptedTypes = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/csv': '.csv',
    'image/png': '.png',
    'image/jpeg': '.jpg,.jpeg',
    'image/webp': '.webp',
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  }, []);

  const handleFiles = (newFiles: File[]) => {
    const fileEntries: UploadedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...fileEntries]);

    // Simulate upload progress
    fileEntries.forEach(fileEntry => {
      simulateUpload(fileEntry.id);
    });
  };

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, status: 'complete' as const, progress: 100 } : f
        ));
      } else {
        setFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, progress } : f
        ));
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;

    // Basic URL validation
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const newUrl: AddedUrl = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: 'pending',
    };

    setUrls(prev => [...prev, newUrl]);
    setUrlInput('');

    // Simulate URL crawling
    setTimeout(() => {
      setUrls(prev => prev.map(u =>
        u.id === newUrl.id ? { ...u, status: 'crawling' as const } : u
      ));

      setTimeout(() => {
        setUrls(prev => prev.map(u =>
          u.id === newUrl.id ? {
            ...u,
            status: 'complete' as const,
            title: 'Page content loaded'
          } : u
        ));
      }, 1500);
    }, 500);
  };

  const removeUrl = (urlId: string) => {
    setUrls(prev => prev.filter(u => u.id !== urlId));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Submit knowledge base to API
      const response = await fetch('/api/kira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          journey,
          knowledge: {
            files: files.filter(f => f.status === 'complete').map(f => ({
              name: f.name,
              type: f.type,
              size: f.size,
            })),
            urls: urls.filter(u => u.status === 'complete').map(u => u.url),
            notes,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Kira');
      }

      const { agentId } = await response.json();

      // Redirect to chat with new Kira
      router.push(`/chat/${agentId}`);
    } catch (error) {
      console.error('Failed to create Kira:', error);
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('csv')) return '📊';
    if (type.includes('image')) return '🖼️';
    if (type.includes('text') || type.includes('markdown')) return '📃';
    return '📎';
  };

  const totalFiles = files.length;
  const totalUrls = urls.length;
  const isReady = files.every(f => f.status === 'complete') && urls.every(u => u.status === 'complete');

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        .gradient-radial {
          background: 
            radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(244, 114, 182, 0.06) 0%, transparent 50%);
        }
      `}</style>

      <div className="absolute inset-0 gradient-radial" />

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400/50">
              <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <h1 className="font-display text-xl font-bold text-white">Almost there!</h1>
              <p className="font-body text-stone-400 text-sm">
                {journey === 'business' ? 'Business Knowledge Base' : 'Personal Knowledge Base'}
              </p>
            </div>
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            Give Kira some knowledge
          </h2>
          <p className="font-body text-stone-400 text-lg max-w-2xl mx-auto">
            {journey === 'business'
              ? "Upload documents, SOPs, FAQs, or any content you want your Kira to know. Add URLs to websites or help centers."
              : "Share any documents, notes, or links that will help Kira understand your goals and context better."
            }
          </p>
        </div>

        {/* Upload Section */}
        <div className="space-y-6">
          {/* File Upload */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📁</span> Upload Files
            </h3>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-amber-400 bg-amber-400/10' 
                  : 'border-stone-700 hover:border-stone-600 hover:bg-stone-800/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={Object.values(acceptedTypes).join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-stone-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <p className="font-body text-stone-300 mb-2">
                {isDragging ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="font-body text-stone-500 text-sm">
                or click to browse
              </p>
              <p className="font-body text-stone-600 text-xs mt-3">
                PDF, Word, Excel, Images, Text, Markdown, CSV
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 bg-stone-800/50 rounded-xl p-3"
                  >
                    <span className="text-xl">{getFileIcon(file.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-stone-200 truncate">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-body text-xs text-stone-500">{formatFileSize(file.size)}</p>
                        {file.status === 'uploading' && (
                          <div className="flex-1 h-1 bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 transition-all duration-200"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                        {file.status === 'complete' && (
                          <span className="text-green-400 text-xs">✓ Ready</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-stone-500 hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* URL Input */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>🔗</span> Add URLs
            </h3>

            <div className="flex gap-3">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                placeholder="https://example.com/help-center"
                className="flex-1 bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 font-body text-white placeholder-stone-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={addUrl}
                disabled={!urlInput.trim()}
                className="px-6 py-3 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed border border-stone-700 rounded-xl font-body text-white transition-colors"
              >
                Add
              </button>
            </div>

            <p className="font-body text-stone-500 text-xs mt-2">
              Add websites, documentation, help centers, or Google Docs links
            </p>

            {/* URL List */}
            {urls.length > 0 && (
              <div className="mt-4 space-y-2">
                {urls.map(urlEntry => (
                  <div
                    key={urlEntry.id}
                    className="flex items-center gap-3 bg-stone-800/50 rounded-xl p-3"
                  >
                    <span className="text-xl">🌐</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-stone-200 truncate">{urlEntry.url}</p>
                      <p className="font-body text-xs text-stone-500">
                        {urlEntry.status === 'pending' && 'Waiting...'}
                        {urlEntry.status === 'crawling' && 'Loading content...'}
                        {urlEntry.status === 'complete' && '✓ Ready'}
                        {urlEntry.status === 'error' && '⚠️ Failed to load'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeUrl(urlEntry.id)}
                      className="text-stone-500 hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📝</span> Additional Context
              <span className="text-stone-500 text-sm font-normal">(optional)</span>
            </h3>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={journey === 'business'
                ? "Any specific instructions, tone preferences, or context Kira should know about your business..."
                : "Any additional context about your goals, preferences, or situation..."
              }
              rows={4}
              className="w-full bg-stone-800/50 border border-stone-700 rounded-xl px-4 py-3 font-body text-white placeholder-stone-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="mt-8 bg-gradient-to-br from-stone-900 to-stone-900/80 border border-stone-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-white mb-1">
                Ready to create your Kira?
              </h3>
              <p className="font-body text-stone-400 text-sm">
                {totalFiles} file{totalFiles !== 1 ? 's' : ''} • {totalUrls} URL{totalUrls !== 1 ? 's' : ''}
                {notes && ' • Notes added'}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="px-6 py-4 rounded-full font-display font-bold bg-stone-800 text-white border border-stone-700 transition-all hover:bg-stone-700"
            >
              Back
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isReady}
              className={`flex-1 px-8 py-4 rounded-full font-display font-bold text-lg transition-all ${
                isSubmitting || !isReady
                  ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-stone-900 hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating your Kira...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Create My Kira
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              )}
            </button>
          </div>

          {(totalFiles === 0 && totalUrls === 0) && (
            <p className="text-center font-body text-stone-500 text-sm mt-4">
              You can skip this step and add knowledge later
            </p>
          )}
        </div>

        {/* Skip Option */}
        <div className="text-center mt-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="font-body text-stone-500 hover:text-stone-300 text-sm transition-colors"
          >
            Skip for now — I'll add knowledge later
          </button>
        </div>
      </div>

      {/* Back to home */}
      <a
        href="/"
        className="fixed top-6 left-6 font-body text-stone-500 hover:text-stone-300 text-sm transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to home
      </a>
    </div>
  );
}

// Loading fallback component
function KnowledgeUploadLoading() {
  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400/50 mx-auto mb-4">
          <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
        </div>
        <div className="animate-pulse text-stone-400">Loading...</div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function KnowledgeUploadPage() {
  return (
    <Suspense fallback={<KnowledgeUploadLoading />}>
      <KnowledgeUploadContent />
    </Suspense>
  );
}