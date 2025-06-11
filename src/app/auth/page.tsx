
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, KeyRound, UserPlus, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  const handleAuthSuccess = () => {
    setIsProcessingAuth(false);
    // Redirect to homepage after successful authentication
    // Later, we can enhance this to redirect to a 'next' URL if provided
    router.push('/'); 
  };

  const handleGoogleAuth = async () => {
    setIsProcessingAuth(true);
    const signedInUser = await signInWithGoogle();
    if (signedInUser) {
      handleAuthSuccess();
    } else {
      setIsProcessingAuth(false); // Error toast is handled by AuthContext
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      toast({ title: "Missing Fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsProcessingAuth(true);
    const signedInUser = await signUpWithEmail(email, password);
    if (signedInUser) {
      handleAuthSuccess();
    } else {
      setIsProcessingAuth(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      toast({ title: "Missing Fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsProcessingAuth(true);
    const signedInUser = await signInWithEmail(email, password);
    if (signedInUser) {
      handleAuthSuccess();
    } else {
      setIsProcessingAuth(false);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground animate-pulse">Loading authentication status...</p>
      </main>
    );
  }

  if (user && !user.isAnonymous) {
    // If user is already signed in (non-anonymously), redirect them
    // This prevents signed-in users from seeing the auth page unnecessarily
    // Consider a small delay or a message before redirecting if instant redirect is jarring
    router.replace('/'); 
    return (
         <main className="flex min-h-screen flex-col items-center justify-center p-6">
            <p className="text-lg text-muted-foreground">You are already signed in. Redirecting...</p>
        </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl">Login or Sign Up</CardTitle>
          <CardDescription>Access your ClassVote account or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleGoogleAuth}
            className="w-full text-lg py-6"
            disabled={isProcessingAuth}
          >
            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
            {isProcessingAuth ? 'Processing...' : 'Continue with Google'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="text-lg h-12"
                disabled={isProcessingAuth}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="text-lg h-12"
                disabled={isProcessingAuth}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleEmailSignIn}
              variant="outline"
              className="w-full text-md py-5 sm:flex-1"
              disabled={isProcessingAuth || !email || !password}
            >
              <LogIn className="mr-2 h-5 w-5" />
              {isProcessingAuth ? 'Signing In...' : 'Sign In'}
            </Button>
            <Button
              onClick={handleEmailSignUp}
              className="w-full text-md py-5 sm:flex-1"
              disabled={isProcessingAuth || !email || !password}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              {isProcessingAuth ? 'Signing Up...' : 'Sign Up'}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-primary">
              Back to Homepage
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
