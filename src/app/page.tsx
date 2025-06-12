
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
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, PlusCircle, UserCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading, ensureAnonymousSignIn } = useAuth();

  const [joinCode, setJoinCode] = useState('');
  const [isProcessingSessionAction, setIsProcessingSessionAction] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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
        currentPresenterUid: null,
        presenterScores: [],
        isPermanentlySaved: false, // New field
      });
      toast({ title: `${isAccountSession ? 'Account' : 'Quick'} Session Created!`, description: `Your session code is ${newSessionId}. Participants join at classvote.online. Redirecting...` });
      router.push(`/session/${newSessionId}`);
    } catch (error) {
      console.error(`Error creating ${isAccountSession ? 'account' : 'quick'} session: `, error);
      toast({ title: "Error", description: "Could not create session. Please try again.", variant: "destructive" });
    }
    setIsProcessingSessionAction(false);
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
    // isProcessingSessionAction will be reset by createSession
  };

  const handleCreateAccountSession = () => {
    if (user && !user.isAnonymous) {
      createSession(true, user);
    } else {
      toast({ title: "Sign In Required", description: "Please sign in or sign up to create an account-linked session. Redirecting...", variant: "default" });
      router.push('/auth');
    }
  };

  const handleJoinSession = async () => {
    if (!joinCode.match(/^\d{6}$/)) {
      toast({ title: "Invalid Code", description: "Session code must be 6 digits.", variant: "destructive" });
      return;
    }
    setIsJoining(true);
    let activeUser = user;
    if (!activeUser) {
      activeUser = await ensureAnonymousSignIn();
      if (!activeUser) {
        setIsJoining(false);
        toast({ title: "Join Failed", description: "Could not establish a session to join. Please try again.", variant: "destructive" });
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Create Session Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><PlusCircle className="mr-2 h-6 w-6 text-primary" />Create New Session</CardTitle>
              <CardDescription>Start a feedback session. Tell participants to join at <strong className="text-primary">classvote.online</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(!user || user.isAnonymous) && (
                <>
                  <Button
                    onClick={handleCreateQuickSession}
                    className="w-full text-lg py-6"
                    disabled={!!(authLoading || (isProcessingSessionAction && (!user || user.isAnonymous)))}
                    title={authLoading ? "Loading user status..." : undefined}
                  >
                    {isProcessingSessionAction && (!user || user.isAnonymous) ? 'Processing...' : 'Quick Start (Anonymous)'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center px-2">
                    No account needed. Core features for immediate use.
                  </p>
                </>
              )}

              {/* Show Account Session button always, adjust variant based on user state */}
              <Button
                onClick={handleCreateAccountSession}
                className="w-full text-lg py-6"
                variant={(!user || user.isAnonymous) ? "outline" : "default"}
                disabled={!!(authLoading || (user && !user.isAnonymous && isProcessingSessionAction))}
                title={authLoading ? "Loading user status..." : (user && !user.isAnonymous && isProcessingSessionAction) ? "Processing..." : undefined}
              >
                <UserCircle className="mr-2 h-5 w-5"/>
                {(isProcessingSessionAction && user && !user.isAnonymous) ? 'Processing...' : 'Create Account Session'}
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                Links session to your account.
                {(!user || user.isAnonymous) && " Sign-in/up required."}
              </p>
            </CardContent>
          </Card>

          {/* Join Session Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center"><ArrowRight className="mr-2 h-6 w-6 text-primary" />Join Existing Session</CardTitle>
              <CardDescription>Enter a 6-digit code from your presenter. Make sure you are at <strong className="text-primary">classvote.online</strong></CardDescription>
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
        </div>
      </div>

      <footer className="w-full text-center p-4 text-sm text-muted-foreground mt-12">
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
