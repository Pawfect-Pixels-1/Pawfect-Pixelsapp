import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/stores/useAuth';
import { Card } from './ui/card';

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
  const [activeTab, setActiveTab] = useState<'transformations' | 'files'>('transformations');

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
      <div className="flex space-x-4">
        <button
          onClick={() => setActiveTab('transformations')}
          className={`px-6 py-2 font-semibold border-2 border-black rounded-lg transition-all ${
            activeTab === 'transformations'
              ? 'bg-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
              : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
          }`}
        >
          Transformations ({transformations.length})
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-6 py-2 font-semibold border-2 border-black rounded-lg transition-all ${
            activeTab === 'files'
              ? 'bg-[#10B981] text-white shadow-[4px_4px_0px_0px_#000000]'
              : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
          }`}
        >
          All Files ({files.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transformations' && (
        <div className="space-y-4">
          {transformations.length === 0 ? (
            <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <div className="p-6 text-center">
                <p className="text-lg text-gray-600">No transformations yet</p>
                <p className="text-sm text-gray-500 mt-2">Start by uploading an image to transform!</p>
              </div>
            </Card>
          ) : (
            transformations.map((transformation) => (
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

                    {/* Result Images */}
                    {transformation.resultFileUrls?.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <p className="text-sm font-medium text-black">Result {index + 1}</p>
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                          <img 
                            src={url} 
                            alt={`Result ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => downloadFile(url, `result-${transformation.id}-${index + 1}.png`)}
                          className="w-full bg-[#10B981] text-white py-1 px-2 rounded text-sm font-medium border border-black hover:bg-[#059669] transition-colors"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Transformation Options */}
                  {transformation.transformationOptions && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-black mb-2">Settings Used:</p>
                      <div className="text-xs text-gray-600 space-y-1">
                        {JSON.parse(transformation.transformationOptions).style && (
                          <p><strong>Style:</strong> {JSON.parse(transformation.transformationOptions).style}</p>
                        )}
                        {JSON.parse(transformation.transformationOptions).persona && (
                          <p><strong>Persona:</strong> {JSON.parse(transformation.transformationOptions).persona}</p>
                        )}
                      </div>
                    </div>
                  )}
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
    </div>
  );
}