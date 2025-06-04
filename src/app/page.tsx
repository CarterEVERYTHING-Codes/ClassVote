
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; // auth is imported
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, PlusCircle } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateSession = async () => {
    setIsCreating(true);
    if (!auth.currentUser) {
      toast({ title: "Authentication Error", description: "Please wait for authentication to complete and try again.", variant: "destructive" });
      setIsCreating(false);
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
        createdAt: new Date(),
        sessionEnded: false, // Initialize sessionEnded flag
      });
      toast({ title: "Session Created!", description: `Your session code is ${newSessionId}. Redirecting...` });
      router.push(`/session/${newSessionId}`);
    } catch (error) {
      console.error("Error creating session: ", error);
      toast({ title: "Error", description: "Could not create session. Please try again.", variant: "destructive" });
      setIsCreating(false);
    }
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

  const createButtonDisabled = isCreating || isAuthLoading || !auth.currentUser;
  const createButtonText = () => {
    if (isAuthLoading || !auth.currentUser) return 'Authenticating...';
    if (isCreating) return 'Creating...';
    return 'Create Session';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-16 bg-background space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground mb-3 sm:mb-4">
          ClassVote
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Create or join a session to vote on sounds with others!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><PlusCircle className="mr-2 h-6 w-6 text-primary" />Create New Session</CardTitle>
            <CardDescription>Start a new voting session and invite others.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreateSession}
              className="w-full text-lg py-6"
              disabled={createButtonDisabled}
            >
              {createButtonText()}
            </Button>
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
    </main>
  );
}
