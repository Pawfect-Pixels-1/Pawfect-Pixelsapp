import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import UploadZone from "./components/UploadZone";
import PreviewGrid from "./components/PreviewGrid";
import TransformationControls from "./components/TransformationControls";
import { UserHeader } from "./components/UserHeader";
import { UserDashboard } from "./components/UserDashboard";
import PricingPage from "./components/PricingPage";
import { ShareButton } from "./components/ShareButton";
import WelcomePage from "./components/WelcomePage";
import { useTransformation } from "./lib/stores/useTransformation";
import { useAuth } from "./lib/stores/useAuth";
import { useBilling } from "./lib/stores/useBilling";
import { Card } from "./components/ui/card";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { BillingManagementModal } from "./components/BillingManagementModal";

const queryClient = new QueryClient();

// Auth wrapper component
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

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

  return <>{children}</>;
}

// Dashboard page component
function DashboardPage() {
  const navigate = useNavigate();
  const { handlePostCheckout } = useBilling();
  const { user } = useAuth();

  // Handle post-checkout redirect on mount
  useEffect(() => {
    if (user) {
      handlePostCheckout();
    }
  }, [user, handlePostCheckout]);
  
  return (
    <div className="min-h-screen bg-[#fffdf5]">
      <div className="max-w-7xl mx-auto">
        {/* Header with navigation */}
        <div className="p-4">
          <UserHeader onShowPricing={() => navigate('/pricing')} />
          <div className="flex justify-center mt-4 space-x-4">
            <button
              onClick={() => navigate('/studio')}
              className="bg-white text-black py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              🎨 Studio
            </button>
            <button
              onClick={() => navigate('/dashboard')}
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

// Studio page component
function StudioPage() {
  const navigate = useNavigate();
  const { 
    uploadedImage, 
    transformedImage, 
    generatedVideo, 
    isProcessing, 
    currentOperation 
  } = useTransformation();

  return (
    <div className="min-h-screen bg-[#fffdf5] p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header with navigation */}
        <UserHeader onShowPricing={() => navigate('/pricing')} />
        <div className="flex justify-center mt-4 mb-6 space-x-4">
          <button
            onClick={() => navigate('/studio')}
            className="bg-[#6c8b3a] text-white py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000]"
          >
            🎨 Studio
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-white text-black py-2 px-6 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            📊 Dashboard
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Zone */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black" data-tutorial="upload-area">
              <UploadZone />
            </Card>
          </div>

          {/* Transformation Controls */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#6c8b3a] border-2 border-black" data-tutorial="transformation-styles">
              <TransformationControls />
            </Card>
          </div>

          {/* Preview Grid */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black" data-tutorial="results-area">
              <PreviewGrid />
            </Card>
          </div>
        </div>

        {/* Tutorial Components */}
        <TutorialOverlay />
        <OnboardingFlow />

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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Share & Download</h4>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = transformedImage;
                              link.download = 'transformed-portrait.png';
                              link.click();
                            }}
                            className="flex-1 bg-[#10B981] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download
                          </button>
                          <div className="flex-1">
                            <ShareButton
                              contentUrl={transformedImage}
                              contentType="image"
                              title="Check out my AI-transformed portrait!"
                              description="Created with Portrait Studio's amazing AI transformation technology"
                              onShare={(platform) => console.log(`Shared transformed image to ${platform}`)}
                            />
                          </div>
                        </div>
                      </div>
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Share & Download</h4>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = generatedVideo;
                              link.download = 'generated-video.mp4';
                              link.click();
                            }}
                            className="flex-1 bg-[#F59E0B] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download
                          </button>
                          <div className="flex-1">
                            <ShareButton
                              contentUrl={generatedVideo}
                              contentType="video"
                              title="Check out my AI-generated video!"
                              description="Watch this amazing AI-powered video transformation created with Portrait Studio"
                              onShare={(platform) => console.log(`Shared generated video to ${platform}`)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
      
      {/* Global modals */}
      <BillingManagementModal />
    </div>
  );
}

// Pricing page wrapper
function PricingPageRoute() {
  const navigate = useNavigate();
  
  return <PricingPage onBack={() => navigate('/dashboard')} />;
}

// Main app with routes
function AppContent() {
  return (
    <Router>
      <Routes>
        {/* Public route - shows welcome page for unauthenticated users */}
        <Route path="/" element={<AuthWrapper><Navigate to="/dashboard" /></AuthWrapper>} />
        
        {/* Protected routes - require authentication */}
        <Route path="/dashboard" element={<AuthWrapper><DashboardPage /></AuthWrapper>} />
        <Route path="/studio" element={<AuthWrapper><StudioPage /></AuthWrapper>} />
        <Route path="/pricing" element={<AuthWrapper><PricingPageRoute /></AuthWrapper>} />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
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