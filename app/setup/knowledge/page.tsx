// app/setup/knowledge/page.tsx
// Knowledge Upload Page - Upload files and URLs to Kira's knowledge base
// Files go to ElevenLabs knowledge base and are attached to the agent

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
  documentId?: string; // ElevenLabs document ID
  error?: string;
}

interface AddedUrl {
  id: string;
  url: string;
  title?: string;
  status: 'pending' | 'crawling' | 'complete' | 'error';
  documentId?: string; // ElevenLabs document ID
  error?: string;
}

function KnowledgeUploadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const agentId = searchParams.get('agentId'); // ElevenLabs agent ID to attach knowledge to
  const userId = searchParams.get('userId');
  const journey = searchParams.get('journey') as 'personal' | 'business' || 'personal';

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [urls, setUrls] = useState<AddedUrl[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accepted file types for ElevenLabs
  const acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
  ].join(',');

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

  const handleFiles = async (newFiles: File[]) => {
    // Create file entries with uploading status
    const fileEntries: UploadedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...fileEntries]);

    // Upload each file
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const fileEntry = fileEntries[i];

      await uploadFile(file, fileEntry.id);
    }
  };

  const uploadFile = async (file: File, fileId: string) => {
    try {
      // Update progress
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress: 30 } : f
      ));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      if (agentId) formData.append('agentId', agentId);
      if (userId) formData.append('userId', userId);

      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, progress: 60 } : f
      ));

      const response = await fetch('/api/kira/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      setFiles(prev => prev.map(f =>
        f.id === fileId ? {
          ...f,
          status: 'complete' as const,
          progress: 100,
          documentId: data.documentId,
        } : f
      ));

    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f =>
        f.id === fileId ? {
          ...f,
          status: 'error' as const,
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed',
        } : f
      ));
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addUrl = async () => {
    if (!urlInput.trim()) return;

    // Basic URL validation
    let url = urlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlEntry: AddedUrl = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: 'pending',
    };

    setUrls(prev => [...prev, urlEntry]);
    setUrlInput('');

    // Upload URL to ElevenLabs
    try {
      setUrls(prev => prev.map(u =>
        u.id === urlEntry.id ? { ...u, status: 'crawling' as const } : u
      ));

      const response = await fetch('/api/kira/knowledge/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          agentId,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add URL');
      }

      const data = await response.json();

      setUrls(prev => prev.map(u =>
        u.id === urlEntry.id ? {
          ...u,
          status: 'complete' as const,
          title: data.documentName || 'Page loaded',
          documentId: data.documentId,
        } : u
      ));

    } catch (error) {
      console.error('URL add error:', error);
      setUrls(prev => prev.map(u =>
        u.id === urlEntry.id ? {
          ...u,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Failed to add URL',
        } : u
      ));
    }
  };

  const removeUrl = (urlId: string) => {
    setUrls(prev => prev.filter(u => u.id !== urlId));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      // If we have an agentId, knowledge is already attached
      // Just redirect to chat
      if (agentId) {
        router.push(`/chat/${agentId}`);
        return;
      }

      // Otherwise, this might be a setup flow - redirect back or to start
      router.push('/start');

    } catch (error) {
      console.error('Submit error:', error);
      setGlobalError(error instanceof Error ? error.message : 'Something went wrong');
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

  const completedFiles = files.filter(f => f.status === 'complete').length;
  const completedUrls = urls.filter(u => u.status === 'complete').length;
  const hasErrors = files.some(f => f.status === 'error') || urls.some(u => u.status === 'error');
  const isUploading = files.some(f => f.status === 'uploading') || urls.some(u => u.status === 'crawling' || u.status === 'pending');

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 100% 100%, rgba(244, 114, 182, 0.06) 0%, transparent 50%)
          `
        }}
      />

      <div className="relative max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400/50 mx-auto mb-4">
            <img src="/kira-avatar.jpg" alt="Kira" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Add Knowledge
          </h1>
          <p className="font-body text-stone-400">
            Upload documents and links to help Kira understand your {journey === 'business' ? 'business' : 'goals'} better
          </p>
        </div>

        {/* Global Error */}
        {globalError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
            {globalError}
          </div>
        )}

        <div className="space-y-6">
          {/* File Upload */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6">
            <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📁</span> Upload Documents
            </h3>

            {/* Drop zone */}
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
                accept={acceptedTypes}
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-4xl mb-3">📤</div>
              <p className="font-body text-stone-300 mb-1">
                Drop files here or click to upload
              </p>
              <p className="font-body text-stone-500 text-sm">
                PDF, Word, TXT, Markdown, CSV (max 25MB each)
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${
                      file.status === 'error' ? 'bg-red-500/10' : 'bg-stone-800/50'
                    }`}
                  >
                    <span className="text-xl">{getFileIcon(file.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-stone-200 truncate">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-body text-xs text-stone-500">{formatFileSize(file.size)}</p>
                        {file.status === 'uploading' && (
                          <div className="flex-1 h-1 bg-stone-700 rounded-full overflow-hidden max-w-32">
                            <div
                              className="h-full bg-amber-400 transition-all duration-200"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        )}
                        {file.status === 'complete' && (
                          <span className="text-green-400 text-xs">✓ Uploaded</span>
                        )}
                        {file.status === 'error' && (
                          <span className="text-red-400 text-xs">⚠️ {file.error || 'Failed'}</span>
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
                placeholder="https://example.com/docs"
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
              Add websites, documentation, or help center pages
            </p>

            {/* URL List */}
            {urls.length > 0 && (
              <div className="mt-4 space-y-2">
                {urls.map(urlEntry => (
                  <div
                    key={urlEntry.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${
                      urlEntry.status === 'error' ? 'bg-red-500/10' : 'bg-stone-800/50'
                    }`}
                  >
                    <span className="text-xl">🌐</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-stone-200 truncate">{urlEntry.url}</p>
                      <p className="font-body text-xs text-stone-500">
                        {urlEntry.status === 'pending' && 'Waiting...'}
                        {urlEntry.status === 'crawling' && (
                          <span className="flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading content...
                          </span>
                        )}
                        {urlEntry.status === 'complete' && <span className="text-green-400">✓ Added</span>}
                        {urlEntry.status === 'error' && <span className="text-red-400">⚠️ {urlEntry.error || 'Failed'}</span>}
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
                ? "Any specific instructions or context Kira should know about your business..."
                : "Any additional context about your goals or preferences..."
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
                {agentId ? 'Ready to continue?' : 'Knowledge Summary'}
              </h3>
              <p className="font-body text-stone-400 text-sm">
                {completedFiles} file{completedFiles !== 1 ? 's' : ''} • {completedUrls} URL{completedUrls !== 1 ? 's' : ''}
                {hasErrors && ' • Some items failed'}
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
              disabled={isSubmitting || isUploading}
              className={`flex-1 px-8 py-4 rounded-full font-display font-bold text-lg transition-all ${
                isSubmitting || isUploading
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
                  Processing...
                </span>
              ) : isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </span>
              ) : agentId ? (
                <span className="flex items-center justify-center gap-2">
                  Continue to Chat
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              ) : (
                'Done'
              )}
            </button>
          </div>

          {(completedFiles === 0 && completedUrls === 0) && (
            <p className="text-center font-body text-stone-500 text-sm mt-4">
              You can skip this step and add knowledge later
            </p>
          )}
        </div>

        {/* Skip Option */}
        {agentId && (
          <div className="text-center mt-6">
            <button
              onClick={() => router.push(`/chat/${agentId}`)}
              disabled={isSubmitting}
              className="font-body text-stone-500 hover:text-stone-300 text-sm transition-colors"
            >
              Skip for now — I'll add knowledge later
            </button>
          </div>
        )}
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

// Loading fallback
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

export default function KnowledgeUploadPage() {
  return (
    <Suspense fallback={<KnowledgeUploadLoading />}>
      <KnowledgeUploadContent />
    </Suspense>
  );
}