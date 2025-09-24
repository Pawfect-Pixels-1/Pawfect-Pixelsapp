import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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
  trialEndsAt: string | null;
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
  
  // Actions
  fetchUsage: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  createCheckoutSession: (type: 'subscription' | 'credits', planOrPack: string) => Promise<string | null>;
  refreshUsage: () => Promise<void>;
  deductCredits: (amount: number) => void;
}

export const useBilling = create<BillingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    usage: null,
    plans: {},
    creditPacks: [],
    isLoadingUsage: false,
    isLoadingPlans: false,
    isCreatingCheckout: false,

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
          set({ 
            plans: data.plans,
            creditPacks: data.creditPacks 
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
    createCheckoutSession: async (type: 'subscription' | 'credits', planOrPack: string) => {
      set({ isCreatingCheckout: true });
      try {
        const response = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ type, [type === 'subscription' ? 'plan' : 'creditPack']: planOrPack }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.url;
        } else {
          console.error('Failed to create checkout session');
          return null;
        }
      } catch (error) {
        console.error('Error creating checkout session:', error);
        return null;
      } finally {
        set({ isCreatingCheckout: false });
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
  }))
);