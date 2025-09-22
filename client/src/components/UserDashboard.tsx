import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/stores/useAuth';
import { Card } from './ui/card';
import { VideoPlayer } from './VideoPlayer';
import { Play, Image, Film, FileText, Calendar, ArrowUpDown } from 'lucide-react';

interface Transformation {
  id: number;
  type: string;
  status: string;
  originalFileName: string;
  originalFileUrl: string;
  resultFileUrls: string[];
  transformationOptions: any;
  createdAt: string;
  completedAt?: string;
}

interface UserFile {
  id: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  createdAt: string;
}

export function UserDashboard() {
  const { user } = useAuth();
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'files'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'type'>('date-desc');
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch transformations
      const transformationsResponse = await fetch('/api/user/transformations', {
        credentials: 'include'
      });
      
      if (transformationsResponse.ok) {
        const transformationsData = await transformationsResponse.json();
        setTransformations(transformationsData.transformations || []);
      }

      // Fetch files
      const filesResponse = await fetch('/api/user/files', {
        credentials: 'include'
      });
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setFiles(filesData.files || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleVideoPlay = (videoUrl: string) => {
    setSelectedVideo(videoUrl);
    setShowVideoPlayer(true);
  };

  // Filter and sort transformations
  const filteredAndSortedTransformations = useMemo(() => {
    let filtered = transformations;
    
    // Filter by category
    if (activeTab === 'images') {
      filtered = transformations.filter(t => t.type === 'image');
    } else if (activeTab === 'videos') {
      filtered = transformations.filter(t => t.type === 'video');
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'date-asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'type') {
        return a.type.localeCompare(b.type);
      }
      return 0;
    });
    
    return sorted;
  }, [transformations, activeTab, sortBy]);

  // Count transformations by type
  const transformationCounts = useMemo(() => {
    const images = transformations.filter(t => t.type === 'image').length;
    const videos = transformations.filter(t => t.type === 'video').length;
    return { images, videos, total: transformations.length };
  }, [transformations]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
          <div className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#c6c2e6] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-black">Loading your dashboard...</p>
          </div>
        </Card>
      </div>
    );
  }

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
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ${
              activeTab === 'all'
                ? 'bg-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
                : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            All ({transformationCounts.total})
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ${
              activeTab === 'images'
                ? 'bg-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
                : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <Image className="w-4 h-4 mr-2" />
            Images ({transformationCounts.images})
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ${
              activeTab === 'videos'
                ? 'bg-purple-500 text-white shadow-[4px_4px_0px_0px_#000000]'
                : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <Film className="w-4 h-4 mr-2" />
            Videos ({transformationCounts.videos})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ${
              activeTab === 'files'
                ? 'bg-[#10B981] text-white shadow-[4px_4px_0px_0px_#000000]'
                : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            All Files ({files.length})
          </button>
        </div>

        {/* Sort Controls */}
        {activeTab !== 'files' && (
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            <select
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

      {/* Content */}
      {activeTab !== 'files' && (
        <div className="space-y-4">
          {filteredAndSortedTransformations.length === 0 ? (
            <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <div className="p-6 text-center">
                <p className="text-lg text-gray-600">
                  {activeTab === 'all' ? 'No transformations yet' : 
                   activeTab === 'images' ? 'No image transformations yet' : 
                   'No video generations yet'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {activeTab === 'videos' ? 'Generate your first video!' : 'Start by uploading an image to transform!'}
                </p>
              </div>
            </Card>
          ) : (
            filteredAndSortedTransformations.map((transformation) => (
              <Card key={transformation.id} className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-black">
                        {transformation.type === 'image' ? '🎨 Image Transformation' : '🎬 Video Generation'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Created: {formatDate(transformation.createdAt)}
                      </p>
                      {transformation.completedAt && (
                        <p className="text-sm text-gray-600">
                          Completed: {formatDate(transformation.completedAt)}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border-2 border-black ${
                      transformation.status === 'completed' 
                        ? 'bg-[#10B981] text-white'
                        : transformation.status === 'processing'
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-red-500 text-white'
                    }`}>
                      {transformation.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Original Image */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-black">Original</p>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={transformation.originalFileUrl} 
                          alt="Original" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => downloadFile(transformation.originalFileUrl, transformation.originalFileName)}
                        className="w-full bg-gray-500 text-white py-1 px-2 rounded text-sm font-medium border border-black hover:bg-gray-600 transition-colors"
                      >
                        Download Original
                      </button>
                    </div>

                    {/* Result Content */}
                    {transformation.resultFileUrls?.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <p className="text-sm font-medium text-black">
                          {transformation.type === 'video' ? 'Generated Video' : `Result ${index + 1}`}
                        </p>
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                          {transformation.type === 'video' ? (
                            <div className="relative w-full h-full">
                              <video 
                                src={url}
                                className="w-full h-full object-cover"
                                poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzM3NDE1MSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPiVQbGF5IFZpZGVvJTwvdGV4dD48L3N2Zz4="
                                preload="metadata"
                              />
                              <button
                                onClick={() => handleVideoPlay(url)}
                                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all"
                              >
                                <Play className="w-12 h-12 text-white" fill="currentColor" />
                              </button>
                            </div>
                          ) : (
                            <img 
                              src={url} 
                              alt={`Result ${index + 1}`} 
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <button
                          onClick={() => downloadFile(url, transformation.type === 'video' 
                            ? `video-${transformation.id}.mp4` 
                            : `result-${transformation.id}-${index + 1}.png`)}
                          className="w-full bg-[#10B981] text-white py-1 px-2 rounded text-sm font-medium border border-black hover:bg-[#059669] transition-colors"
                        >
                          Download {transformation.type === 'video' ? 'Video' : 'Image'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Transformation Options */}
                  {transformation.transformationOptions && (() => {
                    try {
                      const options = typeof transformation.transformationOptions === 'string' 
                        ? JSON.parse(transformation.transformationOptions)
                        : transformation.transformationOptions;
                      
                      return (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm font-medium text-black mb-2">Settings Used:</p>
                          <div className="text-xs text-gray-600 space-y-1">
                            {transformation.type === 'video' ? (
                              <>
                                {options.prompt && (
                                  <p><strong>Prompt:</strong> {options.prompt}</p>
                                )}
                                {options.imageSource && (
                                  <p><strong>Image Source:</strong> {options.imageSource}</p>
                                )}
                                {options.model && (
                                  <p><strong>Model:</strong> {options.model}</p>
                                )}
                              </>
                            ) : (
                              <>
                                {options.style && (
                                  <p><strong>Style:</strong> {options.style}</p>
                                )}
                                {options.persona && (
                                  <p><strong>Persona:</strong> {options.persona}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    } catch (error) {
                      console.error('Error parsing transformation options:', error);
                      return null;
                    }
                  })()}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'files' && (
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
                      {files.map((file) => (
                        <tr key={file.id} className="border-b border-gray-200">
                          <td className="py-2">{file.originalFileName}</td>
                          <td className="py-2">{file.fileType}</td>
                          <td className="py-2">{formatFileSize(file.fileSize)}</td>
                          <td className="py-2">{formatDate(file.createdAt)}</td>
                          <td className="py-2">
                            <button
                              onClick={() => downloadFile(file.fileUrl, file.originalFileName)}
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

      {/* Video Player Modal */}
      <VideoPlayer
        videoUrl={selectedVideo}
        isVisible={showVideoPlayer}
        onClose={() => setShowVideoPlayer(false)}
      />
    </div>
  );
}