import React, { useState } from 'react';
import { Card } from './ui/card';
import { AuthDialog } from './AuthDialog';

const sampleTransformations = [
  {
    original: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI0NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9yaWdpbmFsPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5ZWEzYTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qb3J0cmFpdDwvdGV4dD48L3N2Zz4=',
    transformed: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRjZBNkI7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY4RTUzO3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRyYW5zZm9ybWVkPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QW5pbWU8L3RleHQ+PC9zdmc+',
    style: 'Anime Style'
  },
  {
    original: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI0NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9yaWdpbmFsPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5ZWEzYTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qb3J0cmFpdDwvdGV4dD48L3N2Zz4=',
    transformed: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2YzVjZTc7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTc4Ym9hO3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRyYW5zZm9ybWVkPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+R290aGljPC90ZXh0Pjwvc3ZnPg==',
    style: 'Gothic Style'
  },
  {
    original: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI0NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzllYTNhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9yaWdpbmFsPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5ZWEzYTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qb3J0cmFpdDwvdGV4dD48L3N2Zz4=',
    transformed: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGNTlFMEI7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRjc3MzE2O3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlRyYW5zZm9ybWVkPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q2xheTwvdGV4dD48L3N2Zz4=',
    style: 'Clay Style'
  }
];

export function WelcomePage() {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleGetStarted = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-[#fffdf5] p-4 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <div className="inline-block bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] p-1 rounded-2xl">
              <div className="bg-[#fffdf5] px-6 py-3 rounded-xl">
                <h1 className="text-5xl md:text-7xl font-black text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                  Portrait Studio
                </h1>
              </div>
            </div>
          </div>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            Transform your portraits with AI-powered magic. Create stunning anime, gothic, clay, and cartoon versions of any photo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleGetStarted('register')}
              className="bg-[#10B981] text-white text-xl px-8 py-4 rounded-xl font-bold border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
            >
              Get Started Free
            </button>
            <button
              onClick={() => handleGetStarted('login')}
              className="bg-white text-black text-xl px-8 py-4 rounded-xl font-bold border-4 border-black shadow-[8px_8px_0px_0px_#6c8b3a] hover:shadow-[4px_4px_0px_0px_#6c8b3a] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="shadow-[8px_8px_0px_0px_#FF6B6B] border-4 border-black">
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold text-black mb-4">AI Transformations</h3>
              <p className="text-gray-600 leading-relaxed">
                Advanced AI models transform your portraits into multiple artistic styles with stunning detail and accuracy.
              </p>
            </div>
          </Card>

          <Card className="shadow-[8px_8px_0px_0px_#4ECDC4] border-4 border-black">
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold text-black mb-4">Video Generation</h3>
              <p className="text-gray-600 leading-relaxed">
                Create dynamic video animations from your transformed portraits with smooth, professional results.
              </p>
            </div>
          </Card>

          <Card className="shadow-[8px_8px_0px_0px_#F59E0B] border-4 border-black">
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">💾</div>
              <h3 className="text-2xl font-bold text-black mb-4">Save Your History</h3>
              <p className="text-gray-600 leading-relaxed">
                Keep track of all your transformations and download your creations whenever you need them.
              </p>
            </div>
          </Card>
        </div>

        {/* Sample Transformations */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-black text-center mb-8" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
            See What's Possible
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {sampleTransformations.map((sample, index) => (
              <Card key={index} className="shadow-[8px_8px_0px_0px_#c6c2e6] border-4 border-black">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-black mb-4 text-center">{sample.style}</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-black text-center">Before</h4>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={sample.original} 
                          alt="Original portrait" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-black text-center">After</h4>
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                        <img 
                          src={sample.transformed} 
                          alt="Transformed portrait" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <Card className="shadow-[8px_8px_0px_0px_#10B981] border-4 border-black bg-gradient-to-r from-[#10B981] to-[#059669]">
          <div className="p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
              Ready to Transform Your Photos?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of users creating amazing portraits with AI
            </p>
            <button
              onClick={() => handleGetStarted('register')}
              className="bg-white text-[#10B981] text-xl px-8 py-4 rounded-xl font-bold border-4 border-black shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
            >
              Start Creating Now
            </button>
          </div>
        </Card>

        {/* Auth Dialog */}
        <AuthDialog
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode={authMode}
          onModeChange={setAuthMode}
        />
      </div>
    </div>
  );
}