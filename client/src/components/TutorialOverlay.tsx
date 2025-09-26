import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useTutorial } from '@/lib/stores/useTutorial';
import { cn } from '@/lib/utils';

interface TutorialOverlayProps {
  className?: string;
}

export function TutorialOverlay({ className }: TutorialOverlayProps) {
  const {
    isActive,
    currentTutorial,
    currentStepIndex,
    nextStep,
    previousStep,
    skipTutorial,
    resetTutorial
  } = useTutorial();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{x: number, y: number} | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = currentTutorial?.steps[currentStepIndex];
  const progress = currentTutorial ? ((currentStepIndex + 1) / currentTutorial.steps.length) * 100 : 0;

  // Update highlight position when step changes
  useEffect(() => {
    if (!isActive || !currentStep) {
      setHighlightRect(null);
      setTooltipPosition(null);
      return;
    }

    const updateHighlight = () => {
      const targetElement = document.querySelector(currentStep.target);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setHighlightRect(rect);
        
        // Calculate tooltip position based on step position preference
        const tooltipX = rect.left + rect.width / 2;
        const tooltipY = (() => {
          switch (currentStep.position) {
            case 'top': return rect.top - 20;
            case 'bottom': return rect.bottom + 20;
            case 'left': return rect.top + rect.height / 2;
            case 'right': return rect.top + rect.height / 2;
            case 'center': return window.innerHeight / 2;
            default: return rect.bottom + 20;
          }
        })();
        
        setTooltipPosition({ x: tooltipX, y: tooltipY });
      } else {
        // Target not found, center the tooltip
        setHighlightRect(null);
        setTooltipPosition({ 
          x: window.innerWidth / 2, 
          y: window.innerHeight / 2 
        });
      }
    };

    // Initial update
    updateHighlight();

    // Update on resize and scroll
    const handleResize = () => updateHighlight();
    const handleScroll = () => updateHighlight();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isActive, currentStep]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousStep();
          break;
        case 'Escape':
          e.preventDefault();
          skipTutorial();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, previousStep, skipTutorial]);

  if (!isActive || !currentTutorial || !currentStep) {
    return null;
  }

  const getTooltipClasses = () => {
    if (!tooltipPosition) return '';
    
    const { position } = currentStep;
    const baseClasses = "absolute z-[60] max-w-sm";
    
    switch (position) {
      case 'top':
        return `${baseClasses} -translate-x-1/2 -translate-y-full mb-2`;
      case 'bottom':
        return `${baseClasses} -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} -translate-x-full -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} -translate-y-1/2 ml-2`;
      case 'center':
        return `${baseClasses} -translate-x-1/2 -translate-y-1/2`;
      default:
        return `${baseClasses} -translate-x-1/2 mt-2`;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn("fixed inset-0 z-50 pointer-events-none", className)}
      >
        {/* Dark overlay with spotlight effect */}
        <div className="absolute inset-0 bg-black/50 pointer-events-auto">
          {highlightRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute border-4 border-blue-400 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] pointer-events-none"
              style={{
                left: highlightRect.left - 8,
                top: highlightRect.top - 8,
                width: highlightRect.width + 16,
                height: highlightRect.height + 16,
                background: 'transparent',
                boxShadow: `
                  0 0 0 4px rgba(59, 130, 246, 0.4),
                  0 0 20px rgba(59, 130, 246, 0.3),
                  inset 0 0 0 9999px rgba(0, 0, 0, 0.5)
                `
              }}
            />
          )}
        </div>

        {/* Tutorial tooltip */}
        {tooltipPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={getTooltipClasses()}
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y
            }}
          >
            <Card className="border-2 border-blue-400 shadow-[8px_8px_0px_0px_rgba(59,130,246,0.3)] bg-white pointer-events-auto">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {currentStep.title}
                    {currentStepIndex === currentTutorial.steps.length - 1 && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTutorial}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Progress bar */}
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{currentTutorial.name}</span>
                    <span>
                      {currentStepIndex + 1} / {currentTutorial.steps.length}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-gray-700 text-sm mb-4">
                  {currentStep.content}
                </p>

                {/* Action hint */}
                {currentStep.action && currentStep.action !== 'none' && (
                  <div className="mb-4 p-2 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-xs text-blue-800 font-medium">
                      💡 Try to {currentStep.action} the highlighted element
                    </p>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousStep}
                    disabled={currentStepIndex === 0}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={skipTutorial}
                      className="text-gray-500"
                    >
                      Skip Tutorial
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={nextStep}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {currentStepIndex === currentTutorial.steps.length - 1 ? (
                        <>
                          Finish
                          <CheckCircle className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400">
                    Use ← → arrow keys or Esc to skip
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tutorial controls (bottom-right corner) */}
        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <Card className="border-2 border-gray-300 shadow-[4px_4px_0px_0px_#000000] bg-white/95">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetTutorial}
                  className="text-gray-500 hover:text-gray-700"
                  title="Restart tutorial"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                
                <div className="text-xs text-gray-500 border-l border-gray-300 pl-2">
                  Tutorial Active
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}