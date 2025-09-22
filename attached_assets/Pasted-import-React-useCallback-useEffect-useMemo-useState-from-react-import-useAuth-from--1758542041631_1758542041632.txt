import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/stores/useAuth';
import { Card } from './ui/card';
import { VideoPlayer } from './VideoPlayer';
import { ShareButton } from './ShareButton';
import { useSharing } from '../lib/stores/useSharing';
import { useServerAnalytics } from '../lib/hooks/useServerAnalytics';
import { Play, Image, Film, FileText, ArrowUpDown, Share2, BarChart3 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TransformationType = 'image' | 'video';
type TransformationStatus = 'queued' | 'processing' | 'completed' | 'failed';

type BaseOptions = {
  model?: string;
};

type ImageOptions = BaseOptions & {
  style?: string;
  persona?: string;
};

type VideoOptions = BaseOptions & {
  prompt?: string;
  imageSource?: string;
};

export interface Transformation {
  id: number;
  type: TransformationType;
  status: TransformationStatus;
  originalFileName: string;
  originalFileUrl: string;
  resultFileUrls: string[];
  transformationOptions?: ImageOptions | VideoOptions | string | null;
  createdAt: string; // ISO
  completedAt?: string; // ISO
}

export interface UserFile {
  id: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number | null;
  createdAt: string; // ISO
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function UserDashboard() {
  const { user } = useAuth();

  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'files' | 'analytics'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'type'>('date-desc');

  const { totalShares, getSharesByPlatform, getSharesByContentType } = useSharing();
  const { data: serverAnalytics, isLoading: analyticsLoading } = useServerAnalytics();

  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Prefer the user's locale when formatting dates
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-AU';
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }), [locale]);

  const formatDate = useCallback((iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return dateFormatter.format(d);
    } catch {
      return '—';
    }
  }, [dateFormatter]);

  const formatFileSize = useCallback((bytes?: number | null) => {
    if (bytes == null) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, []);

  const downloadFile = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const handleVideoPlay = useCallback((videoUrl: string) => {
    setSelectedVideo(videoUrl);
    setShowVideoPlayer(true);
  }, []);

  const fetchUserData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [transformationsRes, filesRes] = await Promise.all([
        fetch('/api/user/transformations', { credentials: 'include', signal }),
        fetch('/api/user/files', { credentials: 'include', signal })
      ]);

      if (!transformationsRes.ok && !filesRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      if (transformationsRes.ok) {
        const { transformations: t = [] } = await transformationsRes.json();
        setTransformations(Array.isArray(t) ? t : []);
      }

      if (filesRes.ok) {
        const { files: f = [] } = await filesRes.json();
        setFiles(Array.isArray(f) ? f : []);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Error fetching user data:', e);
        setError(e?.message ?? 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    fetchUserData(ctrl.signal);
    return () => ctrl.abort();
  }, [user, fetchUserData]);

  // Filter + sort transformations
  const filteredAndSortedTransformations = useMemo(() => {
    const source = activeTab === 'images'
      ? transformations.filter(t => t.type === 'image')
      : activeTab === 'videos'
        ? transformations.filter(t => t.type === 'video')
        : transformations;

    const sorted = [...source].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return sorted;
  }, [transformations, activeTab, sortBy]);

  const transformationCounts = useMemo(() => ({
    images: transformations.filter(t => t.type === 'image').length,
    videos: transformations.filter(t => t.type === 'video').length,
    total: transformations.length,
  }), [transformations]);

  if (!user) return null;

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
        <div className="p-6">
          <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
            Welcome back, {user.username}!
          </h1>
          <p className="text-gray-600">Manage your transformation history and files</p>
        </div>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <TabButton
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            icon={<FileText className="w-4 h-4 mr-2" />}
            activeClass="bg-[#c6c2e6]"
          >
            All ({transformationCounts.total})
          </TabButton>

          <TabButton
            active={activeTab === 'images'}
            onClick={() => setActiveTab('images')}
            icon={<Image className="w-4 h-4 mr-2" />}
            activeClass="bg-[#c6c2e6]"
          >
            Images ({transformationCounts.images})
          </TabButton>

          <TabButton
            active={activeTab === 'videos'}
            onClick={() => setActiveTab('videos')}
            icon={<Film className="w-4 h-4 mr-2" />}
            activeClass="bg-purple-500 text-white"
          >
            Videos ({transformationCounts.videos})
          </TabButton>

          <TabButton
            active={activeTab === 'files'}
            onClick={() => setActiveTab('files')}
            icon={<FileText className="w-4 h-4 mr-2" />}
            activeClass="bg-[#10B981] text-white"
          >
            All Files ({files.length})
          </TabButton>

          <TabButton
            active={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            icon={<BarChart3 className="w-4 h-4 mr-2" />}
            activeClass="bg-[#F59E0B] text-white"
          >
            Analytics {(serverAnalytics?.success ? serverAnalytics.analytics.totalShares : totalShares) ?? 0}
          </TabButton>
        </div>

        {/* Sort Controls */}
        {activeTab !== 'files' && activeTab !== 'analytics' && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            <label className="sr-only" htmlFor="sort-by">Sort by</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'date-asc' | 'type')}
              className="px-3 py-1 border-2 border-black rounded bg-white text-sm"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="type">By Type</option>
            </select>
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="p-6">
          <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
            <div className="p-6 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-[#c6c2e6] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-black">Loading your dashboard...</p>
            </div>
          </Card>
        </div>
      )}

      {!loading && error && (
        <Card className="border-2 border-black">
          <div className="p-6 text-center">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              className="mt-3 px-4 py-2 font-semibold border-2 border-black rounded-lg bg-white shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000]"
              onClick={() => {
                const ctrl = new AbortController();
                fetchUserData(ctrl.signal);
              }}
            >
              Retry
            </button>
          </div>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Analytics */}
          {activeTab === 'analytics' ? (
            <div className="space-y-4">
              <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-black mb-4">Sharing Analytics</h3>

                  {analyticsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-lg text-gray-600">Loading analytics...</p>
                    </div>
                  ) : ((serverAnalytics?.success ? serverAnalytics.analytics.totalShares : totalShares) ?? 0) === 0 ? (
                    <div className="text-center py-8">
                      <Share2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg text-gray-600 mb-2">No shares yet</p>
                      <p className="text-sm text-gray-500">Share your AI-generated content to see analytics here!</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Total Shares */}
                      <div className="text-center bg-[#F59E0B] text-white p-4 rounded-lg border-2 border-black">
                        <h4 className="text-3xl font-bold">
                          {(serverAnalytics?.success ? serverAnalytics.analytics.totalShares : totalShares) ?? 0}
                        </h4>
                        <p className="text-sm">Total Shares</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Platform Breakdown */}
                        <div className="bg-gray-50 p-4 rounded-lg border-2 border-black">
                          <h4 className="text-lg font-semibold text-black mb-3">By Platform</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              serverAnalytics?.success
                                ? serverAnalytics.analytics.sharesByPlatform
                                : getSharesByPlatform()
                            ).map(([platform, count]) => (
                              <div key={platform} className="flex justify-between items-center">
                                <span className="capitalize text-sm font-medium">{platform}</span>
                                <span className="bg-white px-2 py-1 rounded border border-black text-sm font-bold">
                                  {count as number}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Content Type Breakdown */}
                        <div className="bg-gray-50 p-4 rounded-lg border-2 border-black">
                          <h4 className="text-lg font-semibold text-black mb-3">By Content Type</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              serverAnalytics?.success
                                ? serverAnalytics.analytics.sharesByContentType
                                : getSharesByContentType()
                            ).map(([type, count]) => (
                              <div key={type} className="flex justify-between items-center">
                                <span className="capitalize text-sm font-medium">{type}s</span>
                                <span className="bg-white px-2 py-1 rounded border border-black text-sm font-bold">
                                  {count as number}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : activeTab !== 'files' ? (
            // Transformations list
            <div className="space-y-4">
              {filteredAndSortedTransformations.length === 0 ? (
                <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
                  <div className="p-6 text-center">
                    <p className="text-lg text-gray-600">
                      {activeTab === 'all'
                        ? 'No transformations yet'
                        : activeTab === 'images'
                          ? 'No image transformations yet'
                          : 'No video generations yet'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {activeTab === 'videos' ? 'Generate your first video!' : 'Start by uploading an image to transform!'}
                    </p>
                  </div>
                </Card>
              ) : (
                filteredAndSortedTransformations.map((t) => (
                  <Card key={t.id} className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-black">
                            {t.type === 'image' ? '🎨 Image Transformation' : '🎬 Video Generation'}
                          </h3>
                          <p className="text-sm text-gray-600">Created: {formatDate(t.createdAt)}</p>
                          {t.completedAt && (
                            <p className="text-sm text-gray-600">Completed: {formatDate(t.completedAt)}</p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium border-2 border-black ${
                            t.status === 'completed'
                              ? 'bg-[#10B981] text-white'
                              : t.status === 'processing'
                                ? 'bg-[#F59E0B] text-white'
                                : t.status === 'queued'
                                  ? 'bg-[#c6c2e6] text-black'
                                  : 'bg-red-500 text-white'
                          }`}
                          aria-label={`status ${t.status}`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Original */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-black">Original</p>
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                            <img
                              src={t.originalFileUrl}
                              alt={t.originalFileName || 'Original'}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).alt = 'Original unavailable';
                              }}
                            />
                          </div>
                          <button
                            onClick={() => downloadFile(t.originalFileUrl, t.originalFileName || `original-${t.id}`)}
                            className="w-full bg-gray-500 text-white py-1 px-2 rounded text-sm font-medium border border-black hover:bg-gray-600 transition-colors"
                          >
                            Download Original
                          </button>
                        </div>

                        {/* Results */}
                        {t.resultFileUrls?.map((url, index) => (
                          <div key={`${t.id}-${index}`} className="space-y-2">
                            <p className="text-sm font-medium text-black">
                              {t.type === 'video' ? 'Generated Video' : `Result ${index + 1}`}
                            </p>
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                              {t.type === 'video' ? (
                                <div className="relative w-full h-full">
                                  <video
                                    src={url}
                                    className="w-full h-full object-cover"
                                    poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzM3NDE1MSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPiVQbGF5IFZpZGVvJTwvdGV4dD48L3N2Zz4="
                                    preload="metadata"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Play video"
                                    onClick={() => handleVideoPlay(url)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVideoPlay(url); }}
                                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-all"
                                  >
                                    <Play className="w-12 h-12 text-white" fill="currentColor" />
                                  </button>
                                </div>
                              ) : (
                                <img
                                  src={url}
                                  alt={`Result ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).alt = 'Image unavailable';
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <ShareButton
                                contentUrl={url}
                                contentType={t.type === 'video' ? 'video' : 'image'}
                                title={`Check out my AI-${t.type === 'video' ? 'generated video' : 'transformed portrait'}!`}
                                description="Created with Portrait Studio"
                                onShare={(platform) => console.log(`Shared ${t.type} result to ${platform}`)}
                              />
                              <button
                                onClick={() => downloadFile(url, t.type === 'video' ? `video-${t.id}.mp4` : `result-${t.id}-${index + 1}.png`)}
                                className="flex-1 bg-[#10B981] text-white py-1 px-2 rounded text-sm font-medium border border-black hover:bg-[#059669] transition-colors"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Transformation Options */}
                      {t.transformationOptions && (
                        (() => {
                          try {
                            const options = typeof t.transformationOptions === 'string'
                              ? JSON.parse(t.transformationOptions)
                              : t.transformationOptions;

                            return (
                              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-black mb-2">Settings Used:</p>
                                <div className="text-xs text-gray-600 space-y-1">
                                  {t.type === 'video' ? (
                                    <>
                                      {options && (options as VideoOptions).prompt && (
                                        <p><strong>Prompt:</strong> {(options as VideoOptions).prompt}</p>
                                      )}
                                      {options && (options as VideoOptions).imageSource && (
                                        <p><strong>Image Source:</strong> {(options as VideoOptions).imageSource}</p>
                                      )}
                                      {options && (options as VideoOptions).model && (
                                        <p><strong>Model:</strong> {(options as VideoOptions).model}</p>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {options && (options as ImageOptions).style && (
                                        <p><strong>Style:</strong> {(options as ImageOptions).style}</p>
                                      )}
                                      {options && (options as ImageOptions).persona && (
                                        <p><strong>Persona:</strong> {(options as ImageOptions).persona}</p>
                                      )}
                                      {options && (options as ImageOptions).model && (
                                        <p><strong>Model:</strong> {(options as ImageOptions).model}</p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          } catch (err) {
                            console.error('Error parsing transformation options:', err);
                            return null;
                          }
                        })()
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            // Files table
            <div className="space-y-4">
              {files.length === 0 ? (
                <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
                  <div className="p-6 text-center">
                    <p className="text-lg text-gray-600">No files yet</p>
                    <p className="text-sm text-gray-500 mt-2">Files will appear here when you create transformations!</p>
                  </div>
                </Card>
              ) : (
                <Card className="shadow-[8px_8px_0px_0px_#10B981] border-2 border-black">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-black mb-4">All Your Files</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-black">
                            <th className="text-left py-2 font-semibold">File Name</th>
                            <th className="text-left py-2 font-semibold">Type</th>
                            <th className="text-left py-2 font-semibold">Size</th>
                            <th className="text-left py-2 font-semibold">Created</th>
                            <th className="text-left py-2 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((f) => (
                            <tr key={f.id} className="border-b border-gray-200">
                              <td className="py-2">{f.originalFileName}</td>
                              <td className="py-2">{f.fileType}</td>
                              <td className="py-2">{formatFileSize(f.fileSize)}</td>
                              <td className="py-2">{formatDate(f.createdAt)}</td>
                              <td className="py-2">
                                <button
                                  onClick={() => downloadFile(f.fileUrl, f.originalFileName)}
                                  className="bg-[#10B981] text-white px-3 py-1 rounded text-xs font-medium border border-black hover:bg-[#059669] transition-colors"
                                >
                                  Download
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Video Player Modal */}
      <VideoPlayer
        videoUrl={selectedVideo}
        isVisible={showVideoPlayer}
        onClose={() => setShowVideoPlayer(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  activeClass?: string;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon, activeClass, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ` +
        (active
          ? `${activeClass ?? 'bg-[#c6c2e6] text-black'} shadow-[4px_4px_0px_0px_#000000]`
          : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]')
      }
    >
      {icon}
      {children}
    </button>
  );
}
