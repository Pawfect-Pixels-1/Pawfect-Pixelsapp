import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogIn, LogOut, User, History, CreditCard } from 'lucide-react'; // removed unused GraduationCap
import { useAuth } from '@/lib/stores/useAuth';
import { ReplitAuthDialog } from './ReplitAuthDialog';
import { TutorialQuickAccess } from './OnboardingFlow';

interface UserHeaderProps {
  onShowPricing?: () => void;
}

export function UserHeader({ onShowPricing }: UserHeaderProps) {
  const { user, isAuthenticated, logout, checkAuth } = useAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Check authentication status on mount (ignore exhaustive-deps; checkAuth is stable in our store)
  useEffect(() => {
    void checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const getUserInitials = (name?: string | null) => {
    if (!name) return 'US';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = (parts[1]?.[0] ?? parts[0]?.[1] ?? '').toUpperCase();
    return (first + second).toUpperCase().slice(0, 2) || 'US';
  };

  return (
    <>
      <div className="relative flex items-center justify-between mb-8">
        {/* Logo and Title */}
        <div className="text-center flex-1">
          <h1 className="font-header text-4xl font-black text-black mb-2">
            Portrait Studio
          </h1>
          {/* fixed invalid Tailwind class `text-Black-600` */}
          <p className="font-regular text-neutral-700 text-lg">
            Transform portraits and generate videos with AI
          </p>
        </div>

        {/* User Auth Section */}
        <div className="absolute top-4 right-4">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56" data-tutorial="user-menu">
                <DropdownMenuItem className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuItem className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Your Transformations
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onShowPricing?.()}
                  className="flex items-center gap-2"
                  data-tutorial="upgrade-button"
                >
                  <CreditCard className="h-4 w-4" />
                  Billing &amp; Credits
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Ensure this component renders menu-friendly items */}
                <TutorialQuickAccess />

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => setShowAuthDialog(true)}
              variant="outline"
              className="flex items-center gap-2 border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          )}
        </div>
      </div>

      <ReplitAuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
