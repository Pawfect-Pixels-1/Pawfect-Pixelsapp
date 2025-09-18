import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/lib/stores/useAuth';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoginFormData {
  username: string;
  password: string;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { login, register, isLoading, error, clearError } = useAuth();

  // Login form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLogin,
  } = useForm<LoginFormData>();

  // Register form
  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors },
    reset: resetRegister,
    watch,
  } = useForm<RegisterFormData>();

  const watchPassword = watch('password');

  // Clear errors when switching tabs or dialog opens/closes
  useEffect(() => {
    if (open) {
      clearError();
    }
  }, [open, activeTab, clearError]);

  const onLoginSubmit = async (data: LoginFormData) => {
    const success = await login(data.username, data.password);
    if (success) {
      onOpenChange(false);
      resetLogin();
    }
  };

  const onRegisterSubmit = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      return; // Form validation will handle this
    }
    
    const success = await register(data.username, data.password, data.email);
    if (success) {
      onOpenChange(false);
      resetRegister();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Portrait Studio</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Login</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              
              <form onSubmit={handleLoginSubmit(onLoginSubmit)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-username"
                        type="text"
                        placeholder="Enter your username"
                        className="pl-10"
                        {...registerLogin('username', {
                          required: 'Username is required',
                          minLength: { value: 3, message: 'Username must be at least 3 characters' }
                        })}
                      />
                    </div>
                    {loginErrors.username && (
                      <p className="text-sm text-destructive">{loginErrors.username.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-10"
                        {...registerLogin('password', {
                          required: 'Password is required'
                        })}
                      />
                    </div>
                    {loginErrors.password && (
                      <p className="text-sm text-destructive">{loginErrors.password.message}</p>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Create Account</CardTitle>
                <CardDescription>
                  Sign up to save your transformations and access your history
                </CardDescription>
              </CardHeader>
              
              <form onSubmit={handleRegisterSubmit(onRegisterSubmit)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="Choose a username"
                        className="pl-10"
                        {...registerRegister('username', {
                          required: 'Username is required',
                          minLength: { value: 3, message: 'Username must be at least 3 characters' },
                          pattern: {
                            value: /^[a-zA-Z0-9_]+$/,
                            message: 'Username can only contain letters, numbers, and underscores'
                          }
                        })}
                      />
                    </div>
                    {registerErrors.username && (
                      <p className="text-sm text-destructive">{registerErrors.username.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email (optional)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your.email@example.com"
                        className="pl-10"
                        {...registerRegister('email', {
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address'
                          }
                        })}
                      />
                    </div>
                    {registerErrors.email && (
                      <p className="text-sm text-destructive">{registerErrors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a secure password"
                        className="pl-10"
                        {...registerRegister('password', {
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Password must be at least 6 characters' }
                        })}
                      />
                    </div>
                    {registerErrors.password && (
                      <p className="text-sm text-destructive">{registerErrors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-confirm-password"
                        type="password"
                        placeholder="Confirm your password"
                        className="pl-10"
                        {...registerRegister('confirmPassword', {
                          required: 'Please confirm your password',
                          validate: (value) => value === watchPassword || 'Passwords do not match'
                        })}
                      />
                    </div>
                    {registerErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{registerErrors.confirmPassword.message}</p>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}