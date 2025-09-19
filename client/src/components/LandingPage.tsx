import React from 'react';
import { UserHeader } from './UserHeader';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Upload, Wand2, Video, Lock, Eye } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fffdf5] p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header with Auth */}
        <UserHeader />

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
            Transform Your Portraits with AI
          </h2>
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Upload your photos and transform them into stunning artworks with our AI-powered portrait transformation and video generation tools.
          </p>
          <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <Lock className="w-5 h-5" />
              <span className="font-semibold">Sign in required to use features</span>
            </div>
          </div>
        </div>

        {/* Demo Grid - Shows the interface but locked */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Zone - Disabled */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black relative">
              <div className="p-6 h-full flex flex-col">
                <h2 className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                  Upload Portrait
                </h2>
                
                <div className="flex-1 border-3 border-dashed border-gray-300 rounded-lg p-8 text-center relative bg-gray-50/50">
                  {/* Overlay to disable interaction */}
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 font-medium">Sign in to upload</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center h-full">
                    <Upload className="w-12 h-12 text-gray-400 mb-4" />
                    <p className="text-lg font-semibold text-black mb-2">
                      Drop your portrait here
                    </p>
                    <p className="text-gray-600 mb-4">
                      or click to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports JPG, PNG, WebP
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Transformation Controls - Disabled */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#6c8b3a] border-2 border-black relative">
              <div className="p-6 h-full flex flex-col">
                <h2 className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                  AI Transformations
                </h2>
                
                <div className="flex-1 space-y-6 relative">
                  {/* Overlay to disable interaction */}
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg z-10">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 font-medium">Sign in to transform</p>
                    </div>
                  </div>

                  {/* Demo Style Options */}
                  <div>
                    <h3 className="text-sm font-bold text-black mb-3 uppercase tracking-wide">Art Style</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {['Anime', 'Watercolor', 'Cartoon', 'Sketch'].map((style) => (
                        <Button
                          key={style}
                          variant="outline"
                          className="border-2 border-black text-left justify-start bg-white disabled:opacity-50"
                          disabled
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          {style}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Demo Persona Options */}
                  <div>
                    <h3 className="text-sm font-bold text-black mb-3 uppercase tracking-wide">Character</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {['Robot', 'Astronaut', 'Ninja', 'Mage'].map((persona) => (
                        <Button
                          key={persona}
                          variant="outline"
                          className="border-2 border-black text-left justify-start bg-white disabled:opacity-50"
                          disabled
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          {persona}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Demo Transform Button */}
                  <Button
                    className="w-full bg-[#10B981] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] disabled:opacity-50"
                    disabled
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Transform Portrait
                  </Button>

                  {/* Demo Video Generation */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-black uppercase tracking-wide">Video Generation</h3>
                    <Button
                      className="w-full bg-[#F59E0B] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] disabled:opacity-50"
                      disabled
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Generate Video
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Preview Grid - Empty state */}
          <div className="lg:col-span-1">
            <Card className="h-full shadow-[8px_8px_0px_0px_#F59E0B] border-2 border-black">
              <div className="p-6 h-full flex flex-col">
                <h2 className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                  Preview
                </h2>
                
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Eye className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">
                      Results will appear here
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Sign in and upload an image to get started
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12">
          <Card className="shadow-[8px_8px_0px_0px_#c6c2e6] border-2 border-black">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-black mb-6 text-center" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                What You Can Do
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-[#c6c2e6] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-black" />
                  </div>
                  <h3 className="font-bold text-black mb-2">Upload Photos</h3>
                  <p className="text-gray-600">
                    Upload your portrait photos in JPG, PNG, or WebP format
                  </p>
                </div>
                <div className="text-center">
                  <div className="bg-[#6c8b3a] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-black mb-2">AI Transformations</h3>
                  <p className="text-gray-600">
                    Transform portraits into multiple art styles and characters
                  </p>
                </div>
                <div className="text-center">
                  <div className="bg-[#F59E0B] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bold text-black mb-2">Video Generation</h3>
                  <p className="text-gray-600">
                    Create animated videos from your transformed portraits
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}