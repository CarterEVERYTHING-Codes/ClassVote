
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SessionData {
  adminUid: string;
  isRoundActive: boolean;
  likeClicks: number;
  dislikeClicks: number;
  createdAt: any; // Firestore timestamp
  sessionEnded: boolean; // New field
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
  const [isProcessingAdminAction, setIsProcessingAdminAction] = useState(false);

  useEffect(() => {
    if (!sessionId) {
        setIsLoading(false);
        setError("No session ID provided.");
        return;
    }

    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubscribeFirestore = onSnapshot(sessionDocRef, (docSnap) => {
      setIsLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data); // Set session data regardless of sessionEnded status for UI elements like session ID copy

        if (auth.currentUser) {
          setIsCurrentUserAdmin(auth.currentUser.uid === data.adminUid);
        } else {
          setIsCurrentUserAdmin(false);
        }

        if (data.sessionEnded) {
          setError("This session has ended.");
          // Admin would have already been redirected. Non-admins see the error.
        } else {
          setError(null); // Clear any previous errors if session now exists and is not ended
        }
      } else {
        setSessionData(null);
        setIsCurrentUserAdmin(false);
        setError("This session cannot be found.");
        // No automatic redirect here for non-admins
      }
    }, (err) => {
      console.error("Error fetching session data: ", err);
      setError("Error loading session. Please try again.");
      toast({ title: "Error", description: "Could not load session data.", variant: "destructive" });
      setIsLoading(false);
    });

    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setSessionData(currentSessionData => {
        if (user && currentSessionData) {
          setIsCurrentUserAdmin(user.uid === currentSessionData.adminUid);
        } else if (!user) {
          setIsCurrentUserAdmin(false);
        }
        return currentSessionData;
      });
    });

    return () => {
      unsubscribeFirestore();
      unsubscribeAuth();
    };
  }, [sessionId, router, toast]);


  const handleToggleRound = async () => {
    if (!sessionData || !isCurrentUserAdmin || sessionData.sessionEnded || isProcessingAdminAction) return;
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { isRoundActive: !sessionData.isRoundActive });
      localStorage.removeItem(`hasVoted_${sessionId}`);
      toast({ title: "Round Status Updated", description: `Round is now ${!sessionData.isRoundActive ? 'active' : 'stopped'}. Player votes reset.` });
    } catch (error) {
      console.error("Error toggling round: ", error);
      toast({ title: "Error", description: "Could not update round status.", variant: "destructive" });
    }
    setIsProcessingAdminAction(false);
  };
  
  const handleClearScores = async () => {
    if (!sessionData || !isCurrentUserAdmin || sessionData.sessionEnded || isProcessingAdminAction) return;
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { likeClicks: 0, dislikeClicks: 0 });
      localStorage.removeItem(`hasVoted_${sessionId}`);
      toast({ title: "Scores Cleared", description: "Session scores have been reset. Player votes reset." });
    } catch (error) {
      console.error("Error clearing scores: ", error);
      toast({ title: "Error", description: "Could not clear scores.", variant: "destructive" });
    }
    setIsProcessingAdminAction(false);
  };

  const handleEndSession = async () => {
    if (!isCurrentUserAdmin || (sessionData && sessionData.sessionEnded) || isProcessingAdminAction) return;
    if (!window.confirm("Are you sure you want to end this session? This action cannot be undone.")) return;
    
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      // Set sessionEnded to true and ensure round is also marked as inactive
      await updateDoc(sessionDocRef, { sessionEnded: true, isRoundActive: false });
      toast({ title: "Session Ended", description: "The session has been closed. Redirecting..." });
      if (router && typeof router.push === 'function') {
        router.push('/'); 
      }
    } catch (error) {
      console.error("Error ending session: ", error);
      toast({ title: "Error", description: "Could not end session. Please try again.", variant: "destructive" });
      setIsProcessingAdminAction(false);
    }
    // Admin is redirected, so no need to set isProcessingAdminAction back to false here if successful
  };

  const copySessionCode = () => {
    navigator.clipboard.writeText(sessionId)
      .then(() => toast({ title: "Session Code Copied!", description: sessionId }))
      .catch(() => toast({ title: "Copy Failed", description: "Could not copy code.", variant: "destructive"}));
  }

  if (isLoading && !error && !sessionData) { 
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

  if (error) { // Handles "session ended" or "cannot be found"
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Session Status</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
         <Button onClick={() => router.push('/')} variant="outline">
            <Home className="mr-2" /> Go to Homepage
        </Button>
      </main>
    );
  }

  if (!sessionData) { 
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground">Session data is not available. This usually means it's still loading or an issue occurred.</p>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            <Home className="mr-2" /> Go to Homepage
        </Button>
      </main>
    );
  }
  
  // If sessionData exists, but sessionEnded is true, non-admins will have error set above.
  // Admin would have been redirected. This is a fallback.
  if (sessionData.sessionEnded && !isCurrentUserAdmin) {
     return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Session Status</h1>
        <p className="text-muted-foreground mb-6">This session has ended.</p>
         <Button onClick={() => router.push('/')} variant="outline">
            <Home className="mr-2" /> Go to Homepage
        </Button>
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
        <GoodBadButtonsLoader sessionId={sessionId} isRoundActive={sessionData.isRoundActive && !sessionData.sessionEnded} />
      </div>

      {isCurrentUserAdmin && !sessionData.sessionEnded && (
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
            <Button onClick={handleToggleRound} variant="outline" className="w-full" disabled={isProcessingAdminAction}>
              {sessionData.isRoundActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
              {sessionData.isRoundActive ? 'Stop Round' : 'Start Round & Reset Votes'}
            </Button>
            <Button onClick={handleClearScores} variant="outline" className="w-full" disabled={isProcessingAdminAction}>
              <RotateCcw className="mr-2" /> Clear Scores & Reset Votes
            </Button>
            <Button onClick={handleEndSession} variant="destructive" className="w-full" disabled={isProcessingAdminAction}>
              <Trash2 className="mr-2" /> End Session
            </Button>
          </CardContent>
        </Card>
      )}
       {isCurrentUserAdmin && sessionData.sessionEnded && (
         <Card className="w-full max-w-md shadow-lg mt-12">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold flex items-center justify-center">
              <ShieldAlert className="mr-2 h-6 w-6 text-destructive" /> Session Ended
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">This session has been ended. You have been redirected to the homepage.</p>
             <Button onClick={() => router.push('/')} variant="outline"> Go to Homepage </Button>
          </CardContent>
         </Card>
       )}
       {!isCurrentUserAdmin && !error && ( // Show leave session button if not admin and no error (meaning session is active)
         <Button onClick={() => router.push('/')} variant="outline" className="mt-12">
            <Home className="mr-2" /> Leave Session
        </Button>
       )}
    </main>
  );
}
