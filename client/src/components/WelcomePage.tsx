import React from 'react';
import { Card } from './ui/card';
import { AuthDialog } from './AuthDialog';
import { useState } from 'react';

export function WelcomePage() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openLogin = () => {
    setAuthMode('login');
    setShowAuthDialog(true);
  };

  const openRegister = () => {
    setAuthMode('register');
    setShowAuthDialog(true);
  };

  return (
    <>
      <div className="min-h-screen bg-[#fffdf5] p-4 font-sans">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center py-12">
            <h1 className="text-6xl font-bold text-black mb-6" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
              Portrait Studio
            </h1>
            <p className="text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
              Transform your portraits with AI-powered magic. Create stunning character transformations and generate amazing videos from your photos.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={openRegister}
                className="bg-[#10B981] text-white py-4 px-8 rounded-lg text-lg font-semibold border-2 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              >
                Get Started Free
              </button>
              <button
                onClick={openLogin}
                className="bg-white text-black py-4 px-8 rounded-lg text-lg font-semibold border-2 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-xl font-bold text-black mb-3">AI Portrait Transformation</h3>
                <p className="text-gray-600">
                  Transform your photos into stunning character portraits with various artistic styles. From anime to gothic, clay to cartoon - the possibilities are endless.
                </p>
              </div>
            </Card>

            <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🎬</div>
                <h3 className="text-xl font-bold text-black mb-3">Video Generation</h3>
                <p className="text-gray-600">
                  Bring your transformed portraits to life! Generate dynamic videos from your images with smooth animations and stunning visual effects.
                </p>
              </div>
            </Card>

            <Card className="shadow-[8px_8px_0px_0px_#10B981] border-2 border-black">
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">💾</div>
                <h3 className="text-xl font-bold text-black mb-3">Personal History</h3>
                <p className="text-gray-600">
                  Keep track of all your creations with your personal dashboard. Access, download, and manage your transformation history anytime.
                </p>
              </div>
            </Card>
          </div>

          {/* Before/After Showcase Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-black text-center mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
              See the Magic in Action
            </h2>
            <p className="text-xl text-gray-700 text-center mb-8">
              Real transformations from our users
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Cartoon Transformation */}
              <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-black text-center mb-4">Cartoon Style Transformation</h3>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600 mb-2">BEFORE</p>
                      <div className="relative overflow-hidden rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        <img 
                          src="/showcase/before-1.jpeg" 
                          alt="Original portrait photo" 
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600 mb-2">AFTER</p>
                      <div className="relative overflow-hidden rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        <img 
                          src="/showcase/after-1-cartoon.png" 
                          alt="Cartoon style transformation" 
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#c6c2e6] text-black border border-black">
                      🎨 Cartoon Style
                    </span>
                  </div>
                </div>
              </Card>

              {/* Angel Transformation */}
              <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-black text-center mb-4">Angel Character Transformation</h3>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600 mb-2">BEFORE</p>
                      <div className="relative overflow-hidden rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        <img 
                          src="/showcase/before-2.jpeg" 
                          alt="Original portrait photo" 
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-600 mb-2">AFTER</p>
                      <div className="relative overflow-hidden rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                        <img 
                          src="/showcase/after-2-angel.png" 
                          alt="Angel character transformation with wings and halo" 
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#F59E0B] text-black border border-black">
                      👼 Angel Character
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* How It Works Section */}
          <Card className="shadow-[8px_8px_0px_0px_#6c8b3a] border-2 border-black mb-12">
            <div className="p-8">
              <h2 className="text-3xl font-bold text-black text-center mb-8" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                How It Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#c6c2e6] rounded-full flex items-center justify-center text-2xl font-bold text-black mx-auto mb-4 border-2 border-black">
                    1
                  </div>
                  <h4 className="text-lg font-semibold text-black mb-2">Upload Your Photo</h4>
                  <p className="text-gray-600">
                    Simply drag and drop or click to upload your portrait photo. We support various image formats.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#F59E0B] rounded-full flex items-center justify-center text-2xl font-bold text-black mx-auto mb-4 border-2 border-black">
                    2
                  </div>
                  <h4 className="text-lg font-semibold text-black mb-2">Choose Your Style</h4>
                  <p className="text-gray-600">
                    Select from our wide range of artistic styles and personas to transform your portrait.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center text-2xl font-bold text-black mx-auto mb-4 border-2 border-black">
                    3
                  </div>
                  <h4 className="text-lg font-semibold text-black mb-2">Download & Share</h4>
                  <p className="text-gray-600">
                    Get your transformed images and videos instantly. Download in high quality and share with the world.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Call to Action */}
          <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
            <div className="p-8 text-center">
              <h2 className="text-3xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                Ready to Transform Your Portraits?
              </h2>
              <p className="text-xl text-gray-700 mb-6">
                Join thousands of users creating amazing AI-powered transformations
              </p>
              <button
                onClick={openRegister}
                className="bg-[#10B981] text-white py-4 px-8 rounded-lg text-lg font-semibold border-2 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              >
                Start Creating Now
              </button>
            </div>
          </Card>
        </div>
      </div>

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
      />
    </>
  );
}