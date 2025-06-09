
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, DocumentData, serverTimestamp, Timestamp } from 'firebase/firestore'; 
import { auth, db } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth'; 
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home, Users, Volume2, VolumeX, Eye, EyeOff, ListChecks, ChevronRight, ChevronsRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FirebaseError } from 'firebase/app';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParticipantData {
  nickname: string;
  joinedAt: Timestamp | any; 
}

interface SessionData {
  adminUid: string;
  isRoundActive: boolean;
  likeClicks: number;
  dislikeClicks: number;
  createdAt: Timestamp | any; 
  sessionEnded: boolean;
  soundsEnabled: boolean;
  resultsVisible: boolean;
  participants: Record<string, ParticipantData>;
  presenterQueue?: string[];
  currentPresenterIndex?: number;
  currentPresenterName?: string;
  sessionType?: string; // Added to ensure all fields are covered
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { toast } = useToast();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isProcessingAdminAction, setIsProcessingAdminAction] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [presenterQueueInput, setPresenterQueueInput] = useState('');


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) { 
        setNicknameInput(''); 
      }
    });
    return () => unsubscribeAuth();
  }, []); 

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      setError("No session ID provided.");
      router.push('/'); 
      return;
    }

    setIsLoading(true); 
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubscribeFirestore = onSnapshot(sessionDocRef, (docSnap) => {
      setIsLoading(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);
        
        if (data.presenterQueue && data.presenterQueue.length > 0 && data.currentPresenterIndex !== undefined && data.currentPresenterIndex >= 0 && data.currentPresenterIndex < data.presenterQueue.length) {
            // If there's a valid presenter queue and index, ensure currentPresenterName is set
            if (data.currentPresenterName !== data.presenterQueue[data.currentPresenterIndex]) {
                // This scenario is unlikely if server logic is correct but good for consistency
                // Consider if an updateDoc is needed here or if client derivation is enough
            }
        } else if (data.presenterQueue && data.presenterQueue.join(',') !== presenterQueueInput && !presenterQueueInput) {
            // Pre-fill presenter queue input if it's empty and there's a queue in Firestore
            setPresenterQueueInput(data.presenterQueue.join('\n'));
        }


        if (data.sessionEnded) {
          setError("This session has ended.");
        } else {
          setError(null); 
        }
      } else {
        setSessionData(null);
        setError("This session cannot be found. It may have been ended or never existed.");
      }
    }, (err) => {
      console.error("Error fetching session data: ", err);
      setError("Error loading session. Please try again.");
      toast({ title: "Error", description: "Could not load session data.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribeFirestore();
  }, [sessionId, toast, router]); 

  useEffect(() => {
    if (currentUser && sessionData?.participants?.[currentUser.uid]?.nickname) {
      if (nicknameInput === '') {
        setNicknameInput(sessionData.participants[currentUser.uid].nickname);
      }
    }
  }, [currentUser, sessionData, nicknameInput]);

  useEffect(() => {
    if (currentUser && sessionData) {
      setIsCurrentUserAdmin(currentUser.uid === sessionData.adminUid);
    } else {
      setIsCurrentUserAdmin(false);
    }
  }, [currentUser, sessionData]);

  const handleSetNickname = async () => {
    if (!currentUser || !nicknameInput.trim() || !sessionData || sessionData.sessionEnded) {
      toast({ title: "Cannot set nickname", description: "Invalid input or session state.", variant: "destructive"});
      return;
    }
    setIsSavingNickname(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      const newParticipantData: ParticipantData = { 
        nickname: nicknameInput.trim(), 
        joinedAt: sessionData.participants?.[currentUser.uid]?.joinedAt || serverTimestamp() 
      };
      await updateDoc(sessionDocRef, {
        [`participants.${currentUser.uid}`]: newParticipantData
      });
      toast({ title: "Nickname Updated!", description: `You are now "${nicknameInput.trim()}".` });
    } catch (error) {
      console.error("Error setting nickname: ", error);
      toast({ title: "Error", description: "Could not save nickname.", variant: "destructive" });
    }
    setIsSavingNickname(false);
  };

  const handleAdminAction = async (action: () => Promise<void>, successMessage: string, errorMessage: string) => {
    if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded || isProcessingAdminAction) return;
    setIsProcessingAdminAction(true);
    try {
      await action();
      toast({ title: "Admin Action Successful", description: successMessage });
    } catch (error) {
      console.error(`Error during admin action (${successMessage}): `, error);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
    setIsProcessingAdminAction(false);
  };

  const handleToggleRound = () => 
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { isRoundActive: !sessionData!.isRoundActive });
        if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
      },
      `Feedback round is now ${!sessionData!.isRoundActive ? 'OPEN' : 'CLOSED'}. Player votes reset.`,
      "Could not update feedback round status."
    );
  
  const handleClearScores = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { likeClicks: 0, dislikeClicks: 0 });
        if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
      },
      "Scores cleared and player votes reset.",
      "Could not clear scores."
    );

  const handleToggleSounds = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { soundsEnabled: !sessionData!.soundsEnabled });
      },
      `Sounds are now ${!sessionData!.soundsEnabled ? 'ENABLED' : 'DISABLED'}.`,
      "Could not toggle sound status."
    );

  const handleToggleResultsVisibility = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { resultsVisible: !sessionData!.resultsVisible });
      },
      `Live results are now ${!sessionData!.resultsVisible ? 'VISIBLE' : 'HIDDEN'}.`,
      "Could not toggle results visibility."
    );
  
  const handleEndSession = async () => {
    if (isProcessingAdminAction || !isCurrentUserAdmin || !sessionData || sessionData.sessionEnded) return;
    if (!window.confirm("Are you sure you want to end this session? This action cannot be undone.")) return;
    
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { sessionEnded: true, isRoundActive: false });
      toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
      router.push('/');
    } catch (error) {
      let errorMessage = "Could not end session. Please try again.";
      if (error instanceof FirebaseError) errorMessage = `Could not end session: ${error.message} (Code: ${error.code})`;
      else if (error instanceof Error) errorMessage = `Could not end session: ${error.message}`;
      console.error("Error ending session details: ", error);
      toast({ title: "Error Ending Session", description: errorMessage, variant: "destructive" });
      setIsProcessingAdminAction(false); 
    }
  };

  const handleSetPresenterQueue = () =>
    handleAdminAction(
        async () => {
            const newQueue = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0);
            const sessionDocRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionDocRef, {
                presenterQueue: newQueue,
                currentPresenterIndex: newQueue.length > 0 ? 0 : -1,
                currentPresenterName: newQueue.length > 0 ? newQueue[0] : "",
                likeClicks: 0, // Reset scores for the first presenter
                dislikeClicks: 0,
                isRoundActive: newQueue.length > 0, // Activate round if there's a presenter
            });
            if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
        },
        "Presenter list updated. Scores reset and round started for the first presenter if any.",
        "Could not update presenter list."
    );

  const handleNextPresenter = () =>
    handleAdminAction(
        async () => {
            if (!sessionData || !sessionData.presenterQueue || sessionData.presenterQueue.length === 0) {
                toast({ title: "No Presenters", description: "Presenter list is empty.", variant: "default" });
                return;
            }
            const currentIndex = sessionData.currentPresenterIndex ?? -1;
            const newIndex = currentIndex + 1;

            if (newIndex >= sessionData.presenterQueue.length) {
                toast({ title: "End of Queue", description: "You have reached the end of the presenter list.", variant: "default" });
                // Optionally, set isRoundActive to false or end session
                 await updateDoc(doc(db, 'sessions', sessionId), { isRoundActive: false, currentPresenterName: "End of Queue" });
                return;
            }

            const sessionDocRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionDocRef, {
                currentPresenterIndex: newIndex,
                currentPresenterName: sessionData.presenterQueue[newIndex],
                likeClicks: 0,
                dislikeClicks: 0,
                isRoundActive: true,
            });
            if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
        },
        "Advanced to the next presenter. Scores reset and round started.",
        "Could not advance to the next presenter."
    );


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

  if (error && (!sessionData || sessionData.sessionEnded || error.includes("cannot be found") || error.includes("has ended"))) { 
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Session Status</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
         <Button onClick={() => router.push('/')} variant="outline">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }
  
  if (!sessionData) { 
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground">Session data is currently unavailable.</p>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }

  const participantList = Object.entries(sessionData.participants || {})
    .map(([uid, data]) => ({ uid, ...data }))
    .sort((a, b) => {
        const timeA = a.joinedAt instanceof Timestamp ? a.joinedAt.toMillis() : (typeof a.joinedAt === 'number' ? a.joinedAt : 0);
        const timeB = b.joinedAt instanceof Timestamp ? b.joinedAt.toMillis() : (typeof b.joinedAt === 'number' ? b.joinedAt : 0);
        return timeA - timeB;
    });

  const currentPresenterDisplayName = sessionData.currentPresenterName || "N/A (Setup Presenter List)";
  const isQueueAtEnd = sessionData.presenterQueue && sessionData.currentPresenterIndex !== undefined && sessionData.currentPresenterIndex >= sessionData.presenterQueue.length -1;


  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 sm:p-12 md:p-16 bg-background space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center mb-1">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground">
            Session: {sessionId}
          </h1>
          <Button onClick={copySessionCode} variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-foreground">
            <Copy className="h-5 w-5" />
          </Button>
        </div>
        {sessionData.currentPresenterName && sessionData.currentPresenterName !== "End of Queue" && (
            <p className="text-2xl font-semibold text-accent">Now Presenting: {sessionData.currentPresenterName}</p>
        )}
        {sessionData.currentPresenterName === "End of Queue" && (
             <p className="text-2xl font-semibold text-muted-foreground">Presenter queue finished.</p>
        )}
        {(!sessionData.currentPresenterName || sessionData.currentPresenterIndex === -1) && !isCurrentUserAdmin && (
             <p className="text-xl font-semibold text-muted-foreground">Waiting for admin to start presentations...</p>
        )}
         {(!sessionData.currentPresenterName || sessionData.currentPresenterIndex === -1) && isCurrentUserAdmin && (
             <p className="text-xl font-semibold text-muted-foreground">Please set up the presenter list below to begin.</p>
        )}
        <p className="text-lg sm:text-xl text-muted-foreground mt-1">
          {sessionData.isRoundActive ? "Feedback round is OPEN. " : "Feedback round is CLOSED. "}
          {!sessionData.sessionEnded && "Cast your vote!"}
        </p>
      </div>
      
      {!isCurrentUserAdmin && !sessionData.sessionEnded && (
        <Card className="w-full max-w-md shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Set Your Nickname</CardTitle>
            <CardDescription>This will be shown to others in the session.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center space-x-2">
            <Input 
              type="text" 
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Enter your nickname"
              maxLength={25}
              disabled={isSavingNickname || sessionData.sessionEnded}
            />
            <Button onClick={handleSetNickname} disabled={isSavingNickname || !nicknameInput.trim() || sessionData.sessionEnded}>
              {isSavingNickname ? 'Saving...' : 'Set'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Leaderboard 
        sessionId={sessionId} 
        resultsVisible={sessionData.resultsVisible}
        currentPresenterName={sessionData.currentPresenterName}
      />
      
      {!sessionData.sessionEnded && (
        <div className="mt-8">
            <GoodBadButtonsLoader 
                sessionId={sessionId} 
                isRoundActive={sessionData.isRoundActive && !sessionData.sessionEnded && (sessionData.currentPresenterIndex !== undefined && sessionData.currentPresenterIndex >=0)} 
                soundsEnabled={sessionData.soundsEnabled}
            />
        </div>
      )}

      {participantList.length > 0 && (
        <Card className="w-full max-w-md shadow-lg mt-8">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center justify-center">
              <Users className="mr-2 h-5 w-5" /> Participants ({participantList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <ul className="space-y-1">
                {participantList.map(p => (
                  <li key={p.uid} className={`p-1 text-sm rounded ${currentUser?.uid === p.uid ? 'font-bold text-primary bg-primary/10' : ''}`}>
                    {p.nickname || 'Anonymous User'}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}


      {isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && (
        <Card className="w-full max-w-lg shadow-lg mt-12">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
              <ShieldAlert className="mr-2 h-6 w-6" /> Admin Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Presenter Queue Management */}
            <div className="space-y-3 border p-4 rounded-md">
                <h3 className="text-lg font-semibold flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" />Presenter List</h3>
                <Textarea
                    placeholder="Enter presenter names, one per line..."
                    value={presenterQueueInput}
                    onChange={(e) => setPresenterQueueInput(e.target.value)}
                    rows={4}
                    disabled={isProcessingAdminAction}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleSetPresenterQueue} variant="outline" className="w-full sm:w-auto" disabled={isProcessingAdminAction || !presenterQueueInput.trim()}>
                        Set/Update Presenter List
                    </Button>
                    <Button 
                        onClick={handleNextPresenter} 
                        className="w-full sm:w-auto" 
                        disabled={isProcessingAdminAction || !sessionData.presenterQueue || sessionData.presenterQueue.length === 0 || isQueueAtEnd || sessionData.currentPresenterIndex === -1}
                    >
                        Next Presenter <ChevronsRight className="ml-2 h-4 w-4"/>
                    </Button>
                </div>
                {sessionData.presenterQueue && sessionData.presenterQueue.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        Current: {sessionData.currentPresenterName || "N/A"} ({(sessionData.currentPresenterIndex ?? -1) + 1} of {sessionData.presenterQueue.length})
                    </p>
                )}
            </div>

            {/* General Controls */}
            <div className="space-y-4 border p-4 rounded-md">
                 <h3 className="text-lg font-semibold">General Controls</h3>
                 <div className="text-sm text-center font-medium">
                    Feedback Round: <span className={sessionData.isRoundActive ? "text-green-500" : "text-red-500"}>{sessionData.isRoundActive ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                <Button onClick={handleToggleRound} variant="outline" className="w-full" disabled={isProcessingAdminAction || sessionData.currentPresenterIndex === -1}>
                  {sessionData.isRoundActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {sessionData.isRoundActive ? 'Close Feedback Round' : 'Open Feedback Round'}
                </Button>
                <Button onClick={handleClearScores} variant="outline" className="w-full" disabled={isProcessingAdminAction || sessionData.currentPresenterIndex === -1}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Clear Scores & Reset Votes
                </Button>
                
                <div className="flex items-center justify-between space-x-2 pt-2 border-t mt-4 pt-4">
                  <Label htmlFor="sounds-enabled" className="flex items-center text-sm">
                    {sessionData.soundsEnabled ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />}
                    Vote Sounds
                  </Label>
                  <Switch
                    id="sounds-enabled"
                    checked={sessionData.soundsEnabled}
                    onCheckedChange={handleToggleSounds}
                    disabled={isProcessingAdminAction}
                  />
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="results-visible" className="flex items-center text-sm">
                    {sessionData.resultsVisible ? <Eye className="mr-2 h-5 w-5" /> : <EyeOff className="mr-2 h-5 w-5" />}
                    Live Results Visible
                  </Label>
                  <Switch
                    id="results-visible"
                    checked={sessionData.resultsVisible}
                    onCheckedChange={handleToggleResultsVisibility}
                    disabled={isProcessingAdminAction}
                  />
                </div>
            </div>
            <Button onClick={handleEndSession} variant="destructive" className="w-full !mt-8" disabled={isProcessingAdminAction}>
              <Trash2 className="mr-2 h-4 w-4" /> End Session
            </Button>
          </CardContent>
        </Card>
      )}

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

       {!isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && !error && (
         <Button onClick={() => router.push('/')} variant="outline" className="mt-12">
            <Home className="mr-2 h-4 w-4" /> Leave Session
        