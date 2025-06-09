"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, PlusCircle, UserPlus } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const generateSessionCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreateQuickSession = async () => {
    setIsCreatingQuick(true);
    if (!auth.currentUser) {
      toast({ title: "Authentication Error", description: "Please wait for authentication to complete and try again.", variant: "destructive" });
      setIsCreatingQuick(false);
      return;
    }

    const newSessionId = generateSessionCode();
    try {
      const sessionRef = doc(db, 'sessions', newSessionId);
      await setDoc(sessionRef, {
        adminUid: auth.currentUser.uid,
        isRoundActive: true,
        likeClicks: 0,
        dislikeClicks: 0,
        createdAt: serverTimestamp(), // Use serverTimestamp for consistency
        sessionEnded: false,
        soundsEnabled: true,
        resultsVisible: true,
        participants: {},
        sessionType: 'quick',
        presenterQueue: [],
        currentPresenterIndex: -1,
        currentPresenterName: "",
      });
      toast({ title: "Quick Session Created!", description: `Your session code is ${newSessionId}. Redirecting...` });
      router.push(`/session/${newSessionId}`);
    } catch (error) {
      console.error("Error creating quick session: ", error);
      toast({ title: "Error", description: "Could not create session. Please try again.", variant: "destructive" });
      setIsCreatingQuick(false);
    }
  };

  const handleCreateWithAccountPlaceholder = () => {
    toast({
      title: "Coming Soon!",
      description: "Account-based sessions with full features are under development. Please use 'Quick Session' for now.",
      duration: 5000,
    });
  };

  const handleJoinSession = async () => {
    if (!joinCode.match(/^\d{6}$/)) {
      toast({ title: "Invalid Code", description: "Session code must be 6 digits.", variant: "destructive" });
      return;
    }
    setIsJoining(true);
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

  const createQuickButtonDisabled = isCreatingQuick || isAuthLoading || !auth.currentUser;
  const createQuickButtonText = () => {
    if (isAuthLoading || !auth.currentUser) return 'Authenticating...';
    if (isCreatingQuick) return 'Creating...';
    return 'Quick Start (No Account)';
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
          <Card className="shadow-lg">
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
                {createQuickButtonText()}
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                No account needed. Core features for immediate use.
              </p>
              <Button
                onClick={handleCreateWithAccountPlaceholder}
                className="w-full text-lg py-6"
                variant="outline"
                disabled={isAuthLoading}
              >
                <UserPlus className="mr-2 h-5 w-5"/> Full Features (Account)
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2">
                Sign in (coming soon!) for advanced features like saving session setups.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
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
                disabled={isJoining || joinCode.length !== 6}
              >
                {isJoining ? 'Joining...' : 'Join Session'}
              </Button>
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