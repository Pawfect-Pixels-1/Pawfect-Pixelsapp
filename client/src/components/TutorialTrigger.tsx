import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Play, BookOpen, Zap, GraduationCap, Clock, CheckCircle } from 'lucide-react';
import { useTutorial, Tutorial } from '@/lib/stores/useTutorial';
import { cn } from '@/lib/utils';

interface TutorialTriggerProps {
  variant?: 'button' | 'card' | 'menu-item';
  tutorialId?: string;
  className?: string;
  children?: React.ReactNode;
}

export function TutorialTrigger({ 
  variant = 'button', 
  tutorialId,
  className,
  children 
}: TutorialTriggerProps) {
  const {
    startTutorial,
    tutorials,
    completedTutorials,
    dismissedTutorials,
    getTutorialProgress
  } = useTutorial();

  if (variant === 'button' && tutorialId) {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    const isCompleted = completedTutorials.includes(tutorialId);
    const progress = getTutorialProgress(tutorialId);

    if (!tutorial) return null;

    return (
      <Button
        onClick={() => startTutorial(tutorialId)}
        className={cn("flex items-center gap-2", className)}
        variant={isCompleted ? "outline" : "default"}
      >
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {children || `Start ${tutorial.name}`}
      </Button>
    );
  }

  if (variant === 'menu-item' && tutorialId) {
    const tutorial = tutorials.find(t => t.id === tutorialId);
    const isCompleted = completedTutorials.includes(tutorialId);

    if (!tutorial) return null;

    return (
      <button
        onClick={() => startTutorial(tutorialId)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors w-full text-left",
          isCompleted && "text-green-600",
          className
        )}
      >
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <Play className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{tutorial.name}</span>
        {isCompleted && <Badge variant="secondary" className="ml-auto text-xs">Completed</Badge>}
      </button>
    );
  }

  // Default: Show tutorial selection dialog
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button className={cn("flex items-center gap-2", className)}>
            <GraduationCap className="w-4 h-4" />
            Tutorials
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-2 border-black shadow-[8px_8px_0px_0px_#000000]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            Interactive Tutorials
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            Learn how to make the most of Portrait Studio with these interactive guides.
          </p>
          
          <div className="grid gap-4">
            {tutorials.map((tutorial) => (
              <TutorialCard 
                key={tutorial.id} 
                tutorial={tutorial}
                isCompleted={completedTutorials.includes(tutorial.id)}
                isDismissed={dismissedTutorials.includes(tutorial.id)}
                progress={getTutorialProgress(tutorial.id)}
                onStart={() => startTutorial(tutorial.id)}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TutorialCardProps {
  tutorial: Tutorial;
  isCompleted: boolean;
  isDismissed: boolean;
  progress: number;
  onStart: () => void;
}

function TutorialCard({ tutorial, isCompleted, isDismissed, progress, onStart }: TutorialCardProps) {
  const getCategoryIcon = (category: Tutorial['category']) => {
    switch (category) {
      case 'onboarding':
        return <GraduationCap className="w-5 h-5 text-green-600" />;
      case 'feature':
        return <BookOpen className="w-5 h-5 text-blue-600" />;
      case 'advanced':
        return <Zap className="w-5 h-5 text-purple-600" />;
      default:
        return <BookOpen className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: Tutorial['category']) => {
    switch (category) {
      case 'onboarding':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'feature':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'advanced':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEstimatedTime = (steps: number) => {
    // Rough estimate: 30 seconds per step
    const minutes = Math.ceil((steps * 30) / 60);
    return `~${minutes} min`;
  };

  return (
    <Card className={cn(
      "border-2 border-black shadow-[4px_4px_0px_0px_#000000] transition-all hover:shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1",
      isCompleted && "border-green-400 bg-green-50",
      isDismissed && "opacity-60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getCategoryIcon(tutorial.category)}
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {tutorial.name}
                {isCompleted && <CheckCircle className="w-5 h-5 text-green-500" />}
                {tutorial.requiredForNewUsers && (
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                    Required
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">{tutorial.description}</p>
            </div>
          </div>
          
          <Badge className={cn("text-xs capitalize", getCategoryColor(tutorial.category))}>
            {tutorial.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              <span>{tutorial.steps.length} steps</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{getEstimatedTime(tutorial.steps.length)}</span>
            </div>
          </div>
          
          {progress > 0 && !isCompleted && (
            <div className="text-sm text-gray-500">
              {progress}% complete
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            onClick={onStart}
            size="sm"
            variant={isCompleted ? "outline" : "default"}
            className="flex items-center gap-2"
          >
            {isCompleted ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Review
              </>
            ) : progress > 0 ? (
              <>
                <Play className="w-4 h-4" />
                Continue
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </Button>

          {isCompleted && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}