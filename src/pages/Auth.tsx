import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Flag, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, isLoading } = useAuth();
  
  // Check both hash params (normal navigation) AND window.location.search (Supabase redirects)
  const urlParams = new URLSearchParams(window.location.search);
  const hashModeIsReset = searchParams.get('mode') === 'reset';
  const queryModeIsReset = urlParams.get('mode') === 'reset';
  
  // Use ref to preserve initial value - won't change on re-renders
  const isResetFromUrl = useRef(hashModeIsReset || queryModeIsReset);
  
  // Initialize mode synchronously from URL to prevent race condition with redirect
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(() => {
    if (hashModeIsReset || queryModeIsReset) return 'reset';
    const hashMode = searchParams.get('mode');
    const queryMode = urlParams.get('mode');
    if (hashMode === 'signup' || queryMode === 'signup') return 'signup';
    if (hashMode === 'forgot' || queryMode === 'forgot') return 'forgot';
    return 'signin';
  });

  // Read round invite params from URL and persist to localStorage
  const inviteRoundId = searchParams.get('round_id') || urlParams.get('round_id');
  const invitePlayerName = searchParams.get('player_name') || urlParams.get('player_name');

  useEffect(() => {
    if (inviteRoundId) localStorage.setItem('fg_invite_round_id', inviteRoundId);
    if (invitePlayerName) localStorage.setItem('fg_invite_player_name', invitePlayerName);
  }, [inviteRoundId, invitePlayerName]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(invitePlayerName ? decodeURIComponent(invitePlayerName) : '');
  const [handicapIndex, setHandicapIndex] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handicapMethod, setHandicapMethod] = useState<'ghin' | 'manual'>('ghin');
  const [ghinNumber, setGhinNumber] = useState('');
  const [ghinSyncing, setGhinSyncing] = useState(false);
  const [showManualInfoDialog, setShowManualInfoDialog] = useState(false);

  const recoverySessionReady = useRef(false);

  // Reset-link verification state
  const [resetStatus, setResetStatus] = useState<'idle' | 'checking' | 'ready' | 'expired'>(
    () => (hashModeIsReset || queryModeIsReset) ? 'checking' : 'idle'
  );
  const verifyAttempted = useRef(false);

  // Verify the recovery token_hash on mount (or accept an existing recovery session
  // from the legacy ?code= PKCE flow). This runs only in the user's real browser, so
  // email scanners can't consume the token before they click.
  useEffect(() => {
    if (!isResetFromUrl.current || verifyAttempted.current) return;
    verifyAttempted.current = true;

    const run = async () => {
      const hashPart = window.location.hash.split('?')[1] || '';
      const hashSp = new URLSearchParams(hashPart);
      const tokenHash = hashSp.get('token_hash') || urlParams.get('token_hash');
      const type = (hashSp.get('type') || urlParams.get('type') || 'recovery') as 'recovery';
      const code = urlParams.get('code');

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          console.error('verifyOtp failed:', error);
          setResetStatus('expired');
          return;
        }
        recoverySessionReady.current = true;
        setMode('reset');
        setResetStatus('ready');
        const cleanHash = window.location.hash.split('?')[0] + '?mode=reset';
        window.history.replaceState({}, '', window.location.pathname + cleanHash);
        return;
      }

      if (code) {
        for (let i = 0; i < 20; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            recoverySessionReady.current = true;
            setMode('reset');
            setResetStatus('ready');
            return;
          }
          await new Promise(r => setTimeout(r, 300));
        }
        setResetStatus('expired');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        recoverySessionReady.current = true;
        setMode('reset');
        setResetStatus('ready');
      } else {
        setResetStatus('expired');
      }
    };

    run();
  }, []);

  // Listen for PASSWORD_RECOVERY event (covers any path that fires it)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isResetFromUrl.current)) {
        recoverySessionReady.current = true;
        setMode('reset');
        setResetStatus('ready');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect if already logged in (but not in reset mode or if arrived via reset link)
  useEffect(() => {
    if (user && !isLoading && mode !== 'reset' && !isResetFromUrl.current) {
      navigate('/');
    }
  }, [user, isLoading, navigate, mode]);

  const sendWelcomeEmail = async (userEmail: string, userName: string) => {
    try {
      const response = await supabase.functions.invoke('send-welcome-email', {
        body: { email: userEmail, displayName: userName }
      });
      
      if (response.error) {
        console.error('Failed to send welcome email:', response.error);
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Call edge function that generates reset link and sends branded email
      const { error } = await supabase.functions.invoke('generate-reset-link', {
        body: { email, origin: window.location.origin }
      });

      if (error) {
        toast.error(error.message || 'Failed to send reset email');
      } else {
        toast.success('Check your email for a password reset link!');
        setMode('signin');
      }
    } catch (error: any) {
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetConfirmError, setResetConfirmError] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError(null);
    setResetConfirmError(null);

    // Inline validation
    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) {
      setResetPasswordError(pwResult.error.errors[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetConfirmError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure we have an active session (PKCE code exchange may still be in flight)
      let { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 500));
          const retry = await supabase.auth.getSession();
          currentSession = retry.data.session;
          if (currentSession) break;
        }
      }

      if (!currentSession) {
        toast.error('This reset link has expired. Request a new one from Forgot Password.');
        setMode('forgot');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        if (error.message.toLowerCase().includes('session') || error.message.toLowerCase().includes('token') || error.message.toLowerCase().includes('auth')) {
          toast.error('This reset link has expired. Request a new one from Forgot Password.');
          setMode('forgot');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Password updated. You can now sign in with your new password.', { duration: 5000 });
        setNewPassword('');
        setConfirmPassword('');
        await supabase.auth.signOut();
        setMode('signin');
        navigate('/auth?mode=signin');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    if (mode === 'signup' && !displayName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
          navigate('/');
        }
      } else {
        const hcap = parseFloat(handicapIndex) || 0;

        const { error } = await signUp(email, password, displayName.trim(), hcap);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in.');
          } else {
            toast.error(error.message);
          }
        } else {
          // Suppress GHIN prompt for all new signups
          localStorage.setItem('fg_ghin_prompt_dismissed', 'true');

          // Send welcome email
          await sendWelcomeEmail(email, displayName.trim());

          // If GHIN was provided, sync AFTER signup when session exists
          if (handicapMethod === 'ghin' && ghinNumber.trim()) {
            setGhinSyncing(true);
            try {
              // Wait briefly for session to be established
              await new Promise(resolve => setTimeout(resolve, 1500));
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const { data: ghinData, error: ghinError } = await supabase.functions.invoke('sync-ghin-handicap', {
                  body: { ghin_number: ghinNumber.trim(), update_profile: true }
                });
                if (ghinError || ghinData?.error) {
                  toast.warning('Account created! GHIN sync failed — you can link it later in Edit Profile.');
                } else {
                  toast.success('Account created with GHIN linked! Check your email.');
                }
              } else {
                toast.warning('Account created! GHIN sync will complete on next sign-in.');
              }
            } catch {
              toast.warning('Account created! GHIN sync failed — you can link it later in Edit Profile.');
            } finally {
              setGhinSyncing(false);
            }
          } else {
            toast.success('Account created! Check your email for your login details.');
            if (handicapMethod === 'manual') {
              setShowManualInfoDialog(true);
            }
          }
          navigate('/');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'signin': return 'Welcome back!';
      case 'signup': return 'Create your account';
      case 'forgot': return 'Reset your password';
      case 'reset': return 'Set new password';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flag className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-dark">
            F&Gs <span className="text-primary">All Day</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {getModeTitle()}
          </p>
        </div>

        {/* Reset link: checking */}
        {isResetFromUrl.current && resetStatus === 'checking' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Opening your reset link…</p>
          </div>
        )}

        {/* Reset link: expired */}
        {isResetFromUrl.current && resetStatus === 'expired' && (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              This reset link has expired or has already been used. Request a new one below.
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                setResetStatus('idle');
                isResetFromUrl.current = false;
                setMode('forgot');
                navigate('/auth?mode=forgot');
              }}
            >
              Request a new reset link
            </Button>
          </div>
        )}

        {/* Reset Password Form */}
        {mode === 'reset' && resetStatus === 'ready' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setResetPasswordError(null); }}
                required
                autoComplete="new-password"
                aria-invalid={!!resetPasswordError}
              />
              {resetPasswordError && (
                <p className="text-sm text-destructive">{resetPasswordError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setResetConfirmError(null); }}
                required
                autoComplete="new-password"
                aria-invalid={!!resetConfirmError}
              />
              {resetConfirmError && (
                <p className="text-sm text-destructive">{resetConfirmError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Update Password'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Send Reset Link'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* Sign In / Sign Up Form */}
        {(mode === 'signin' || mode === 'signup') && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>

              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Your Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="John Smith"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Handicap</Label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setHandicapMethod('ghin')}
                        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                          handicapMethod === 'ghin'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        Link GHIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setHandicapMethod('manual')}
                        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                          handicapMethod === 'manual'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        Enter manually
                      </button>
                    </div>

                    {handicapMethod === 'ghin' ? (
                      <Input
                        id="ghinNumber"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{5,9}"
                        placeholder="GHIN # (e.g. 1234567)"
                        value={ghinNumber}
                        onChange={(e) => setGhinNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      />
                    ) : (
                      <Input
                        id="handicap"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 12.4 (optional)"
                        value={handicapIndex}
                        onChange={(e) => setHandicapIndex(e.target.value)}
                      />
                    )}
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || ghinSyncing}
              >
                {isSubmitting || ghinSyncing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {ghinSyncing ? 'Verifying GHIN...' : ''}
                  </span>
                ) : mode === 'signin' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            {/* Forgot Password Link */}
            {mode === 'signin' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {/* Toggle mode */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-primary hover:underline"
              >
                {mode === 'signin'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Info dialog for manual handicap entry */}
      <Dialog open={showManualInfoDialog} onOpenChange={setShowManualInfoDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>No Problem!</DialogTitle>
            <DialogDescription>
              You can always link your GHIN later by selecting <strong>Edit Profile</strong> from the menu.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowManualInfoDialog(false)} className="w-full">
            Got It
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
