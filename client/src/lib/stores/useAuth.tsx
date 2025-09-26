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
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string) => Promise<boolean>;
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

    login: async (username: string, password: string) => {
      set({ isLoading: true, error: null });
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          set({ 
            user: data.user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null 
          });
          console.log('🔐 User logged in:', data.user.username);
          return true;
        } else {
          set({ 
            error: data.error || 'Login failed', 
            isLoading: false 
          });
          return false;
        }
      } catch (error) {
        console.error('Login error:', error);
        set({ 
          error: 'Network error during login', 
          isLoading: false 
        });
        return false;
      }
    },

    register: async (username: string, password: string, email?: string) => {
      set({ isLoading: true, error: null });
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username, password, email }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          set({ 
            user: data.user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null 
          });
          console.log('👤 User registered:', data.user.username);
          return true;
        } else {
          set({ 
            error: data.error || 'Registration failed', 
            isLoading: false 
          });
          return false;
        }
      } catch (error) {
        console.error('Registration error:', error);
        set({ 
          error: 'Network error during registration', 
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
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
          set({ 
            user: data.user, 
            isAuthenticated: true,
            error: null 
          });
        } else {
          set({ 
            user: null, 
            isAuthenticated: false,
            error: null 
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
        set({ 
          user: null, 
          isAuthenticated: false,
          error: null 
        });
      }
    },

    clearError: () => set({ error: null }),
  }))
);