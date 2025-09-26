import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'input' | 'none';
  optional?: boolean;
  condition?: () => boolean; // Optional condition to show this step
}

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  category: 'onboarding' | 'feature' | 'advanced';
  requiredForNewUsers?: boolean;
}

interface TutorialState {
  // Current tutorial state
  isActive: boolean;
  currentTutorial: Tutorial | null;
  currentStepIndex: number;
  completedTutorials: string[];
  dismissedTutorials: string[];
  isFirstTimeUser: boolean;
  
  // Available tutorials
  tutorials: Tutorial[];
  
  // Actions
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  dismissTutorial: (tutorialId: string) => void;
  resetTutorial: () => void;
  
  // Tutorial management
  registerTutorial: (tutorial: Tutorial) => void;
  setFirstTimeUser: (isFirstTime: boolean) => void;
  
  // Progress tracking
  markStepCompleted: (stepId: string) => void;
  isStepCompleted: (stepId: string) => boolean;
  getTutorialProgress: (tutorialId: string) => number;
}

// Default tutorials that cover main app features
const defaultTutorials: Tutorial[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of Portrait Studio',
    category: 'onboarding',
    requiredForNewUsers: true,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Portrait Studio!',
        content: 'Let\'s take a quick tour to get you started with AI-powered portrait transformations.',
        target: 'body',
        position: 'center',
        action: 'none'
      },
      {
        id: 'upload-area',
        title: 'Upload Your Photo',
        content: 'Start by dropping an image here or click to browse. We support JPG, PNG, and WebP formats.',
        target: '[data-tutorial="upload-area"]',
        position: 'bottom',
        action: 'click'
      },
      {
        id: 'transformation-options',
        title: 'Choose Your Style',
        content: 'Select from various AI transformation styles. Each style creates a unique artistic interpretation of your photo.',
        target: '[data-tutorial="transformation-styles"]',
        position: 'right',
        action: 'click'
      },
      {
        id: 'generate-button',
        title: 'Generate Your Portrait',
        content: 'Click here to start the AI transformation. The process usually takes 30-60 seconds.',
        target: '[data-tutorial="generate-button"]',
        position: 'top',
        action: 'click'
      },
      {
        id: 'results-area',
        title: 'View Your Results',
        content: 'Your transformed portraits will appear here. You can download, share, or create variations.',
        target: '[data-tutorial="results-area"]',
        position: 'top',
        action: 'none'
      }
    ]
  },
  {
    id: 'advanced-features',
    name: 'Advanced Features',
    description: 'Discover powerful tools for better results',
    category: 'advanced',
    steps: [
      {
        id: 'image-editor',
        title: 'Built-in Image Editor',
        content: 'Use our built-in editor to crop, rotate, and adjust your photos before transformation for better results.',
        target: '[data-tutorial="edit-button"]',
        position: 'bottom',
        action: 'click'
      },
      {
        id: 'batch-processing',
        title: 'Batch Processing',
        content: 'Upload multiple images at once to transform them with the same style settings.',
        target: '[data-tutorial="batch-upload"]',
        position: 'right',
        action: 'none'
      },
      {
        id: 'style-customization',
        title: 'Style Customization',
        content: 'Fine-tune transformation parameters to get exactly the look you want.',
        target: '[data-tutorial="style-settings"]',
        position: 'left',
        action: 'click'
      }
    ]
  },
  {
    id: 'subscription-benefits',
    name: 'Subscription & Credits',
    description: 'Learn about plans and credit system',
    category: 'feature',
    steps: [
      {
        id: 'credit-system',
        title: 'How Credits Work',
        content: 'Each transformation uses credits. Image transforms cost 4 credits, videos cost 5-18 credits per second.',
        target: '[data-tutorial="credit-display"]',
        position: 'bottom',
        action: 'none'
      },
      {
        id: 'subscription-plans',
        title: 'Subscription Plans',
        content: 'Upgrade to get more credits, priority processing, and access to premium features.',
        target: '[data-tutorial="upgrade-button"]',
        position: 'top',
        action: 'click'
      },
      {
        id: 'billing-management',
        title: 'Manage Your Billing',
        content: 'Access billing settings, view usage, and manage your subscription from the user menu.',
        target: '[data-tutorial="user-menu"]',
        position: 'left',
        action: 'hover'
      }
    ]
  }
];

export const useTutorial = create<TutorialState>()(
  persist(
    subscribeWithSelector((set, get) => ({
    // Initial state
    isActive: false,
    currentTutorial: null,
    currentStepIndex: 0,
    completedTutorials: [],
    dismissedTutorials: [],
    isFirstTimeUser: true,
    tutorials: defaultTutorials,
    
    // Start a tutorial
    startTutorial: (tutorialId: string) => {
      const tutorial = get().tutorials.find(t => t.id === tutorialId);
      if (!tutorial) {
        console.warn(`Tutorial not found: ${tutorialId}`);
        return;
      }
      
      set({
        isActive: true,
        currentTutorial: tutorial,
        currentStepIndex: 0
      });
    },
    
    // Navigate to next step
    nextStep: () => {
      const { currentTutorial, currentStepIndex } = get();
      if (!currentTutorial) return;
      
      if (currentStepIndex < currentTutorial.steps.length - 1) {
        set({ currentStepIndex: currentStepIndex + 1 });
      } else {
        // Tutorial completed
        get().completeTutorial();
      }
    },
    
    // Navigate to previous step
    previousStep: () => {
      const { currentStepIndex } = get();
      if (currentStepIndex > 0) {
        set({ currentStepIndex: currentStepIndex - 1 });
      }
    },
    
    // Skip current tutorial
    skipTutorial: () => {
      const { currentTutorial } = get();
      if (currentTutorial) {
        set(state => ({
          isActive: false,
          currentTutorial: null,
          currentStepIndex: 0,
          dismissedTutorials: [...state.dismissedTutorials, currentTutorial.id]
        }));
      }
    },
    
    // Complete current tutorial
    completeTutorial: () => {
      const { currentTutorial } = get();
      if (currentTutorial) {
        set(state => ({
          isActive: false,
          currentTutorial: null,
          currentStepIndex: 0,
          completedTutorials: [...state.completedTutorials, currentTutorial.id]
        }));
        
        // Save completion to localStorage
        const completed = [...get().completedTutorials, currentTutorial.id];
        localStorage.setItem('tutorial-completed', JSON.stringify(completed));
      }
    },
    
    // Dismiss a tutorial (prevent auto-start)
    dismissTutorial: (tutorialId: string) => {
      set(state => ({
        dismissedTutorials: [...state.dismissedTutorials, tutorialId]
      }));
      
      // Save dismissal to localStorage
      const dismissed = [...get().dismissedTutorials, tutorialId];
      localStorage.setItem('tutorial-dismissed', JSON.stringify(dismissed));
    },
    
    // Reset tutorial state
    resetTutorial: () => {
      set({
        isActive: false,
        currentTutorial: null,
        currentStepIndex: 0
      });
    },
    
    // Register a new tutorial
    registerTutorial: (tutorial: Tutorial) => {
      set(state => ({
        tutorials: [...state.tutorials.filter(t => t.id !== tutorial.id), tutorial]
      }));
    },
    
    // Set first time user status
    setFirstTimeUser: (isFirstTime: boolean) => {
      set({ isFirstTimeUser: isFirstTime });
      localStorage.setItem('tutorial-first-time', JSON.stringify(!isFirstTime));
    },
    
    // Mark a step as completed (for complex tutorials)
    markStepCompleted: (stepId: string) => {
      const completedSteps = JSON.parse(localStorage.getItem('tutorial-steps-completed') || '[]');
      if (!completedSteps.includes(stepId)) {
        completedSteps.push(stepId);
        localStorage.setItem('tutorial-steps-completed', JSON.stringify(completedSteps));
      }
    },
    
    // Check if a step is completed
    isStepCompleted: (stepId: string) => {
      const completedSteps = JSON.parse(localStorage.getItem('tutorial-steps-completed') || '[]');
      return completedSteps.includes(stepId);
    },
    
    // Get tutorial progress percentage
    getTutorialProgress: (tutorialId: string) => {
      const tutorial = get().tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return 0;
      
      const completedSteps = tutorial.steps.filter(step => 
        get().isStepCompleted(step.id)
      ).length;
      
      return Math.round((completedSteps / tutorial.steps.length) * 100);
    }
    })),
    {
      name: 'tutorial-storage',
      partialize: (state) => ({
        completedTutorials: state.completedTutorials,
        dismissedTutorials: state.dismissedTutorials,
        isFirstTimeUser: state.isFirstTimeUser,
      }),
    }
  )
);

// Initialize tutorial state from localStorage
const initializeTutorialState = () => {
  const completed = JSON.parse(localStorage.getItem('tutorial-completed') || '[]');
  const dismissed = JSON.parse(localStorage.getItem('tutorial-dismissed') || '[]');
  const isFirstTime = !JSON.parse(localStorage.getItem('tutorial-first-time') || 'false');
  
  useTutorial.setState({
    completedTutorials: completed,
    dismissedTutorials: dismissed,
    isFirstTimeUser: isFirstTime
  });
};

// Auto-initialize when the module loads
if (typeof window !== 'undefined') {
  initializeTutorialState();
}