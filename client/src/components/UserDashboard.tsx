import React, { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { useAuth } from '../lib/stores/useAuth';

interface Transformation {
  id: number;
  type: 'image' | 'video';
  status: string;
  originalFileName: string;
  originalFileUrl: string;
  resultFileUrls: string[];
  transformationOptions: any;
  createdAt: string;
  completedAt: string | null;
}

interface UserFile {
  id: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string;
}

export function UserDashboard() {
  const { user } = useAuth();
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transformations' | 'files'>('transformations');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [transformationsRes, filesRes] = await Promise.all([
          fetch('/api/user/transformations', { credentials: 'include' }),
          fetch('/api/user/files', { credentials: 'include' })
        ]);

        if (transformationsRes.ok) {
          const transformationsData = await transformationsRes.json();
          setTransformations(transformationsData.transformations || []);
        }

        if (filesRes.ok) {
          const filesData = await filesRes.json();
          setFiles(filesData.files || []);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchUserData();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading your data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
          Welcome back, {user.username}!
        </h1>
        <p className="text-gray-600">Manage your transformations and files</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg border-2 border-black">
        <button
          onClick={() => setActiveTab('transformations')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
            activeTab === 'transformations'
              ? 'bg-white text-black shadow-[2px_2px_0px_0px_#000000] border border-black'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          Transformations ({transformations.length})
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2 px-4 rounded-md font-semibold transition-colors ${
            activeTab === 'files'
              ? 'bg-white text-black shadow-[2px_2px_0px_0px_#000000] border border-black'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          Files ({files.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transformations' ? (
        <div className="space-y-4">
          {transformations.length === 0 ? (
            <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold text-black mb-2">No transformations yet</h3>
                <p className="text-gray-600">Start creating amazing portraits to see them here!</p>
              </div>
            </Card>
          ) : (
            transformations.map((transformation) => (
              <Card key={transformation.id} className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-black capitalize">
                        {transformation.type} Transformation
                      </h3>
                      <p className="text-sm text-gray-600">
                        {new Date(transformation.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 border-black ${
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
                      <h4 className="font-medium text-black">Original</h4>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={transformation.originalFileUrl} 
                          alt="Original" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 truncate">{transformation.originalFileName}</p>
                    </div>

                    {/* Result Images */}
                    {transformation.resultFileUrls.map((url, index) => (
                      <div key={index} className="space-y-2">
                        <h4 className="font-medium text-black">Result {index + 1}</h4>
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                          <img 
                            src={url} 
                            alt={`Result ${index + 1}`} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                            }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `result_${transformation.id}_${index + 1}.${transformation.type === 'video' ? 'mp4' : 'png'}`;
                            link.click();
                          }}
                          className="w-full bg-[#10B981] text-white py-1 px-2 rounded text-xs font-semibold border border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Transformation Options */}
                  {transformation.transformationOptions && (
                    <div className="mt-4 pt-4 border-t-2 border-gray-200">
                      <h4 className="font-medium text-black mb-2">Settings Used</h4>
                      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                        {typeof transformation.transformationOptions === 'string' 
                          ? JSON.stringify(JSON.parse(transformation.transformationOptions), null, 2)
                          : JSON.stringify(transformation.transformationOptions, null, 2)
                        }
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {files.length === 0 ? (
            <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">📁</div>
                <h3 className="text-xl font-semibold text-black mb-2">No files yet</h3>
                <p className="text-gray-600">Upload and transform images to see your files here!</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <Card key={file.id} className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
                  <div className="p-4">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black mb-3">
                      {file.fileType.startsWith('image/') ? (
                        <img 
                          src={file.fileUrl} 
                          alt={file.originalFileName} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                          }}
                        />
                      ) : file.fileType.startsWith('video/') ? (
                        <video 
                          src={file.fileUrl} 
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <div className="text-center">
                            <div className="text-2xl mb-2">📄</div>
                            <p className="text-xs text-gray-600">File</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold text-black text-sm truncate" title={file.originalFileName}>
                        {file.originalFileName}
                      </h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Type: {file.fileType}</p>
                        {file.fileSize && (
                          <p>Size: {(file.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                        )}
                        <p>Created: {new Date(file.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = file.fileUrl;
                          link.download = file.originalFileName;
                          link.click();
                        }}
                        className="w-full bg-[#F59E0B] text-white py-2 px-3 rounded text-xs font-semibold border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}