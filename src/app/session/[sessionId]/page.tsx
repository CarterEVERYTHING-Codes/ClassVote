
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, DocumentData, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home, Users, Volume2, VolumeX, Eye, EyeOff,
    ListChecks, ChevronsRight, MessageSquarePlus, Lightbulb, HelpCircle, Send, Info
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FirebaseError } from 'firebase/app';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface ParticipantData {
  nickname: string;
  joinedAt: Timestamp | any;
}

interface KeyTakeaway {
    userId: string;
    nickname: string;
    takeaway: string;
    submittedAt: Timestamp;
}

interface Question {
    userId: string;
    nickname: string;
    questionText: string;
    submittedAt: Timestamp;
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
  sessionType?: string;
  keyTakeawaysEnabled?: boolean;
  qnaEnabled?: boolean;
  keyTakeaways?: KeyTakeaway[];
  questions?: Question[];
}

const MAX_TAKEAWAY_LENGTH = 280;
const MAX_QUESTION_LENGTH = 500;

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

  const [takeawayInput, setTakeawayInput] = useState('');
  const [isSubmittingTakeaway, setIsSubmittingTakeaway] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);


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

        if (data.presenterQueue && presenterQueueInput === '' && !data.sessionEnded) {
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
  }, [sessionId, router, toast]);


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
      let displayError = errorMessage;
      if (error instanceof FirebaseError) displayError = `${errorMessage} (Code: ${error.code})`;
      toast({ title: "Error", description: displayError, variant: "destructive" });
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

  const handleToggleKeyTakeaways = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { keyTakeawaysEnabled: !sessionData!.keyTakeawaysEnabled });
      },
      `Key Takeaway submissions are now ${!sessionData!.keyTakeawaysEnabled ? 'ENABLED' : 'DISABLED'}.`,
      "Could not toggle Key Takeaway status."
    );

  const handleToggleQnA = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { qnaEnabled: !sessionData!.qnaEnabled });
      },
      `Q&A submissions are now ${!sessionData!.qnaEnabled ? 'ENABLED' : 'DISABLED'}.`,
      "Could not toggle Q&A status."
    );

  const triggerEndSessionDialog = () => {
    if (isProcessingAdminAction || !isCurrentUserAdmin || !sessionData || sessionData.sessionEnded) {
      return;
    }
    setShowEndSessionDialog(true);
  }

  const executeEndSession = async () => {
    if (isProcessingAdminAction || !isCurrentUserAdmin || !sessionData || sessionData.sessionEnded) {
        setShowEndSessionDialog(false);
        return;
    }
    setIsProcessingAdminAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { sessionEnded: true, isRoundActive: false });
      toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
      setShowEndSessionDialog(false); 
      router.push('/');
    } catch (error) {
      console.error("Error ending session details: ", error);
      let errorMessage = "Could not end session. Please try again.";
      if (error instanceof FirebaseError) errorMessage = `Could not end session: ${error.message} (Code: ${error.code})`;
      else if (error instanceof Error) errorMessage = `Could not end session: ${error.message}`;
      toast({ title: "Error Ending Session", description: errorMessage, variant: "destructive" });
    } finally {
      setIsProcessingAdminAction(false); 
      setShowEndSessionDialog(false); 
    }
  };


  const handleSetPresenterQueue = () =>
    handleAdminAction(
        async () => {
            const newQueue = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0);
            const sessionDocRef = doc(db, 'sessions', sessionId);
            const firstPresenterName = newQueue.length > 0 ? newQueue[0] : "";
            const newPresenterIndex = newQueue.length > 0 ? 0 : -1;
            const roundActive = newQueue.length > 0;

            await updateDoc(sessionDocRef, {
                presenterQueue: newQueue,
                currentPresenterIndex: newPresenterIndex,
                currentPresenterName: firstPresenterName,
                likeClicks: 0,
                dislikeClicks: 0,
                isRoundActive: roundActive,
            });
            if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
        },
        "Presenter list updated. Scores reset. Round " + (presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0).length > 0 ? "started for the first presenter." : "closed as list is empty."),
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
                toast({ title: "End of Queue", description: "You have reached the end of the presenter list. Round closed.", variant: "default" });
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

  const handleSubmitTakeaway = async () => {
    if (!currentUser || !takeawayInput.trim() || !sessionData || sessionData.sessionEnded || !sessionData.keyTakeawaysEnabled || !sessionData.isRoundActive || isQueueEffectivelyEmpty || sessionData.currentPresenterIndex === -1 || sessionData.currentPresenterName === "End of Queue") {
        toast({ title: "Cannot submit takeaway", description: "Submission is not allowed at this time.", variant: "destructive" });
        return;
    }
    setIsSubmittingTakeaway(true);
    try {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const userNickname = sessionData.participants?.[currentUser.uid]?.nickname || "Anonymous";
        const newTakeaway: KeyTakeaway = {
            userId: currentUser.uid,
            nickname: userNickname,
            takeaway: takeawayInput.trim(),
            submittedAt: serverTimestamp() as Timestamp 
        };
        await updateDoc(sessionDocRef, {
            keyTakeaways: arrayUnion(newTakeaway)
        });
        toast({ title: "Takeaway Submitted!", description: "Your key takeaway has been recorded." });
        setTakeawayInput('');
    } catch (error) {
        console.error("Error submitting takeaway: ", error);
        toast({ title: "Error", description: "Could not submit takeaway.", variant: "destructive" });
    }
    setIsSubmittingTakeaway(false);
  };

  const handleSubmitQuestion = async () => {
    if (!currentUser || !questionInput.trim() || !sessionData || sessionData.sessionEnded || !sessionData.qnaEnabled || !sessionData.isRoundActive || isQueueEffectivelyEmpty || sessionData.currentPresenterIndex === -1 || sessionData.currentPresenterName === "End of Queue") {
        toast({ title: "Cannot submit question", description: "Submission is not allowed at this time.", variant: "destructive" });
        return;
    }
    setIsSubmittingQuestion(true);
    try {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const userNickname = sessionData.participants?.[currentUser.uid]?.nickname || "Anonymous";
        const newQuestion: Question = {
            userId: currentUser.uid,
            nickname: userNickname,
            questionText: questionInput.trim(),
            submittedAt: serverTimestamp() as Timestamp 
        };
        await updateDoc(sessionDocRef, {
            questions: arrayUnion(newQuestion)
        });
        toast({ title: "Question Submitted!", description: "Your question has been recorded." });
        setQuestionInput('');
    } catch (error) {
        console.error("Error submitting question: ", error);
        toast({ title: "Error", description: "Could not submit question.", variant: "destructive" });
    }
    setIsSubmittingQuestion(false);
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

  const isQueueAtEnd = sessionData.presenterQueue && sessionData.currentPresenterIndex !== undefined && sessionData.currentPresenterIndex >= sessionData.presenterQueue.length -1;
  const isQueueEffectivelyEmpty = !sessionData.presenterQueue || sessionData.presenterQueue.length === 0;
  const isActivePresenter = !isQueueEffectivelyEmpty && sessionData.currentPresenterIndex !== undefined && sessionData.currentPresenterIndex >=0 && sessionData.currentPresenterName !== "End of Queue";


  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 sm:p-12 md:p-16 bg-background space-y-8">
      <TooltipProvider>
        <div className="text-center">
            <div className="flex items-center justify-center mb-1">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-bold text-foreground">
                Session: {sessionId}
            </h1>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={copySessionCode} variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-foreground">
                        <Copy className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Copy Session Code</p></TooltipContent>
            </Tooltip>
            </div>
            {sessionData.currentPresenterName && sessionData.currentPresenterName !== "End of Queue" && (
                <p className="text-2xl font-semibold text-accent">Now Presenting: {sessionData.currentPresenterName}</p>
            )}
            {sessionData.currentPresenterName === "End of Queue" && (
                <p className="text-2xl font-semibold text-muted-foreground">Presenter queue finished.</p>
            )}
            {(isQueueEffectivelyEmpty || sessionData.currentPresenterIndex === -1) && !isCurrentUserAdmin && (
                <p className="text-xl font-semibold text-muted-foreground">Waiting for admin to start presentations...</p>
            )}
            {(isQueueEffectivelyEmpty || sessionData.currentPresenterIndex === -1) && isCurrentUserAdmin && (
                <p className="text-xl font-semibold text-muted-foreground">Please set up the presenter list below to begin.</p>
            )}
            <p className="text-lg sm:text-xl text-muted-foreground mt-1">
            {sessionData.isRoundActive && isActivePresenter ? "Feedback round is OPEN. " : "Feedback round is CLOSED. "}
            {!sessionData.sessionEnded && isActivePresenter && "Cast your vote, submit takeaways, or ask questions!"}
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
                    isRoundActive={sessionData.isRoundActive && !sessionData.sessionEnded && isActivePresenter}
                    soundsEnabled={sessionData.soundsEnabled}
                />
            </div>
        )}

        {!isCurrentUserAdmin && !sessionData.sessionEnded && isActivePresenter && sessionData.keyTakeawaysEnabled && (
            <Card className="w-full max-w-md shadow-md mt-6">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-primary" />Submit Key Takeaway</CardTitle>
                    <CardDescription>What's the most important point you'll remember? (Max {MAX_TAKEAWAY_LENGTH} chars)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        value={takeawayInput}
                        onChange={(e) => setTakeawayInput(e.target.value.slice(0, MAX_TAKEAWAY_LENGTH))}
                        placeholder="Enter your key takeaway..."
                        maxLength={MAX_TAKEAWAY_LENGTH}
                        rows={3}
                        disabled={isSubmittingTakeaway || !sessionData.isRoundActive || sessionData.sessionEnded}
                    />
                    <Button onClick={handleSubmitTakeaway} className="w-full" disabled={isSubmittingTakeaway || !takeawayInput.trim() || !sessionData.isRoundActive || sessionData.sessionEnded}>
                        {isSubmittingTakeaway ? 'Submitting...' : <><Send className="mr-2 h-4 w-4"/>Submit Takeaway</>}
                    </Button>
                </CardContent>
            </Card>
        )}

        {!isCurrentUserAdmin && !sessionData.sessionEnded && isActivePresenter && sessionData.qnaEnabled && (
            <Card className="w-full max-w-md shadow-md mt-6">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center"><MessageSquarePlus className="mr-2 h-5 w-5 text-primary" />Ask a Question</CardTitle>
                    <CardDescription>Submit a question for the presenter. (Max {MAX_QUESTION_LENGTH} chars)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        value={questionInput}
                        onChange={(e) => setQuestionInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                        placeholder="Enter your question..."
                        maxLength={MAX_QUESTION_LENGTH}
                        rows={3}
                        disabled={isSubmittingQuestion || !sessionData.isRoundActive || sessionData.sessionEnded}
                    />
                    <Button onClick={handleSubmitQuestion} className="w-full" disabled={isSubmittingQuestion || !questionInput.trim() || !sessionData.isRoundActive || sessionData.sessionEnded}>
                        {isSubmittingQuestion ? 'Submitting...' : <><Send className="mr-2 h-4 w-4"/>Submit Question</>}
                    </Button>
                </CardContent>
            </Card>
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
                <div className="space-y-3 border p-4 rounded-md">
                    <h3 className="text-lg font-semibold flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" />Presenter List
                        <Tooltip>
                            <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                            <TooltipContent><p>Enter one presenter name per line. Click 'Set/Update' to apply. This will reset scores and start the round for the first presenter.</p></TooltipContent>
                        </Tooltip>
                    </h3>
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
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={handleNextPresenter}
                                    className="w-full sm:w-auto"
                                    disabled={isProcessingAdminAction || isQueueEffectivelyEmpty || isQueueAtEnd || sessionData.currentPresenterIndex === -1 || sessionData.currentPresenterName === "End of Queue"}
                                >
                                    Next Presenter <ChevronsRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Advance to the next presenter in the list. Scores will be reset and the feedback round will open.</p></TooltipContent>
                        </Tooltip>
                    </div>
                    {sessionData.presenterQueue && sessionData.presenterQueue.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            Current: {sessionData.currentPresenterName || "N/A"} ({(sessionData.currentPresenterIndex ?? -1) + 1} of {sessionData.presenterQueue.length})
                        </p>
                    )}
                </div>

                <div className="space-y-4 border p-4 rounded-md">
                    <h3 className="text-lg font-semibold">General Controls</h3>
                    <div className="text-sm text-center font-medium">
                        Feedback Round: <span className={sessionData.isRoundActive && isActivePresenter ? "text-green-500" : "text-red-500"}>
                            {sessionData.isRoundActive && isActivePresenter ? 'OPEN' : 'CLOSED'}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <Button
                            onClick={handleToggleRound}
                            variant="outline"
                            className="w-full"
                            disabled={isProcessingAdminAction || isQueueEffectivelyEmpty || sessionData.currentPresenterName === "End of Queue" || sessionData.currentPresenterIndex === -1}
                        >
                        {sessionData.isRoundActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {sessionData.isRoundActive ? 'Close Feedback Round' : 'Open Feedback Round'}
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-8 w-8"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                            <TooltipContent><p>Open or close the feedback round for the current presenter. Closing resets participant vote status.</p></TooltipContent>
                        </Tooltip>
                    </div>
                     <div className="flex items-center">
                        <Button
                            onClick={handleClearScores}
                            variant="outline"
                            className="w-full"
                            disabled={isProcessingAdminAction || isQueueEffectivelyEmpty || sessionData.currentPresenterName === "End of Queue" || sessionData.currentPresenterIndex === -1}
                        >
                        <RotateCcw className="mr-2 h-4 w-4" /> Clear Scores & Reset Votes
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-8 w-8"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                            <TooltipContent><p>Reset current Like/Dislike scores to zero and clear participant vote status for the current round.</p></TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex items-center justify-between space-x-2 pt-2 border-t mt-4 pt-4">
                        <Label htmlFor="sounds-enabled" className="flex items-center text-sm">
                            {sessionData.soundsEnabled ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />}
                            Vote Sounds
                        </Label>
                        <div className="flex items-center">
                            <Switch
                                id="sounds-enabled"
                                checked={sessionData.soundsEnabled}
                                onCheckedChange={handleToggleSounds}
                                disabled={isProcessingAdminAction}
                            />
                            <Tooltip>
                                <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                <TooltipContent><p>Enable or disable sound effects for like/dislike votes for all participants.</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="results-visible" className="flex items-center text-sm">
                            {sessionData.resultsVisible ? <Eye className="mr-2 h-5 w-5" /> : <EyeOff className="mr-2 h-5 w-5" />}
                            Live Results Visible
                        </Label>
                         <div className="flex items-center">
                            <Switch
                                id="results-visible"
                                checked={sessionData.resultsVisible}
                                onCheckedChange={handleToggleResultsVisibility}
                                disabled={isProcessingAdminAction}
                            />
                            <Tooltip>
                                <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                <TooltipContent><p>Show or hide the live leaderboard scores from participants.</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                     <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="key-takeaways-enabled" className="flex items-center text-sm">
                            {sessionData.keyTakeawaysEnabled ? <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" /> : <Lightbulb className="mr-2 h-5 w-5" />}
                            Key Takeaways
                        </Label>
                        <div className="flex items-center">
                            <Switch
                                id="key-takeaways-enabled"
                                checked={sessionData.keyTakeawaysEnabled === true}
                                onCheckedChange={handleToggleKeyTakeaways}
                                disabled={isProcessingAdminAction}
                            />
                            <Tooltip>
                                <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                <TooltipContent><p>Allow participants to submit a key takeaway after the presentation.</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="qna-enabled" className="flex items-center text-sm">
                            {sessionData.qnaEnabled ? <MessageSquarePlus className="mr-2 h-5 w-5 text-blue-500" /> : <MessageSquarePlus className="mr-2 h-5 w-5" />}
                            Q&A Submissions
                        </Label>
                        <div className="flex items-center">
                            <Switch
                                id="qna-enabled"
                                checked={sessionData.qnaEnabled === true}
                                onCheckedChange={handleToggleQnA}
                                disabled={isProcessingAdminAction}
                            />
                             <Tooltip>
                                <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                <TooltipContent><p>Allow participants to anonymously submit questions for the presenter.</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>
                 <div className="flex items-center !mt-8">
                    <Button onClick={triggerEndSessionDialog} variant="destructive" className="w-full" disabled={isProcessingAdminAction}>
                        <Trash2 className="mr-2 h-4 w-4" /> End Session
                    </Button>
                    <Tooltip>
                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-8 w-8"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                        <TooltipContent><p>Permanently end this session for all participants. This action cannot be undone.</p></TooltipContent>
                    </Tooltip>
                </div>
            </CardContent>
            </Card>
        )}

        <AlertDialog open={showEndSessionDialog} onOpenChange={setShowEndSessionDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will permanently end the session for all participants. This cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowEndSessionDialog(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeEndSession} disabled={isProcessingAdminAction}>
                    {isProcessingAdminAction ? "Ending..." : "Yes, End Session"}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


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
            </Button>
        )}
        {(!isCurrentUserAdmin && (sessionData.sessionEnded || error)) && (
            <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
                <Home className="mr-2 h-4 w-4" /> Go to Homepage
            </Button>
        )}
      </TooltipProvider>
    </main>
  );
}

  