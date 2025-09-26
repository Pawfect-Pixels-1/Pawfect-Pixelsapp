import React, { useEffect } from 'react';
import { useTutorial } from '@/lib/stores/useTutorial';
import { useAuth } from '@/lib/stores/useAuth';
import { TutorialTrigger } from './TutorialTrigger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingFlowProps {
  onDismiss?: () => void;
}

export function OnboardingFlow({ onDismiss }: OnboardingFlowProps) {
  const { user } = useAuth();
  const {
    isFirstTimeUser,
    completedTutorials,
    dismissedTutorials,
    startTutorial,
    setFirstTimeUser,
    dismissTutorial
  } = useTutorial();

  const shouldShowOnboarding = isFirstTimeUser && 
    !completedTutorials.includes('getting-started') &&
    !dismissedTutorials.includes('getting-started');

  useEffect(() => {
    // Check if user has been here before
    if (user && shouldShowOnboarding) {
      // Auto-start onboarding after a short delay to let the UI settle
      const timer = setTimeout(() => {
        // Only auto-start if they haven't dismissed it
        if (!dismissedTutorials.includes('getting-started')) {
          startTutorial('getting-started');
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [user, shouldShowOnboarding, startTutorial, dismissedTutorials]);

  const handleDismiss = () => {
    dismissTutorial('getting-started');
    setFirstTimeUser(false);
    onDismiss?.();
  };

  const handleStartOnboarding = () => {
    startTutorial('getting-started');
  };

  // Don't show if user has completed or dismissed onboarding
  if (!shouldShowOnboarding || !user) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-40 max-w-sm"
      >
        <Card className="border-2 border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-[8px_8px_0px_0px_rgba(147,51,234,0.3)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg font-bold text-gray-900">
                  Welcome to Portrait Studio!
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <p className="text-sm text-gray-700 mb-4">
              New here? Let's take a quick tour to get you started with AI-powered portrait transformations!
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                  1
                </div>
                <span>Upload your photo</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                  2
                </div>
                <span>Choose transformation style</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
                  3
                </div>
                <span>Generate AI portraits</span>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismiss}
                className="flex-1"
              >
                Skip
              </Button>
              
              <Button
                onClick={handleStartOnboarding}
                size="sm"
                className="flex-1 bg-purple-600 hover:bg-purple-700 flex items-center gap-1"
              >
                Start Tour
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Only takes 2 minutes • You can access tutorials anytime from the help menu
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// Quick access tutorial menu component
export function TutorialQuickAccess() {
  const { tutorials, completedTutorials, startTutorial } = useTutorial();

  const availableTutorials = tutorials.filter(t => 
    t.category === 'onboarding' || t.category === 'feature'
  );

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
        Tutorials
      </div>
      
      {availableTutorials.map(tutorial => (
        <TutorialTrigger
          key={tutorial.id}
          variant="menu-item"
          tutorialId={tutorial.id}
        />
      ))}
      
      <div className="border-t border-gray-200 pt-2">
        <TutorialTrigger variant="menu-item" className="text-blue-600 font-medium">
          View All Tutorials
        </TutorialTrigger>
      </div>
    </div>
  );
}