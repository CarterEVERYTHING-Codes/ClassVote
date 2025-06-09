
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, DocumentData, serverTimestamp, Timestamp, arrayUnion, FieldValue } from 'firebase/firestore'; // Ensure FieldValue is imported
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
} from "@/components/ui/alert-dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
import {
    Play, Pause, RotateCcw, ShieldAlert, Trash2, Copy, Home, Users, Volume2, VolumeX, Eye, EyeOff,
    ListChecks, ChevronsRight, MessageSquarePlus, Lightbulb, Send, Info, UserPlusIcon,
    FileText, MessageCircleQuestion
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FirebaseError } from 'firebase/app';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from 'date-fns';
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import { cn } from "@/lib/utils";


interface ParticipantData {
  nickname: string;
  joinedAt: Timestamp | FieldValue; // joinedAt can be FieldValue on write, Timestamp on read
}

// Interface for data READ from Firestore
interface KeyTakeaway {
    userId: string;
    nickname: string;
    takeaway: string;
    submittedAt: Timestamp; // Read as Timestamp
}

// Interface for data WRITTEN to Firestore via arrayUnion
interface KeyTakeawayWrite {
    userId: string;
    nickname: string;
    takeaway: string;
    submittedAt: FieldValue; // Written as FieldValue (serverTimestamp())
}

// Interface for data READ from Firestore
interface Question {
    userId: string;
    nickname: string;
    questionText: string;
    submittedAt: Timestamp; // Read as Timestamp
}

// Interface for data WRITTEN to Firestore via arrayUnion
interface QuestionWrite {
    userId: string;
    nickname: string;
    questionText: string;
    submittedAt: FieldValue; // Written as FieldValue (serverTimestamp())
}

interface SessionData {
  adminUid: string;
  isRoundActive: boolean;
  likeClicks: number;
  dislikeClicks: number;
  createdAt: Timestamp | FieldValue;
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

        if (presenterQueueInput === '' && data.presenterQueue && !data.sessionEnded) {
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
    if (currentUser && sessionData?.participants?.[currentUser.uid]?.nickname && nicknameInput === '') {
      setNicknameInput(sessionData.participants[currentUser.uid].nickname);
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
    } finally {
        setIsProcessingAdminAction(false);
    }
  };

  const handleToggleRound = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const updateData: { isRoundActive: boolean; likeClicks?: number; dislikeClicks?: number } = {
             isRoundActive: !sessionData!.isRoundActive
        };

        if (!sessionData!.isRoundActive && (isPresenterQueueEffectivelyEmpty || sessionData!.currentPresenterIndex === -1)) {
            updateData.likeClicks = 0;
            updateData.dislikeClicks = 0;
             if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
        }


        await updateDoc(sessionDocRef, updateData);
        if (!sessionData!.isRoundActive && typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);

      },
      `Feedback round is now ${!sessionData!.isRoundActive ? 'OPEN' : 'CLOSED'}.`,
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
    setIsProcessingAdminAction(true);
    try {
      if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded) {
        setShowEndSessionDialog(false);
        setIsProcessingAdminAction(false);
        return;
      }
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { sessionEnded: true, isRoundActive: false });
      toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
      if (sessionData && sessionData.adminUid === currentUser?.uid) {
          router.push('/');
      }
    } catch (error) {
      console.error("Error ending session details: ", error);
      let errorMessageText = "Could not end session. Please try again.";
      if (error instanceof FirebaseError) errorMessageText = `Could not end session: ${error.message} (Code: ${error.code})`;
      else if (error instanceof Error) errorMessageText = `Could not end session: ${error.message}`;
      toast({ title: "Error Ending Session", description: errorMessageText, variant: "destructive" });
    } finally {
      setIsProcessingAdminAction(false);
      setShowEndSessionDialog(false);
       if (sessionData && sessionData.adminUid === currentUser?.uid && sessionData.sessionEnded) {
          if (router.asPath.startsWith('/session/')) {
            router.push('/');
          }
       }
    }
  };


  const handleSetPresenterQueue = () =>
    handleAdminAction(
        async () => {
            const newQueue = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0);
            const sessionDocRef = doc(db, 'sessions', sessionId);
            
            let newPresenterName = "";
            let newPresenterIndex = -1;
            let roundActive = false; 

            if (newQueue.length > 0) {
                newPresenterName = newQueue[0];
                newPresenterIndex = 0;
                roundActive = true; 
            }
            
            await updateDoc(sessionDocRef, {
                presenterQueue: newQueue,
                currentPresenterIndex: newPresenterIndex,
                currentPresenterName: newPresenterName,
                likeClicks: 0, 
                dislikeClicks: 0, 
                isRoundActive: roundActive,
            });
            if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
        },
        presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0).length > 0
            ? "Presenter list updated. Scores reset. Round started for the first presenter."
            : "Presenter list cleared. Scores reset. Round closed (if it was presenter-driven).",
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
                await updateDoc(doc(db, 'sessions', sessionId), { isRoundActive: false, currentPresenterName: "End of Queue", likeClicks: 0, dislikeClicks: 0 });
                if (typeof window !== "undefined") localStorage.removeItem(`hasVoted_${sessionId}`);
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

  const isPresenterQueueEffectivelyEmpty = !sessionData?.presenterQueue || sessionData.presenterQueue.length === 0;
  
  const isSpecificPresenterActive = !isPresenterQueueEffectivelyEmpty &&
                                 sessionData?.currentPresenterIndex !== undefined &&
                                 sessionData.currentPresenterIndex >= 0 &&
                                 sessionData.presenterQueue!.length > 0 && 
                                 sessionData.currentPresenterIndex < sessionData.presenterQueue!.length &&
                                 sessionData.currentPresenterName !== "" &&
                                 sessionData.currentPresenterName !== "End of Queue";

  const canSubmitFeedbackGeneric = sessionData?.isRoundActive === true && !sessionData?.sessionEnded;
  const feedbackSubmissionAllowed = canSubmitFeedbackGeneric && (isPresenterQueueEffectivelyEmpty || isSpecificPresenterActive);


  const handleSubmitTakeaway = async () => {
    if (!currentUser || !takeawayInput.trim() || !sessionData || !sessionData.keyTakeawaysEnabled || !feedbackSubmissionAllowed) {
        toast({ title: "Cannot submit takeaway", description: "Submission is not allowed at this time.", variant: "destructive" });
        return;
    }
    setIsSubmittingTakeaway(true);
    try {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const userNickname = sessionData.participants?.[currentUser.uid]?.nickname || "Anonymous";
        
        const newTakeaway: KeyTakeawayWrite = { 
            userId: currentUser.uid,
            nickname: userNickname,
            takeaway: takeawayInput.trim(),
            submittedAt: serverTimestamp()
        };
        // console.log("Attempting to submit Key Takeaway:", JSON.stringify(newTakeaway, null, 2)); // For debugging

        await updateDoc(sessionDocRef, {
            keyTakeaways: arrayUnion(newTakeaway)
        });
        toast({ title: "Takeaway Submitted!", description: "Your key takeaway has been recorded." });
        setTakeawayInput('');
    } catch (error) {
        console.error("Error submitting takeaway: ", error);
        let description = "Could not submit takeaway. Please try again.";
        if (error instanceof FirebaseError) {
            description = `Firebase Error: ${error.message} (Code: ${error.code})`;
        } else if (error instanceof Error) {
            description = `Error: ${error.message}`;
        }
        toast({ title: "Submission Failed", description, variant: "destructive" });
    }
    setIsSubmittingTakeaway(false);
  };

  const handleSubmitQuestion = async () => {
    if (!currentUser || !questionInput.trim() || !sessionData || !sessionData.qnaEnabled || !feedbackSubmissionAllowed ) {
        toast({ title: "Cannot submit question", description: "Submission is not allowed at this time.", variant: "destructive" });
        return;
    }
    setIsSubmittingQuestion(true);
    try {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const userNickname = sessionData.participants?.[currentUser.uid]?.nickname || "Anonymous";
        
        const newQuestion: QuestionWrite = {
            userId: currentUser.uid,
            nickname: userNickname,
            questionText: questionInput.trim(),
            submittedAt: serverTimestamp()
        };
        // console.log("Attempting to submit Question:", JSON.stringify(newQuestion, null, 2)); // For debugging

        await updateDoc(sessionDocRef, {
            questions: arrayUnion(newQuestion)
        });
        toast({ title: "Question Submitted!", description: "Your question has been recorded." });
        setQuestionInput('');
    } catch (error) {
        console.error("Error submitting question: ", error);
        let description = "Could not submit question. Please try again.";
        if (error instanceof FirebaseError) {
            description = `Firebase Error: ${error.message} (Code: ${error.code})`;
        } else if (error instanceof Error) {
            description = `Error: ${error.message}`;
        }
        toast({ title: "Submission Failed", description, variant: "destructive" });
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
        <div className="absolute top-4 right-4">
            <ThemeToggleButton />
        </div>
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
        <div className="absolute top-4 right-4">
            <ThemeToggleButton />
        </div>
        <p className="text-lg text-muted-foreground">Session data is currently unavailable.</p>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }

  const participantList = Object.entries(sessionData.participants || {})
    .map(([uid, data]) => ({ uid, nickname: data.nickname, joinedAt: data.joinedAt }))
    .sort((a, b) => {
        const timeAValue = a.joinedAt;
        const timeBValue = b.joinedAt;
        // Handle serverTimestamp() which might not be a Timestamp instance yet client-side
        const timeA = timeAValue instanceof Timestamp ? timeAValue.toMillis() : (typeof (timeAValue as any)?.seconds === 'number' ? (timeAValue as any).seconds * 1000 : Date.now());
        const timeB = timeBValue instanceof Timestamp ? timeBValue.toMillis() : (typeof (timeBValue as any)?.seconds === 'number' ? (timeBValue as any).seconds * 1000 : Date.now());
        return timeA - timeB;
    });

  const isQueueAtEnd = !isPresenterQueueEffectivelyEmpty &&
                       sessionData.currentPresenterIndex !== undefined &&
                       sessionData.presenterQueue!.length > 0 && 
                       sessionData.currentPresenterIndex >= sessionData.presenterQueue!.length -1;


  let sessionStatusMessage = "";
  let presenterDisplayMessage = "";

  if (isSpecificPresenterActive) {
      presenterDisplayMessage = `Now Presenting: ${sessionData.currentPresenterName}`;
      sessionStatusMessage = sessionData.isRoundActive ? "Feedback round is OPEN for the current presenter. Cast your vote!" : "Feedback round is CLOSED for the current presenter.";
  } else if (sessionData.currentPresenterName === "End of Queue") {
      presenterDisplayMessage = "Presenter queue finished.";
      sessionStatusMessage = "Feedback round is CLOSED.";
  } else if (!isPresenterQueueEffectivelyEmpty && sessionData.currentPresenterIndex === -1) {
      presenterDisplayMessage = "Presenter queue is set.";
      sessionStatusMessage = isCurrentUserAdmin ? 
          (sessionData.isRoundActive ? "General feedback round is OPEN. You can also start the presentations." : "Admin can start the presentations or open a general feedback round.") :
          (sessionData.isRoundActive ? "General feedback round is OPEN." : "Waiting for admin to start presentations or open a general round.");
  } else { 
      presenterDisplayMessage = isCurrentUserAdmin ? "No presenter list. Run a general feedback round or add presenters." : "General feedback session.";
      sessionStatusMessage = sessionData.isRoundActive ? "General feedback round is OPEN. Cast your vote!" : "General feedback round is CLOSED.";
  }


  const disableOpenCloseRoundButton = isProcessingAdminAction || 
                                   (isSpecificPresenterActive && sessionData.currentPresenterName === "End of Queue") || 
                                   (!isPresenterQueueEffectivelyEmpty && sessionData.currentPresenterIndex !== -1 && !isSpecificPresenterActive); 

  const disableClearScoresButton = isProcessingAdminAction || 
                                (!sessionData.isRoundActive && !isSpecificPresenterActive && !isPresenterQueueEffectivelyEmpty && sessionData.currentPresenterIndex === -1 && !isPresenterQueueEffectivelyEmpty) || 
                                (!sessionData.isRoundActive && isPresenterQueueEffectivelyEmpty) || 
                                (sessionData.currentPresenterName === "End of Queue"); 

  const nextPresenterButtonDisabled = isProcessingAdminAction || 
                                   isPresenterQueueEffectivelyEmpty || 
                                   isQueueAtEnd || 
                                   sessionData.currentPresenterIndex === -1; 


  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <TooltipProvider>
        <div className="text-center mb-6 relative">
            <div className="absolute top-0 right-0">
                <ThemeToggleButton />
            </div>
            <div className="flex items-center justify-center mb-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-bold text-foreground">
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
            {presenterDisplayMessage && (
                <p className={`text-xl md:text-2xl font-semibold ${isSpecificPresenterActive ? 'text-accent' : 'text-muted-foreground'}`}>{presenterDisplayMessage}</p>
            )}
            <p className="text-md sm:text-lg text-muted-foreground mt-1">
                {sessionStatusMessage}
            </p>
             {!sessionData.sessionEnded && !feedbackSubmissionAllowed && sessionData.isRoundActive && (
                <p className="text-sm text-orange-500 mt-1">
                    Submissions (votes, takeaways, Q&A) are paused until the admin selects an active presenter or if the queue has ended.
                </p>
            )}
        </div>

        {!sessionData.sessionEnded && (
            <div className="mb-8 flex justify-center">
                <GoodBadButtonsLoader
                    sessionId={sessionId}
                    isRoundActive={feedbackSubmissionAllowed}
                    soundsEnabled={sessionData.soundsEnabled}
                />
            </div>
        )}

        <div className={cn(
            "grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start"
        )}>
            
            {/* Left Column */}
            <section className={cn(
                "space-y-4",
                isCurrentUserAdmin ? "md:col-span-7" : "md:col-span-7" 
            )}>
                {!isCurrentUserAdmin && (
                    <Card className="w-full shadow-md">
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
                    currentPresenterName={isSpecificPresenterActive ? sessionData.currentPresenterName : null}
                    presenterQueueEmpty={isPresenterQueueEffectivelyEmpty}
                />
            </section>

            {/* Right Column */}
            <section className={cn(
                "space-y-4",
                 isCurrentUserAdmin ? "md:col-span-5" : "md:col-span-5"
            )}>
                 {(participantList.length > 0 || isCurrentUserAdmin) && ( 
                    <Card className="w-full shadow-lg">
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
                
                {!isCurrentUserAdmin && sessionData.keyTakeawaysEnabled && (
                    <Card className="w-full shadow-md">
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
                                disabled={isSubmittingTakeaway || !feedbackSubmissionAllowed || !sessionData.keyTakeawaysEnabled || sessionData.sessionEnded}
                            />
                            <Button onClick={handleSubmitTakeaway} className="w-full" disabled={isSubmittingTakeaway || !takeawayInput.trim() || !feedbackSubmissionAllowed || !sessionData.keyTakeawaysEnabled || sessionData.sessionEnded}>
                                {isSubmittingTakeaway ? 'Submitting...' : <><Send className="mr-2 h-4 w-4"/>Submit Takeaway</>}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!isCurrentUserAdmin && sessionData.qnaEnabled && (
                     <Card className="w-full shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center"><MessageSquarePlus className="mr-2 h-5 w-5 text-primary" />Ask a Question</CardTitle>
                            <CardDescription>Submit a question. (Max {MAX_QUESTION_LENGTH} chars)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                value={questionInput}
                                onChange={(e) => setQuestionInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
                                placeholder="Enter your question..."
                                maxLength={MAX_QUESTION_LENGTH}
                                rows={3}
                                disabled={isSubmittingQuestion || !feedbackSubmissionAllowed || !sessionData.qnaEnabled || sessionData.sessionEnded}
                            />
                            <Button onClick={handleSubmitQuestion} className="w-full" disabled={isSubmittingQuestion || !questionInput.trim() || !feedbackSubmissionAllowed || !sessionData.qnaEnabled || sessionData.sessionEnded}>
                                {isSubmittingQuestion ? 'Submitting...' : <><Send className="mr-2 h-4 w-4"/>Submit Question</>}
                            </Button>
                        </CardContent>
                    </Card>
                )}


                {/* Admin Controls and Displays */}
                {isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && (
                  <>
                    <Card className="w-full shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-center text-xl md:text-2xl font-bold flex items-center justify-center">
                            <ShieldAlert className="mr-2 h-6 w-6" /> Admin Controls
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="presenters">
                                    <AccordionTrigger className="text-lg font-semibold">Presenter & Round Management</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-3">
                                        <div className="space-y-3 border p-3 rounded-md bg-muted/20 dark:bg-muted/30">
                                            <h3 className="text-md font-semibold flex items-center">
                                                <ListChecks className="mr-2 h-5 w-5 text-primary" />Presenter List
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Enter one presenter name per line. Click 'Set/Update' to apply. This will reset scores and start/manage the round for presenters. If the list is empty, the session operates in a general feedback mode.</p></TooltipContent>
                                                </Tooltip>
                                            </h3>
                                            <Textarea
                                                placeholder="Enter presenter names, one per line..."
                                                value={presenterQueueInput}
                                                onChange={(e) => setPresenterQueueInput(e.target.value)}
                                                rows={3}
                                                disabled={isProcessingAdminAction}
                                            />
                                            {participantList.length > 0 && (
                                                <>
                                                    <h4 className="text-sm font-semibold mt-2 mb-1 text-muted-foreground">Add from participants:</h4>
                                                    <ScrollArea className="h-28 border rounded-md p-2 bg-muted/30 dark:bg-muted/50">
                                                        <ul className="space-y-1">
                                                            {participantList.map(p => (
                                                                <li key={p.uid} className="flex justify-between items-center text-xs p-1 hover:bg-muted/50 dark:hover:bg-muted/70 rounded">
                                                                    <span>{p.nickname || 'Anonymous User'}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const currentQueueNames = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name !== '');
                                                                            if (p.nickname && !currentQueueNames.includes(p.nickname)) {
                                                                                setPresenterQueueInput(prev => `${prev.trim()}\n${p.nickname}`.trim());
                                                                                toast({ title: "Added to Text Area", description: `${p.nickname} added to the presenter list text area. Click 'Set/Update' to apply.` });
                                                                            } else if (!p.nickname) {
                                                                                toast({ title: "Cannot Add", description: `Participant has no nickname set.`, variant: "destructive"});
                                                                            } else {
                                                                                toast({ title: "Already in List", description: `${p.nickname} is already in the presenter list text area.`});
                                                                            }
                                                                        }}
                                                                        disabled={isProcessingAdminAction || !p.nickname}
                                                                        className="h-6 px-1.5"
                                                                    >
                                                                        <UserPlusIcon className="mr-1 h-3 w-3"/> Add
                                                                    </Button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </ScrollArea>
                                                </>
                                            )}
                                            <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                                <Button onClick={handleSetPresenterQueue} variant="outline" className="w-full sm:flex-grow text-sm" disabled={isProcessingAdminAction}>
                                                    Set/Update Presenter List
                                                </Button>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            onClick={handleNextPresenter}
                                                            className="w-full sm:w-auto text-sm"
                                                            disabled={nextPresenterButtonDisabled}
                                                        >
                                                            Next Presenter <ChevronsRight className="ml-1 h-4 w-4"/>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Advance to the next presenter. Scores reset, round opens.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                            {!isPresenterQueueEffectivelyEmpty && sessionData.presenterQueue && sessionData.presenterQueue.length > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    Current: {sessionData.currentPresenterName || "N/A"} ({(sessionData.currentPresenterIndex ?? -1) + 1} of {sessionData.presenterQueue.length})
                                                </p>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-3 border p-3 rounded-md bg-muted/20 dark:bg-muted/30">
                                            <h3 className="text-md font-semibold">General Round & Score Controls</h3>
                                             <div className="text-xs text-center font-medium">
                                                Feedback Round Status: <span className={sessionData.isRoundActive ? "text-green-500" : "text-red-500"}>
                                                    {sessionData.isRoundActive ? 'OPEN' : 'CLOSED'}
                                                </span>
                                                {!isSpecificPresenterActive && !isPresenterQueueEffectivelyEmpty && sessionData.isRoundActive && sessionData.currentPresenterIndex === -1 && (
                                                    <span className="text-xs text-orange-500"> (General - Queue set, not started)</span>
                                                )}
                                                 {isPresenterQueueEffectivelyEmpty && sessionData.isRoundActive && (
                                                    <span className="text-xs text-green-600"> (General Session)</span>
                                                 )}
                                            </div>
                                            <div className="flex items-center">
                                                <Button
                                                    onClick={handleToggleRound}
                                                    variant="outline"
                                                    className="w-full text-sm"
                                                    disabled={disableOpenCloseRoundButton}
                                                >
                                                {sessionData.isRoundActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                                {sessionData.isRoundActive ? 'Close Feedback Round' : 'Open Feedback Round'}
                                                </Button>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Open or close the feedback round. If presenters are set and active, applies to current presenter. If queue is set but not started, or if queue is empty, applies as a general round. Closing resets participant vote status.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div className="flex items-center">
                                                <Button
                                                    onClick={handleClearScores}
                                                    variant="outline"
                                                    className="w-full text-sm"
                                                    disabled={disableClearScoresButton}
                                                >
                                                <RotateCcw className="mr-2 h-4 w-4" /> Clear Scores & Reset Votes
                                                </Button>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Reset Like/Dislike scores to zero and clear participant vote status. Applies to current context (presenter or general round).</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="settings">
                                    <AccordionTrigger className="text-lg font-semibold">Session Settings & Features</AccordionTrigger>
                                    <AccordionContent className="space-y-3 pt-3">
                                        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-muted/20 dark:bg-muted/30">
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
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Enable or disable sound effects for like/dislike votes for all participants.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-muted/20 dark:bg-muted/30">
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
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Show or hide the live leaderboard scores from participants.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-muted/20 dark:bg-muted/30">
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
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Allow participants to submit a key takeaway. Applies when a feedback round is active.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between space-x-2 p-2 border rounded-md bg-muted/20 dark:bg-muted/30">
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
                                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                                    <TooltipContent><p>Allow participants to submit questions. Applies when a feedback round is active.</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                            
                            <div className="mt-6 pt-6 border-t dark:border-gray-700">
                                <div className="flex items-center">
                                    <Button onClick={triggerEndSessionDialog} variant="destructive" className="w-full" disabled={isProcessingAdminAction}>
                                        <Trash2 className="mr-2 h-4 w-4" /> End Session
                                    </Button>
                                    <Tooltip>
                                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-8 w-8"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                        <TooltipContent><p>Permanently end this session for all participants. This action cannot be undone.</p></TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="w-full shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center justify-center">
                                <FileText className="mr-2 h-5 w-5" /> Key Takeaways
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!sessionData.keyTakeawaysEnabled ? (
                                <p className="text-sm text-muted-foreground text-center">Key takeaway submissions are currently disabled.</p>
                            ) : (sessionData.keyTakeaways && sessionData.keyTakeaways.length > 0) ? (
                                <ScrollArea className="h-60">
                                    <ul className="space-y-3">
                                        {sessionData.keyTakeaways.sort((a,b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0)).map((item, index) => (
                                            <li key={index} className="p-3 border rounded-md bg-muted/30 dark:bg-muted/50">
                                                <p className="text-sm break-words">{item.takeaway}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    - {item.nickname} ({item.submittedAt ? formatDistanceToNow(item.submittedAt.toDate(), { addSuffix: true }) : 'just now'})
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">No key takeaways submitted yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="w-full shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center justify-center">
                                <MessageCircleQuestion className="mr-2 h-5 w-5" /> Questions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!sessionData.qnaEnabled ? (
                                <p className="text-sm text-muted-foreground text-center">Q&A submissions are currently disabled.</p>
                            ) : (sessionData.questions && sessionData.questions.length > 0) ? (
                                <ScrollArea className="h-60">
                                    <ul className="space-y-3">
                                        {sessionData.questions.sort((a,b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0)).map((item, index) => (
                                            <li key={index} className="p-3 border rounded-md bg-muted/30 dark:bg-muted/50">
                                                <p className="text-sm break-words">{item.questionText}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    - {item.nickname} ({item.submittedAt ? formatDistanceToNow(item.submittedAt.toDate(), { addSuffix: true }) : 'just now'})
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">No questions submitted yet.</p>
                            )}
                        </CardContent>
                    </Card>
                  </>
                )}
            </section>
        </div>

        <div className="mt-12 flex justify-center">
            {isCurrentUserAdmin && sessionData && sessionData.sessionEnded && (
                <Card className="w-full max-w-md shadow-lg">
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

            {!isCurrentUserAdmin && !sessionData.sessionEnded && !error && (
                <Button onClick={() => router.push('/')} variant="outline">
                    <Home className="mr-2 h-4 w-4" /> Leave Session
                </Button>
            )}
            {(!isCurrentUserAdmin && (sessionData.sessionEnded || error)) && (
                <Button onClick={() => router.push('/')} variant="outline">
                    <Home className="mr-2 h-4 w-4" /> Go to Homepage
                </Button>
            )}
        </div>

        <AlertDialog open={showEndSessionDialog} onOpenChange={setShowEndSessionDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will permanently end the session for all participants. This cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowEndSessionDialog(false)} disabled={isProcessingAdminAction}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeEndSession} disabled={isProcessingAdminAction}>
                    {isProcessingAdminAction ? "Ending..." : "Yes, End Session"}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </main>
  );
}

    