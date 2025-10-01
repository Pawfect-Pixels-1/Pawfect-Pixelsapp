import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Play, Video, Image as ImageIcon, MousePointer2, ArrowRight, Star, ShieldCheck, Crown } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ReplitAuthDialog } from "./ReplitAuthDialog";
import { WelcomePricingSection } from "./WelcomePricingSection";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Floating decorative shapes
// ─────────────────────────────────────────────────────────────────────────────
function FloatingShapes() {
  const shapes = new Array(10).fill(0).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 4,
    size: 20 + Math.random() * 40,
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {shapes.map((s) => (
        <motion.div
          key={s.id}
          initial={{ y: 500, opacity: 0 }}
          animate={{ y: [-100, -200, -250], opacity: [0.0, 0.6, 0.0] }}
          transition={{ duration: 12 + s.delay, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
          className="absolute"
          style={{ left: `${s.x}%` }}
        >
          <div
            className="rounded-full border-2 border-black shadow-[4px_4px_0_#000] bg-white/70 backdrop-blur"
            style={{ width: s.size, height: s.size }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Before / After slider
// ─────────────────────────────────────────────────────────────────────────────
function BeforeAfterSlider({ beforeSrc, afterSrc, labelBefore = "BEFORE", labelAfter = "AFTER", altBefore, altAfter }: {
  beforeSrc: string;
  afterSrc: string;
  labelBefore?: string;
  labelAfter?: string;
  altBefore?: string;
  altAfter?: string;
}) {
  const [value, setValue] = useState(50);
  const clip = useMemo(() => `inset(0 ${100 - value}% 0 0)`, [value]);
  return (
    <div className="relative w-full overflow-hidden rounded-xl border-2 border-black shadow-[6px_6px_0_#000] select-none">
      <img src={beforeSrc} alt={altBefore || labelBefore} className="block w-full h-72 object-cover" />
      <img
        src={afterSrc}
        alt={altAfter || labelAfter}
        className="block w-full h-72 object-cover absolute inset-0"
        style={{ clipPath: clip }}
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="px-3 py-1 text-xs font-bold bg-white/80 border border-black rounded-full mr-auto ml-3 mt-3">
          {labelBefore}
        </div>
        <div className="px-3 py-1 text-xs font-bold bg-white/80 border border-black rounded-full ml-auto mr-3 mt-3">
          {labelAfter}
        </div>
      </div>
      <input
        aria-label="Reveal slider"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(parseInt(e.target.value))}
        className="absolute inset-x-4 bottom-3 appearance-none h-2 bg-white/80 border-2 border-black rounded-full cursor-ew-resize"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Auto-advancing testimonial carousel
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialCarousel() {
  const testimonials = [
    { name: "Ava R.", text: "Turned my selfie into an epic anime hero in seconds!", plan: "Pro" },
    { name: "Mason L.", text: "The video generator is wild — smooth and cinematic.", plan: "Premium" },
    { name: "Isla T.", text: "Such a fun UI. I tried 7 styles in 10 minutes.", plan: "Free" },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % testimonials.length), 3500);
    return () => clearInterval(t);
  }, []);
  const t = testimonials[idx];
  return (
    <Card className="border-2 border-black shadow-[8px_8px_0_#c6c2e6]">
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-4 h-4" />
              <Star className="w-4 h-4" />
              <Star className="w-4 h-4" />
              <Star className="w-4 h-4" />
              <Star className="w-4 h-4" />
            </div>
            <p className="text-lg text-gray-800 mb-2">“{t.text}”</p>
            <div className="text-sm text-gray-600">— {t.name} · {t.plan}</div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card> 
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Animated counters
// ─────────────────────────────────────────────────────────────────────────────
function useCountingNumber(to: number, durationMs = 800) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setN(Math.round(p * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

  const openLogin = () => {
    setShowAuthDialog(true);
  };
  const openRegister = () => {
    setShowAuthDialog(true);
  };

  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 320);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const users = useCountingNumber(12_430);
  const renders = useCountingNumber(87_900);
  const styles = useCountingNumber(60);

  const styleMarquee = [
    "Cartoon", "Angel", "Cyberpunk", "Gothic", "Clay", "Anime", "Watercolor", "Vogue", "Noir", "Fantasy",
  ];

  return (
    <>
      {/* Sticky CTA */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="fixed top-3 inset-x-3 z-40"
          >
            <Card className="border-2 border-black shadow-[6px_6px_0_#000] bg-[#fffdf5]/90 backdrop-blur">
              <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-semibold">Ready to transform your portrait?</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="border-2 border-black shadow-[4px_4px_0_#000]" onClick={openLogin}>
                    Sign In
                  </Button>
                  <Button className="bg-emerald-500 hover:bg-emerald-600 border-2 border-black shadow-[4px_4px_0_#000]" onClick={openRegister}>
                    Get Started
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Welcome Content */}
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 relative overflow-hidden">
        <FloatingShapes />
        
        <div className="relative z-10 container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="font-header text-6xl font-bold mb-6 text-gray-900">
              Welcome to <span className="text-purple-600">AI Studio</span>
            </h1>
            <p className="text-xl text-gray-700 mb-8">
              Transform your ideas into stunning visuals with the power of AI
            </p>
            
            <div className="flex gap-4 justify-center mb-16">
              <Button 
                size="lg" 
                className="bg-purple-600 hover:bg-purple-700 border-2 border-black shadow-[6px_6px_0_#000]"
                onClick={openRegister}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                className="border-2 border-black shadow-[6px_6px_0_#000]"
                onClick={openLogin}
              >
                Sign In
              </Button>
            </div>

            {/* Showcase Gallery */}
            <div className="mb-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-12"
              >
                <h2 className="font-header text-4xl font-bold mb-4 text-gray-900">
                  See the <span className="text-purple-600">Magic</span> in Action
                </h2>
                <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                  Transform ordinary portraits into extraordinary art with our AI-powered tools
                </p>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {/* Cartoon Transformation */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-4"
                >
                  <h3 className="font-title text-2xl font-semibold text-center text-gray-800">
                    Cartoon Style Transform
                  </h3>
                  <BeforeAfterSlider
                    beforeSrc="/showcase/before-1.jpeg"
                    afterSrc="/showcase/after-1-cartoon.png"
                    labelBefore="ORIGINAL"
                    labelAfter="CARTOON"
                    altBefore="Original portrait photo"
                    altAfter="Cartoon style transformation"
                  />
                </motion.div>

                {/* Angel Transformation */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-4"
                >
                  <h3 className="font-title text-2xl font-semibold text-center text-gray-800">
                    Angel Style Transform
                  </h3>
                  <BeforeAfterSlider
                    beforeSrc="/showcase/before-2.jpeg"
                    afterSrc="/showcase/after-2-angel.png"
                    labelBefore="ORIGINAL"
                    labelAfter="ANGEL"
                    altBefore="Original portrait photo"
                    altAfter="Angel style transformation"
                  />
                </motion.div>
              </div>

              {/* Video Showcase */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-center"
              >
                <h3 className="font-title text-2xl font-semibold mb-6 text-gray-800">
                  Dynamic Video Generation
                </h3>
                <div className="max-w-md mx-auto">
                  <div className="relative rounded-xl border-2 border-black shadow-[6px_6px_0_#000] overflow-hidden bg-black">
                    <video
                      src="/showcase/after-video.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-72 object-cover"
                      onError={(e) => console.log('Video loading error:', e)}
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 text-xs font-bold bg-white/80 border border-black rounded-full">
                      AI VIDEO
                    </div>
                  </div>
                  <p className="text-gray-600 mt-4 text-sm">
                    Turn your transformed portraits into captivating videos
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Pricing Plans */}
            <WelcomePricingSection onGetStarted={openRegister} />

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <Card className="border-2 border-black shadow-[6px_6px_0_#000]">
                <CardContent className="p-6 text-center">
                  <div className="font-title text-3xl font-bold text-purple-600 mb-2">{users.toLocaleString()}+</div>
                  <div className="text-gray-600">Active Users</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-black shadow-[6px_6px_0_#000]">
                <CardContent className="p-6 text-center">
                  <div className="font-title text-3xl font-bold text-purple-600 mb-2">{renders.toLocaleString()}+</div>
                  <div className="text-gray-600">Images Generated</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-black shadow-[6px_6px_0_#000]">
                <CardContent className="p-6 text-center">
                  <div className="font-title text-3xl font-bold text-purple-600 mb-2">{styles}+</div>
                  <div className="text-gray-600">Art Styles</div>
                </CardContent>
              </Card>
            </div>

            {/* Testimonials */}
            <TestimonialCarousel />
          </motion.div>
        </div>
      </div>

      {/* Auth Dialog */}
      <ReplitAuthDialog 
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
      />
    </>
  );
}