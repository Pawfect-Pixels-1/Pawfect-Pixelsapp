import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UploadZone from "./components/UploadZone";
import PreviewGrid from "./components/PreviewGrid";
import TransformationControls from "./components/TransformationControls";
import { UserHeader } from "./components/UserHeader";
import { UserDashboard } from "./components/UserDashboard";
import WelcomePage from "./components/WelcomePage";
import { useTransformation } from "./lib/stores/useTransformation";
import { useAuth } from "./lib/stores/useAuth";
import { Card } from "./components/ui/card";
import "@fontsource/inter";

const queryClient = new QueryClient();

function AppContent() {
  const { user, isLoading } = useAuth();
  const { 
    uploadedImage, 
    transformedImage, 
    generatedVideo, 
    isProcessing, 
    currentOperation 
  } = useTransformation();
  const [currentView, setCurrentView] = useState<'studio' | 'dashboard'>('studio');

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fffdf5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#c6c2e6] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-black">Loading...</p>
        </div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!user) {
    return <WelcomePage />;
  }

  // Show dashboard view for authenticated users
  if (currentView === 'dashboard') {
    return (
      <div className="min-h-screen bg-[#fffdf5]">
        <div className="max-w-7xl mx-auto">
          {/* Header with navigation */}
          <div className="p-4">
            <UserHeader />
            <div className="flex justify-center mt-4 space-x-4">
              <button
                onClick={() => setCurrentView('studio')}
                className="bg-white text-black py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                🎨 Studio
              </button>
              <button
                onClick={() => setCurrentView('dashboard')}
                className="bg-[#c6c2e6] text-black py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000]"
              >
                📊 Dashboard
              </button>
            </div>
          </div>
          <UserDashboard />
        </div>
      </div>
    );
  }

  // Show studio view for authenticated users (main transformation interface)
  return (
    <div className="min-h-screen bg-[#fffdf5] p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header with navigation */}
        <UserHeader />
        <div className="flex justify-center mt-4 mb-6 space-x-4">
          <button
            onClick={() => setCurrentView('studio')}
            className="bg-[#6c8b3a] text-white py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000]"
          >
            🎨 Studio
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="bg-white text-black py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            📊 Dashboard
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Zone */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
              <UploadZone />
            </Card>
          </div>

          {/* Transformation Controls */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#6c8b3a] border-2 border-black">
              <TransformationControls />
            </Card>
          </div>

          {/* Preview Grid */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <PreviewGrid />
            </Card>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-6">
            <Card className="shadow-[8px_8px_0px_0px_#10B981] border-2 border-black bg-white">
              <div className="p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-lg font-semibold text-black">
                  {currentOperation === 'transform' ? 'Transforming portrait...' : 'Generating video...'}
                </p>
                <p className="text-gray-600 mt-2">
                  This may take a few moments
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Results Grid - Full Width when results are available */}
        {(transformedImage || generatedVideo) && (
          <div className="mt-6">
            <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
              <div className="p-6">
                <h2 className="font-title text-2xl font-bold text-black mb-4">
                  Results
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  {/* Original */}
                  {uploadedImage && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-black">Original</h3>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={uploadedImage} 
                          alt="Original" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {/* Transformed */}
                  {transformedImage && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-black">Transformed</h3>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={transformedImage} 
                          alt="Transformed" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = transformedImage;
                          link.download = 'transformed-portrait.png';
                          link.click();
                        }}
                        className="w-full bg-[#10B981] text-white py-2 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        Download Image
                      </button>
                    </div>
                  )}

                  {/* Video */}
                  {generatedVideo && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-black">Generated Video</h3>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <video 
                          src={generatedVideo} 
                          controls 
                          className="w-full h-full object-cover"
                          loop
                          muted
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedVideo;
                          link.download = 'generated-video.mp4';
                          link.click();
                        }}
                        className="w-full bg-[#F59E0B] text-white py-2 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        Download Video
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
