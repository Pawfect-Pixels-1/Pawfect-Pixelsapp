import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, Shield, Zap, Users } from 'lucide-react';
import { useAuth } from '@/lib/stores/useAuth';

interface ReplitAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplitAuthDialog({ open, onOpenChange }: ReplitAuthDialogProps) {
  const { loginWithReplit, isLoading, error, clearError } = useAuth();

  // Clear errors when dialog opens/closes
  useEffect(() => {
    if (open) {
      clearError();
    }
  }, [open, clearError]);

  const handleReplitAuth = async () => {
    const success = await loginWithReplit();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Sign in with Replit Auth
          </DialogTitle>
          <DialogDescription>
            Use Replit's secure authentication to access Portrait Studio
          </DialogDescription>
        </DialogHeader>

        <Card className="border-0 shadow-none">
          <CardContent className="space-y-4 pt-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Instant authentication with your Replit account</span>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Seamlessly integrated with Replit workspace</span>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="pt-0">
            <Button
              onClick={handleReplitAuth}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Continue with Replit Auth
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <div className="text-xs text-gray-500 text-center">
          By signing in, you agree to use Replit's authentication system
        </div>
      </DialogContent>
    </Dialog>
  );
}