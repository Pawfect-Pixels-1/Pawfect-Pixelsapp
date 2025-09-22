import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ShareEvent {
  id: string;
  contentUrl: string;
  contentType: 'image' | 'video';
  platform: string;
  timestamp: Date;
  title?: string;
  description?: string;
}

interface SharingState {
  shareHistory: ShareEvent[];
  totalShares: number;
  addShareEvent: (event: Omit<ShareEvent, 'id' | 'timestamp'>) => void;
  getSharesByPlatform: () => Record<string, number>;
  getSharesByContentType: () => Record<string, number>;
  clearHistory: () => void;
}

export const useSharing = create<SharingState>()(
  subscribeWithSelector(
    (set, get) => ({
      shareHistory: [],
      totalShares: 0,

      addShareEvent: (event) => {
        const shareEvent: ShareEvent = {
          ...event,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };

        set((state) => ({
          shareHistory: [shareEvent, ...state.shareHistory],
          totalShares: state.totalShares + 1,
        }));

        // Log share event for analytics
        console.log('📊 Share event:', shareEvent);
      },

      getSharesByPlatform: () => {
        const { shareHistory } = get();
        return shareHistory.reduce((acc, share) => {
          acc[share.platform] = (acc[share.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      },

      getSharesByContentType: () => {
        const { shareHistory } = get();
        return shareHistory.reduce((acc, share) => {
          acc[share.contentType] = (acc[share.contentType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      },

      clearHistory: () => {
        set({ shareHistory: [], totalShares: 0 });
      },
    })
  )
);