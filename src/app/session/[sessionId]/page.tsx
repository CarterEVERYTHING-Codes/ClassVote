
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, DocumentData } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth'; 
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FirebaseError } from 'firebase/app';

interface SessionData {
  adminUid: string;
  isRoundActive: boolean;
  likeClicks: number;
  dislikeClicks: number;
  createdAt: any; 
  sessionEnded: boolean;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { toast } = useToast();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Initialize to null
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isProcessingAdminAction, setIsProcessingAdminAction] = useState(false);

  // Effect for Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Effect for Firestore Data
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      setError("No session ID provided.");
      return;
    }

    setIsLoading(true); 
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubscribeFirestore = onSnapshot(sessionDocRef, (docSnap) => {
      setIsLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        if (data.sessionEnded) {
          setError("This session has ended.");
        } else {
          setError(null); 
        }
      } else {
        setSessionData(null);
        setError("This session cannot be found or has been ended by the admin.");
      }
    }, (err) => {
      console.error("Error fetching session data: ", err);
      setError("Error loading session. Please try again.");
      toast({ title: "Error", description: "Could not load session data.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribeFirestore();
  }, [sessionId, toast]);

  // Effect to determine admin status
  useEffect(() => {
    if (currentUser && sessionData) {
      setIsCurrentUserAdmin(currentUser.uid === sessionData.adminUid);
    } else {
      setIsCurrentUserAdmin(false);
    }
  }, [currentUser, sessionData]);


  const handleToggleRound = async () => {
    if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded || isProcessingAdminAction) return;
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
    if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded || isProcessingAdminAction) return;
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
    // The button is only rendered if:
    // isCurrentUserAdmin is true, sessionData exists, and !sessionData.sessionEnded is true.
    // This simplifies the checks needed within this function.

    if (isProcessingAdminAction) {
      toast({ title: "Processing", description: "Previous action is still processing. Please wait.", variant: "default" });
      return;
    }

    if (!window.confirm("Are you sure you want to end this session? This action cannot be undone.")) {
      return;
    }
    
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      // Core action: Update Firestore document
      await updateDoc(sessionDocRef, { 
        sessionEnded: true, 
        isRoundActive: false // Also ensure the round is explicitly stopped
      });
      
      toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
      
      // Redirect admin to homepage
      if (router && typeof router.push === 'function') {
        router.push('/');
      } else {
        console.error("Router not available for admin redirection after ending session.");
        // If redirection fails, allow further actions if needed by resetting processing state.
        setIsProcessingAdminAction(false); 
      }
      // If redirection is successful, this component will unmount,
      // so setIsProcessingAdminAction(false) is not strictly needed here.
    } catch (error) {
      let errorMessage = "Could not end session. Please try again.";
      if (error instanceof FirebaseError) {
          errorMessage = `Could not end session: ${error.message} (Code: ${error.code})`;
      } else if (error instanceof Error) {
          errorMessage = `Could not end session: ${error.message}`;
      }
      console.error("Error ending session details: ", error);
      toast({ title: "Error Ending Session", description: errorMessage, variant: "destructive" });
      setIsProcessingAdminAction(false); // Crucial to reset state on error
    }
  };

  const copySessionCode = () => {
    if (!sessionId) return;
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

  // This covers: session ended explicitly, or general error when sessionData is null (e.g., not found or deleted).
  if (error && (!sessionData || sessionData.sessionEnded || error.includes("cannot be found") || error.includes("has ended"))) { 
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
  
  // Fallback if still loading or truly no data without a specific "not found" or "ended" error
  if (!sessionData) { 
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground">Session data is currently unavailable or being loaded.</p>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
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

      {/* Admin Controls: Visible if user is admin AND sessionData exists AND session is NOT ended */}
      {isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && (
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

      {/* Message for Admin if session HAS ended (button to go home) */}
       {isCurrentUserAdmin && sessionData && sessionData.sessionEnded && (
         <Card className="w-full max-w-md shadow-lg mt-12">
          <CardHeader>
            <CardTitle className="text-center text-xl font-bold flex items-center justify-center">
              <ShieldAlert className="mr-2 h-6 w-6 text-destructive" /> Session Ended
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">This session has been ended.</p>
             <Button onClick={() => router.push('/')} variant="outline"> Go to Homepage </Button>
          </CardContent>
         </Card>
       )}

       {/* Leave Session button for non-admins if session is active (no error and session not ended) */}
       {!isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && !error && (
         <Button onClick={() => router.push('/')} variant="outline" className="mt-12">
            <Home className="mr-2" /> Leave Session
        </Button>
       )}
    </main>
  );
}
