
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader'; // Will be adapted to pass sessionId
import Leaderboard from '@/components/leaderboard'; // Will be adapted to use sessionId
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SessionData {
  adminUid: string;
  isRoundActive: boolean;
  likeClicks: number;
  dislikeClicks: number;
  createdAt: any; // Firestore timestamp
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { toast } = useToast();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        if (auth.currentUser) {
          setIsCurrentUserAdmin(auth.currentUser.uid === data.adminUid);
        }
        setError(null);
      } else {
        setSessionData(null);
        setError("Session not found or has been ended. You will be redirected.");
        toast({ title: "Session Ended", description: "This session no longer exists.", variant: "destructive" });
        setTimeout(() => router.push('/'), 3000);
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching session data: ", err);
      setError("Error loading session. Please try again.");
      toast({ title: "Error", description: "Could not load session data.", variant: "destructive" });
      setIsLoading(false);
    });

    // Check for auth state changes for admin status
    const authUnsubscribe = auth.onAuthStateChanged(user => {
      if (user && sessionData) {
        setIsCurrentUserAdmin(user.uid === sessionData.adminUid);
      } else {
        setIsCurrentUserAdmin(false);
      }
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
    };
  }, [sessionId, router, toast, sessionData]); // Added sessionData to re-check admin on data load


  const handleToggleRound = async () => {
    if (!sessionData || !isCurrentUserAdmin) return;
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { isRoundActive: !sessionData.isRoundActive });
      // Reset local storage for all users when round toggles (new round starts or old one stops)
      localStorage.removeItem(`hasVoted_${sessionId}`);
      toast({ title: "Round Status Updated", description: `Round is now ${!sessionData.isRoundActive ? 'active' : 'stopped'}. Player votes reset.` });
    } catch (error) {
      console.error("Error toggling round: ", error);
      toast({ title: "Error", description: "Could not update round status.", variant: "destructive" });
    }
  };
  
  const handleClearScores = async () => {
    if (!sessionData || !isCurrentUserAdmin) return;
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { likeClicks: 0, dislikeClicks: 0 });
      localStorage.removeItem(`hasVoted_${sessionId}`); // Also reset votes
      toast({ title: "Scores Cleared", description: "Session scores have been reset. Player votes reset." });
    } catch (error) {
      console.error("Error clearing scores: ", error);
      toast({ title: "Error", description: "Could not clear scores.", variant: "destructive" });
    }
  };

  const handleEndSession = async () => {
    if (!isCurrentUserAdmin) return;
    if (!window.confirm("Are you sure you want to end this session? This action cannot be undone.")) return;
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await deleteDoc(sessionDocRef);
      toast({ title: "Session Ended", description: "The session has been closed." });
      // router.push('/'); // Will redirect via snapshot listener
    } catch (error) {
      console.error("Error ending session: ", error);
      toast({ title: "Error", description: "Could not end session.", variant: "destructive" });
    }
  };

  const copySessionCode = () => {
    navigator.clipboard.writeText(sessionId)
      .then(() => toast({ title: "Session Code Copied!", description: sessionId }))
      .catch(() => toast({ title: "Copy Failed", description: "Could not copy code.", variant: "destructive"}));
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-40 w-full max-w-md mb-8" />
        <div className="flex space-x-4 mb-8">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-32" />
        </div>
        <Skeleton className="h-60 w-full max-w-md" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Session Error</h1>
        <p className="text-muted-foreground">{error}</p>
         <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            <Home className="mr-2" /> Go to Homepage
        </Button>
      </main>
    );
  }

  if (!sessionData) {
     // Should be covered by error state, but as a fallback
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p>Session data not available.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 sm:p-12 md:p-16 bg-background space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground">
            Session: {sessionId}
          </h1>
          <Button onClick={copySessionCode} variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-foreground">
            <Copy className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-lg sm:text-xl text-muted-foreground">
          Press a button to cast your vote!
        </p>
      </div>
      
      <Leaderboard sessionId={sessionId} />
      
      <div className="mt-8">
        <GoodBadButtonsLoader sessionId={sessionId} isRoundActive={sessionData.isRoundActive} />
      </div>

      {isCurrentUserAdmin && (
        <Card className="w-full max-w-md shadow-lg mt-12">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
              <ShieldAlert className="mr-2 h-6 w-6" /> Admin Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             <p className="text-sm text-center font-medium">
                Round Status: <span className={sessionData.isRoundActive ? "text-green-500" : "text-red-500"}>{sessionData.isRoundActive ? 'ACTIVE' : 'STOPPED'}</span>
              </p>
            <Button onClick={handleToggleRound} variant="outline" className="w-full">
              {sessionData.isRoundActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
              {sessionData.isRoundActive ? 'Stop Round' : 'Start Round & Reset Votes'}
            </Button>
            <Button onClick={handleClearScores} variant="outline" className="w-full">
              <RotateCcw className="mr-2" /> Clear Scores & Reset Votes
            </Button>
            <Button onClick={handleEndSession} variant="destructive" className="w-full">
              <Trash2 className="mr-2" /> End Session
            </Button>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full mt-4">
                <Home className="mr-2" /> Go to Homepage
            </Button>
          </CardContent>
        </Card>
      )}
       {!isCurrentUserAdmin && (
         <Button onClick={() => router.push('/')} variant="outline" className="mt-12">
            <Home className="mr-2" /> Leave Session
        </Button>
       )}
    </main>
  );
}
