import { create } from 'zustand';

export interface PlanConfig {
  name: string;
  displayName: string;
  price: number;
  description: string;
  features: string[];
  included_credits: number;
  daily_credits: number;
  styles: string[];
  downloads: string[];
  video_models: string[];
  video_caps: {
    max_duration: number;
    max_resolution: string;
  } | null;
  is_priority_queue: boolean;
}

export interface CreditPack {
  name: string;
  displayName: string;
  credits: number;
  price: number;
  bonus: number;
}

export interface UsageInfo {
  plan: string;
  status?: string; // Subscription status: 'active', 'past_due', 'unpaid', 'paused', 'trialing', 'canceled', 'incomplete'
  trialEndsAt: string | null;
  currentPeriodEnd?: string | null; // When current billing period ends
  dailyCreditsRemaining: number;
  creditsBalance: number;
  includedCreditsThisCycle: number;
  rateLimitRemaining: number;
  allowedVideoModels: string[];
  videoCaps: {
    max_duration: number;
    max_resolution: string;
  } | null;
  allowedStyles: string[];
  allowedDownloads: string[];
  isPriorityQueue: boolean;
}

interface BillingState {
  // Current usage and plan info
  usage: UsageInfo | null;
  plans: Record<string, PlanConfig>;
  creditPacks: CreditPack[];
  
  // Loading states
  isLoadingUsage: boolean;
  isLoadingPlans: boolean;
  isCreatingCheckout: boolean;
  isOpeningPortal: boolean;
  showBillingModal: boolean;
  isProcessing: boolean;
  
  // Actions
  fetchUsage: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  createCheckoutSession: (type: 'subscription' | 'credits', planOrPack: string, options?: {
    trialDays?: number;
    requirePaymentMethod?: boolean;
    billingCycleAnchorDay?: number;
  }) => Promise<string | null>;
  openCustomerPortal: () => Promise<boolean>;
  setShowBillingModal: (show: boolean) => void;
  cancelSubscription: () => Promise<boolean>;
  refreshUsage: () => Promise<void>;
  deductCredits: (amount: number) => void;
  handlePostCheckout: () => Promise<void>;
}

export const useBilling = create<BillingState>((set, get) => ({
    // Initial state
    usage: null,
    plans: {},
    creditPacks: [],
    isLoadingUsage: false,
    isLoadingPlans: false,
    isCreatingCheckout: false,
    isOpeningPortal: false,
    showBillingModal: false,
    isProcessing: false,

    // Fetch current usage and limits
    fetchUsage: async () => {
      set({ isLoadingUsage: true });
      try {
        const response = await fetch('/api/billing/usage/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const usage = await response.json();
          set({ usage });
        } else {
          console.error('Failed to fetch usage info');
        }
      } catch (error) {
        console.error('Error fetching usage:', error);
      } finally {
        set({ isLoadingUsage: false });
      }
    },

    // Fetch available plans and credit packs
    fetchPlans: async () => {
      set({ isLoadingPlans: true });
      try {
        const response = await fetch('/api/billing/plans');
        
        if (response.ok) {
          const data = await response.json();
          
          // Convert creditPacks object to array for rendering
          const creditPacksArray = data.creditPacks ? Object.entries(data.creditPacks).map(([name, pack]: [string, any]) => ({
            name,
            displayName: name.charAt(0).toUpperCase() + name.slice(1),
            ...pack
          })) : [];
          
          set({ 
            plans: data.plans,
            creditPacks: creditPacksArray 
          });
        } else {
          console.error('Failed to fetch plans');
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        set({ isLoadingPlans: false });
      }
    },

    // Create checkout session for subscription or credit purchase
    createCheckoutSession: async (type: 'subscription' | 'credits', planOrPack: string, options?: {
      trialDays?: number;
      requirePaymentMethod?: boolean;
      billingCycleAnchorDay?: number; // Day of month (1-31) for fixed billing dates
    }) => {
      set({ isCreatingCheckout: true });
      try {
        const body: any = { 
          type, 
          [type === 'subscription' ? 'plan' : 'creditPack']: planOrPack,
          successUrl: `${window.location.origin}/?success=1`,
          cancelUrl: `${window.location.origin}/?canceled=1`
        };

        // Add trial and billing anchor options for subscriptions
        if (type === 'subscription' && options) {
          if (options.trialDays !== undefined) {
            body.trialDays = options.trialDays;
          }
          if (options.requirePaymentMethod !== undefined) {
            body.requirePaymentMethod = options.requirePaymentMethod;
          }
          if (options.billingCycleAnchorDay !== undefined) {
            body.billingCycleAnchorDay = options.billingCycleAnchorDay;
          }
        }

        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          
          // Check if this is a portal redirect for existing subscribers
          if (data.redirectToPortal) {
            console.log(data.message || 'Redirecting to manage your existing subscription');
            // Open internal billing modal instead of external Stripe portal
            set({ showBillingModal: true });
            return null; // Don't redirect to external URL
          }
          
          return data.url;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to create checkout session:', errorData.error || 'Unknown error');
          alert(errorData.error || 'Unable to process payment. Please try again or contact support.');
          return null;
        }
      } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Network error while processing payment. Please check your connection and try again.');
        return null;
      } finally {
        set({ isCreatingCheckout: false });
      }
    },

    // Open customer portal for subscription management
    openCustomerPortal: async () => {
      // Internal billing management instead of external Stripe portal
      // This avoids Replit environment restrictions on external billing redirects
      set({ showBillingModal: true });
      return true;
    },

    // New internal billing management methods  
    setShowBillingModal: (show: boolean) => set({ showBillingModal: show }),

    cancelSubscription: async () => {
      set({ isProcessing: true });
      try {
        const response = await fetch('/api/billing/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (response.ok) {
          await get().fetchUsage(); // Refresh usage data
          return true;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Cancellation failed:', errorData.error);
          return false;
        }
      } catch (error) {
        console.error('Error canceling subscription:', error);
        return false;
      } finally {
        set({ isProcessing: false });
      }
    },

    // Refresh usage after operations
    refreshUsage: async () => {
      const { fetchUsage } = get();
      await fetchUsage();
    },

    // Optimistically deduct credits for immediate UI feedback
    deductCredits: (amount: number) => {
      const { usage } = get();
      if (usage) {
        set({
          usage: {
            ...usage,
            creditsBalance: Math.max(0, usage.creditsBalance - amount),
            dailyCreditsRemaining: Math.max(0, usage.dailyCreditsRemaining - amount)
          }
        });
      }
    },

    // Handle post-checkout refresh and success detection
    handlePostCheckout: async () => {
      const { fetchUsage } = get();
      
      // Check URL params for success/cancel status
      const urlParams = new URLSearchParams(window.location.search);
      const isSuccess = urlParams.has('success');
      const isCanceled = urlParams.has('canceled');
      
      if (isSuccess) {
        // Refresh usage data after successful purchase
        await fetchUsage();
        
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Could show success toast here
        console.log('✅ Purchase completed successfully');
      } else if (isCanceled) {
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log('❌ Purchase was canceled');
      }
    },
  })
);