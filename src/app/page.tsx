
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/contexts/auth-context'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, PlusCircle, UserCircle, Mail, KeyRound, LogIn, UserPlus } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, ensureAnonymousSignIn, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth(); 

  const [joinCode, setJoinCode] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isProcessingEmailAuth, setIsProcessingEmailAuth] = useState(false);


  const generateSessionCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createSession = async (isAccountSession: boolean, userForSession?: FirebaseUser | null) => {
    setIsCreatingSession(true);
    
    let activeUser: FirebaseUser | null = userForSession !== undefined ? userForSession : user; 

    if (isAccountSession) {
      if (!activeUser || activeUser.isAnonymous) {
        toast({ title: "Sign-In Required", description: "Cannot create account-linked session without signing in first.", variant: "destructive" });
        setIsCreatingSession(false);
        return;
      }
    } else { 
      if (!activeUser) { 
        activeUser = await ensureAnonymousSignIn(); 
        if (!activeUser) {
          toast({ title: "Session Start Failed", description: "Could not start an anonymous session. Please try again.", variant: "destructive" });
          setIsCreatingSession(false);
          return;
        }
      }
    }
    
    if (!activeUser) { 
        toast({ title: "Authentication Error", description: "Fatal: Could not determine user for session creation.", variant: "destructive"});
        setIsCreatingSession(false);
        return;
    }

    const newSessionId = generateSessionCode();
    try {
      const sessionRef = doc(db, 'sessions', newSessionId);
      await setDoc(sessionRef, {
        adminUid: activeUser.uid,
        isRoundActive: true,
        likeClicks: 0,
        dislikeClicks: 0,
        createdAt: serverTimestamp(),
        sessionEnded: false,
        soundsEnabled: true,
        resultsVisible: true,
        participants: {},
        sessionType: isAccountSession ? 'account' : 'quick', 
        presenterQueue: [],
        currentPresenterIndex: -1,
        currentPresenterName: "",
        presenterScores: [], 
      });
      toast({ title: `${isAccountSession ? 'Account' : 'Quick'} Session Created!`, description: `Your session code is ${newSessionId}. Redirecting...` });
      router.push(`/session/${newSessionId}`);
    } catch (error) {
      console.error(`Error creating ${isAccountSession ? 'account' : 'quick'} session: `, error);
      toast({ title: "Error", description: "Could not create session. Please try again.", variant: "destructive" });
    }
    setIsCreatingSession(false);
  };
  
  const handleCreateQuickSession = () => createSession(false);

  const handleCreateAccountSession = async () => {
    if (user && !user.isAnonymous) {
      createSession(true, user);
      return;
    }

    toast({ 
      title: "Sign-In Required", 
      description: "Creating an account-linked session requires signing in. Please sign in with Google or Email first.",
      variant: "default" 
    });
  };


  const handleJoinSession = async () => {
    if (!joinCode.match(/^\d{6}$/)) {
      toast({ title: "Invalid Code", description: "Session code must be 6 digits.", variant: "destructive" });
      return;
    }
    setIsJoining(true);
    
    if (!user) { 
        const signedInUser = await ensureAnonymousSignIn();
        if (!signedInUser) {
            setIsJoining(false);
            return; 
        }
    }

    try {
      const sessionRef = doc(db, 'sessions', joinCode);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        if (sessionSnap.data()?.sessionEnded) {
          toast({ title: "Session Ended", description: "This session has already ended.", variant: "default" });
        } else {
          router.push(`/session/${joinCode}`);
        }
      } else {
        toast({ title: "Session Not Found", description: "Invalid session code. Please check and try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error joining session: ", error);
      toast({ title: "Error", description: "Could not join session. Please try again.", variant: "destructive" });
    }
    setIsJoining(false);
  };

  const handleSignUpWithEmail = async () => {
    if (!emailInput || !passwordInput) {
      toast({ title: "Missing Fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsProcessingEmailAuth(true);
    await signUpWithEmail(emailInput, passwordInput);
    setIsProcessingEmailAuth(false);
  };

  const handleSignInWithEmail = async () => {
    if (!emailInput || !passwordInput) {
      toast({ title: "Missing Fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsProcessingEmailAuth(true);
    await signInWithEmail(emailInput, passwordInput);
    setIsProcessingEmailAuth(false);
  };

  const createQuickButtonDisabled = isCreatingSession || authLoading;
  const createAccountButtonDisabled = isCreatingSession || authLoading || !(user && !user.isAnonymous);
  const emailAuthDisabled = isProcessingEmailAuth || authLoading;


  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 sm:p-12 md:p-16 bg-background">
      <div className="flex-grow flex flex-col items-center justify-center w-full space-y-8">
        <div className="flex flex-col items-center text-center mb-8">
           <Image
            src="/classvote-logo.png"
            alt="ClassVote Logo"
            width={400}
            height={80}
            priority
            data-ai-hint="logo abstract"
            className="self-center"
          />
          <p className="text-lg sm:text-xl text-muted-foreground mt-4">
            Rate presentations and provide feedback in real-time!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><PlusCircle className="mr-2 h-6 w-6 text-primary" />Create New Session</CardTitle>
              <CardDescription>Start a feedback session for presentations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleCreateQuickSession}
                className="w-full text-lg py-6"
                disabled={createQuickButtonDisabled}
              >
                {isCreatingSession && !createAccountButtonDisabled ? 'Creating...' : 'Quick Start (Anonymous)'}
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                No account needed. Core features for immediate use.
              </p>
              <Button
                onClick={handleCreateAccountSession}
                className="w-full text-lg py-6"
                variant="outline"
                disabled={createAccountButtonDisabled}
              >
                <UserCircle className="mr-2 h-5 w-5"/> 
                {(isCreatingSession && createAccountButtonDisabled) ? 'Processing...' : 'Create Account Session'}
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                Requires sign-in. Links sessions to your account (future features).
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><ArrowRight className="mr-2 h-6 w-6 text-primary" />Join Existing Session</CardTitle>
              <CardDescription>Enter a 6-digit code to join a session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="text-center text-lg h-12"
                maxLength={6}
              />
              <Button
                onClick={handleJoinSession}
                className="w-full text-lg py-6"
                disabled={isJoining || joinCode.length !== 6 || authLoading}
              >
                {isJoining ? 'Joining...' : 'Join Session'}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><Mail className="mr-2 h-6 w-6 text-primary" />Email Sign Up / Sign In</CardTitle>
              <CardDescription>Use your email and password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter your email"
                className="text-lg h-12"
                disabled={emailAuthDisabled || (user && !user.isAnonymous)}
              />
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                className="text-lg h-12"
                disabled={emailAuthDisabled || (user && !user.isAnonymous)}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSignUpWithEmail}
                  className="w-full text-md py-3"
                  variant="outline"
                  disabled={emailAuthDisabled || !emailInput || !passwordInput || (user && !user.isAnonymous)}
                >
                  <UserPlus className="mr-2 h-5 w-5"/>
                  {isProcessingEmailAuth ? 'Processing...' : 'Sign Up'}
                </Button>
                <Button
                  onClick={handleSignInWithEmail}
                  className="w-full text-md py-3"
                  disabled={emailAuthDisabled || !emailInput || !passwordInput || (user && !user.isAnonymous)}
                >
                  <LogIn className="mr-2 h-5 w-5"/>
                  {isProcessingEmailAuth ? 'Processing...' : 'Sign In'}
                </Button>
              </div>
               {user && !user.isAnonymous && (
                <p className="text-xs text-muted-foreground text-center">You are already signed in as {user.email || user.displayName}.</p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
      <footer className="w-full text-center p-4 text-sm text-muted-foreground">
        <div className="flex flex-col items-center space-y-1">
          <span>A</span>
          <Image
            src="/WEBSMITHSedu-logo.png"
            alt="WEBSMITHS education Logo"
            width={150}
            height={30}
            data-ai-hint="education logo"
          />
          <span>project.</span>
        </div>
      </footer>
    </main>
  );
}
