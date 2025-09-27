import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loginWithReplit: () => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  subscribeWithSelector((set, _get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    loginWithReplit: async () => {
      set({ isLoading: true, error: null });
      
      try {
        // First check if we can initialize Replit Auth
        const initResponse = await fetch('/api/auth/init', {
          method: 'GET',
          credentials: 'include',
        });
        
        const initData = await initResponse.json();
        
        if (!initResponse.ok) {
          set({ 
            error: initData.error || 'Replit Auth not available', 
            isLoading: false 
          });
          return false;
        }

        // If initialization successful, proceed with authentication
        const authResponse = await fetch('/api/auth/replit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        const authData = await authResponse.json();
        
        if (authResponse.ok && authData.success) {
          set({ 
            user: authData.user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null 
          });
          console.log('🔐 User logged in with Replit Auth:', authData.user.username);
          
          // Navigate to dashboard after successful login
          if (typeof window !== 'undefined') {
            window.location.href = '/dashboard';
          }
          return true;
        } else {
          set({ 
            error: authData.error || authData.message || 'Replit authentication failed', 
            isLoading: false 
          });
          return false;
        }
      } catch (error) {
        console.error('Replit Auth error:', error);
        set({ 
          error: 'Network error during authentication', 
          isLoading: false 
        });
        return false;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
        
        if (response.ok) {
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null 
          });
          console.log('🔐 User logged out');
        } else {
          console.error('Logout failed');
          // Still clear local state even if server request failed
          set({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null 
          });
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Clear local state regardless of network error
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false,
          error: null 
        });
      }
    },

    checkAuth: async () => {
      set({ isLoading: true });
      
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
          set({ 
            user: data.user, 
            isAuthenticated: true,
            isLoading: false,
            error: null 
          });
        } else {
          set({ 
            user: null, 
            isAuthenticated: false,
            isLoading: false,
            error: null 
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
        console.error('Error fetching user data:', error);
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false,
          error: null 
        });
      }
    },

    clearError: () => set({ error: null }),
  }))
);