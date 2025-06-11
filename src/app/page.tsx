
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, PlusCircle, UserCircle, Mail, KeyRound, LogIn, UserPlus, AlertTriangle, LogOut } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, ensureAnonymousSignIn, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();

  const [joinCode, setJoinCode] = useState('');
  const [isProcessingSessionAction, setIsProcessingSessionAction] = useState(false); // General purpose for session creation/joining
  const [isJoining, setIsJoining] = useState(false);

  // State for new dialogs
  const [showSignInPromptDialog, setShowSignInPromptDialog] = useState(false);
  const [showEmailAuthDialog, setShowEmailAuthDialog] = useState(false);
  const [emailAuthActionType, setEmailAuthActionType] = useState<'signIn' | 'signUp' | null>(null); // For email dialog
  const [triggeredByCreateAccount, setTriggeredByCreateAccount] = useState(false); // To know if auth dialog was opened via "Create Account Session"

  // State for email/password inputs (now primarily for the dialog)
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isProcessingAuth, setIsProcessingAuth] = useState(false); // For any auth operation

  const generateSessionCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createSession = async (isAccountSession: boolean, userForSession: FirebaseUser) => {
    if (!userForSession) {
        toast({ title: "Authentication Error", description: "Cannot create session without a user.", variant: "destructive"});
        return;
    }
    setIsProcessingSessionAction(true);
    const newSessionId = generateSessionCode();
    try {
      const sessionRef = doc(db, 'sessions', newSessionId);
      await setDoc(sessionRef, {
        adminUid: userForSession.uid,
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
    setIsProcessingSessionAction(false);
    // Close any open auth dialogs
    setShowSignInPromptDialog(false);
    setShowEmailAuthDialog(false);
  };

  const handleCreateQuickSession = async () => {
    setIsProcessingSessionAction(true);
    let activeUser = user;
    if (!activeUser) {
      activeUser = await ensureAnonymousSignIn();
      if (!activeUser) {
        toast({ title: "Session Start Failed", description: "Could not start an anonymous session. Please try again.", variant: "destructive" });
        setIsProcessingSessionAction(false);
        return;
      }
    }
    await createSession(false, activeUser);
    setIsProcessingSessionAction(false);
  };

  const handleCreateAccountSession = () => {
    if (user && !user.isAnonymous) {
      createSession(true, user);
    } else {
      setTriggeredByCreateAccount(true);
      setShowSignInPromptDialog(true);
    }
  };

  const handleJoinSession = async () => {
    if (!joinCode.match(/^\d{6}$/)) {
      toast({ title: "Invalid Code", description: "Session code must be 6 digits.", variant: "destructive" });
      return;
    }
    setIsJoining(true); // Use dedicated state for joining
    let activeUser = user;
    if (!activeUser) {
      activeUser = await ensureAnonymousSignIn();
      if (!activeUser) {
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

  const handleGoogleSignInAndPotentiallyCreateSession = async () => {
    setIsProcessingAuth(true);
    const signedInUser = await signInWithGoogle();
    if (signedInUser) {
      if (triggeredByCreateAccount) {
        await createSession(true, signedInUser);
        setTriggeredByCreateAccount(false); // Reset flag
      }
      setShowSignInPromptDialog(false); // Close prompt dialog regardless
    }
    setIsProcessingAuth(false);
  };

  const openEmailAuthDialogForAction = (action: 'signIn' | 'signUp', fromCreateAccount: boolean) => {
    setEmailAuthActionType(action);
    setTriggeredByCreateAccount(fromCreateAccount); // Set if email auth is for creating a session
    setShowEmailAuthDialog(true);
    setShowSignInPromptDialog(false); // Close the prompt dialog if it was open
  };

  const handleEmailAuthSubmit = async () => {
    if (!emailInput || !passwordInput || !emailAuthActionType) {
      toast({ title: "Missing Fields", description: "Please enter both email and password.", variant: "destructive" });
      return;
    }
    setIsProcessingAuth(true);
    let signedInUser: FirebaseUser | null = null;
    if (emailAuthActionType === 'signUp') {
      signedInUser = await signUpWithEmail(emailInput, passwordInput);
    } else {
      signedInUser = await signInWithEmail(emailInput, passwordInput);
    }

    if (signedInUser) {
      if (triggeredByCreateAccount) {
        await createSession(true, signedInUser);
      }
      setShowEmailAuthDialog(false);
      setEmailInput('');
      setPasswordInput('');
      setTriggeredByCreateAccount(false); // Reset flag
    }
    setIsProcessingAuth(false);
  };
  
  // Effect to reset triggeredByCreateAccount if dialogs are closed manually
  useEffect(() => {
    if (!showSignInPromptDialog && !showEmailAuthDialog) {
      setTriggeredByCreateAccount(false);
    }
  }, [showSignInPromptDialog, showEmailAuthDialog]);


  const quickStartDisabled = isProcessingSessionAction || authLoading;
  // "Create Account Session" button itself is not disabled by auth state now, only by ongoing session action or auth loading
  const createAccountButtonDisabled = isProcessingSessionAction || authLoading;


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
          {/* Create Session Card */}
          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><PlusCircle className="mr-2 h-6 w-6 text-primary" />Create New Session</CardTitle>
              <CardDescription>Start a feedback session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleCreateQuickSession}
                className="w-full text-lg py-6"
                disabled={quickStartDisabled}
              >
                {isProcessingSessionAction && !triggeredByCreateAccount ? 'Processing...' : 'Quick Start (Anonymous)'}
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
                {(isProcessingSessionAction && triggeredByCreateAccount) ? 'Processing...' : 'Create Account Session'}
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                Links session to your account (future features). Sign-in required.
              </p>
            </CardContent>
          </Card>

          {/* Join Session Card */}
          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><ArrowRight className="mr-2 h-6 w-6 text-primary" />Join Existing Session</CardTitle>
              <CardDescription>Enter a 6-digit code to join.</CardDescription>
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

          {/* Manage Account Card */}
          <Card className="shadow-lg lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><UserCircle className="mr-2 h-6 w-6 text-primary" />Manage Account</CardTitle>
              {user && !user.isAnonymous ? (
                <CardDescription>You are signed in as {user.displayName || user.email}.</CardDescription>
              ) : user && user.isAnonymous ? (
                <CardDescription>You are currently a Guest. Sign in/up for account features.</CardDescription>
              ) : (
                <CardDescription>Sign in or create an account.</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {(!user || user.isAnonymous) && (
                <>
                  <Button
                    onClick={handleGoogleSignInAndPotentiallyCreateSession}
                    className="w-full text-md py-3"
                    disabled={isProcessingAuth || authLoading}
                  >
                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                    {isProcessingAuth ? 'Processing...' : 'Sign In / Sign Up with Google'}
                  </Button>
                  <Button
                    onClick={() => openEmailAuthDialogForAction('signIn', false)}
                    className="w-full text-md py-3"
                    variant="outline"
                    disabled={isProcessingAuth || authLoading}
                  >
                    <Mail className="mr-2 h-5 w-5"/>
                    Sign In / Sign Up with Email
                  </Button>
                </>
              )}
              {user && !user.isAnonymous && (
                 <p className="text-sm text-center text-muted-foreground">
                   Use the global header to sign out.
                 </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sign-In Prompt Dialog (for Create Account Session) */}
      <Dialog open={showSignInPromptDialog} onOpenChange={(isOpen) => {
          setShowSignInPromptDialog(isOpen);
          if (!isOpen) setTriggeredByCreateAccount(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-6 w-6 text-primary" />Sign-In Required</DialogTitle>
            <DialogDescription>
              To create an account-linked session, please sign in or sign up first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              onClick={handleGoogleSignInAndPotentiallyCreateSession}
              className="w-full text-lg py-6"
              disabled={isProcessingAuth}
            >
              <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
              {isProcessingAuth ? 'Processing...' : 'Sign In / Sign Up with Google'}
            </Button>
            <Button
              onClick={() => openEmailAuthDialogForAction('signIn', true)}
              variant="outline"
              className="w-full text-lg py-6"
              disabled={isProcessingAuth}
            >
              <Mail className="mr-2 h-5 w-5"/>
              Sign In / Sign Up with Email
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Authentication Dialog */}
      <Dialog open={showEmailAuthDialog} onOpenChange={(isOpen) => {
          setShowEmailAuthDialog(isOpen);
          if (!isOpen) {
            setTriggeredByCreateAccount(false);
            setEmailInput(''); // Clear inputs on close
            setPasswordInput('');
          }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
                {emailAuthActionType === 'signUp' ? <UserPlus className="mr-2 h-6 w-6 text-primary"/> : <LogIn className="mr-2 h-6 w-6 text-primary"/>}
                {emailAuthActionType === 'signUp' ? 'Sign Up with Email' : 'Sign In with Email'}
            </DialogTitle>
            <DialogDescription>
              {emailAuthActionType === 'signUp' ? 'Create a new account.' : 'Sign in to your existing account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter your email"
              className="text-lg h-12"
              disabled={isProcessingAuth}
            />
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter your password"
              className="text-lg h-12"
              disabled={isProcessingAuth}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isProcessingAuth}>Cancel</Button>
            </DialogClose>
            <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
                 <Button
                    onClick={() => {
                        setEmailAuthActionType('signUp'); // Explicitly set for clarity if user switches
                        handleEmailAuthSubmit();
                    }}
                    variant={emailAuthActionType === 'signUp' ? 'default' : 'outline'}
                    className="w-full sm:w-auto"
                    disabled={isProcessingAuth || !emailInput || !passwordInput}
                  >
                    <UserPlus className="mr-2 h-5 w-5"/>
                    {isProcessingAuth && emailAuthActionType === 'signUp' ? 'Processing...' : 'Sign Up'}
                  </Button>
                  <Button
                     onClick={() => {
                        setEmailAuthActionType('signIn'); // Explicitly set
                        handleEmailAuthSubmit();
                    }}
                    variant={emailAuthActionType === 'signIn' ? 'default' : 'outline'}
                    className="w-full sm:w-auto"
                    disabled={isProcessingAuth || !emailInput || !passwordInput}
                  >
                    <LogIn className="mr-2 h-5 w-5"/>
                    {isProcessingAuth && emailAuthActionType === 'signIn' ? 'Processing...' : 'Sign In'}
                  </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

    