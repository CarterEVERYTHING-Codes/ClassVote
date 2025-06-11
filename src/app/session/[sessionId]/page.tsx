
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, DocumentData, serverTimestamp, Timestamp, FieldValue, increment, getDoc, FirestoreError, deleteField, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/contexts/auth-context'; 
import { User as FirebaseUserType } from 'firebase/auth'; 
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import OverallLeaderboard from '@/components/overall-leaderboard'; 
import { Button, buttonVariants } from '@/components/ui/button';
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
    Play, Pause, ShieldAlert, Trash2, Copy, Home, Users, Volume2, VolumeX, Eye, EyeOff,
    ListChecks, ChevronsRight, Info, UserPlusIcon, LogIn, UserX, Settings, ListPlus
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";


interface ParticipantData {
  nickname: string;
  joinedAt: Timestamp | FieldValue;
  uid: string; 
}

interface PresenterEntry {
  name: string;
  uid?: string | null; 
}

interface PresenterScore {
  name: string;
  uid?: string | null; 
  likes: number;
  dislikes: number;
  netScore: number;
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
  presenterQueue?: PresenterEntry[];
  currentPresenterIndex?: number;
  currentPresenterName?: string;
  currentPresenterUid?: string | null; 
  sessionType?: string;
  presenterScores?: PresenterScore[];
}

interface ParticipantToKick {
  uid: string;
  nickname: string;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { toast } = useToast();
  const { user: authUser, loading: authLoading, ensureAnonymousSignIn } = useAuth(); 

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true); 
  const [error, setError] = useState<string | null>(null);

  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isProcessingAdminAction, setIsProcessingAdminAction] = useState(false);
  
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [hasSubmittedNickname, setHasSubmittedNickname] = useState(false);

  const [presenterQueueInput, setPresenterQueueInput] = useState('');
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [showKickConfirmDialog, setShowKickConfirmDialog] = useState(false);
  const [participantToKick, setParticipantToKick] = useState<ParticipantToKick | null>(null);


  useEffect(() => {
    if (!sessionId) {
      setIsLoadingSession(false);
      setError("No session ID provided.");
      router.push('/');
      return;
    }

    if (authLoading) { 
        setIsLoadingSession(true);
        return;
    }
    
    const sessionDocRef = doc(db, 'sessions', sessionId);
    const unsubscribeFirestore = onSnapshot(sessionDocRef, (docSnap) => {
      setIsLoadingSession(false);
      if (docSnap.exists()) {
        const data = docSnap.data() as SessionData;
        setSessionData(data);

        if (isCurrentUserAdmin && data.presenterQueue && data.presenterQueue.length > 0 && !data.sessionEnded) {
           // Only set presenterQueueInput from Firestore if it's currently empty,
           // or if the presenter index has advanced (to avoid overwriting admin's edits if they are just typing)
           // The visual update of removing presented users is handled directly in handleNextPresenter for immediate feedback.
           if (presenterQueueInput.trim() === '' && data.currentPresenterIndex === -1) { 
             setPresenterQueueInput(data.presenterQueue.map(p => p.name).join('\n'));
           }
        }


        if (data.sessionEnded) {
          setError("This session has ended.");
        } else {
          setError(null);
        }
        
        if (authUser && !data.participants?.[authUser.uid] && hasSubmittedNickname && !data.sessionEnded) {
            toast({ title: "Removed from session", description: "You have been removed from this session by the admin.", variant: "destructive" });
            router.push('/'); 
            return;
        }

        if (authUser && data.participants?.[authUser.uid]?.nickname) {
          setNicknameInput(data.participants[authUser.uid].nickname);
          if(!hasSubmittedNickname) setHasSubmittedNickname(true); 
        } else if (authUser && !data.sessionEnded) {
          if (!data.participants?.[authUser.uid]) {
             setHasSubmittedNickname(false);
          }
        }

      } else {
        setSessionData(null);
        setError("This session cannot be found. It may have been ended or never existed.");
        setHasSubmittedNickname(false);
      }
    }, (err) => {
      console.error("Error fetching session data: ", err);
      setError("Error loading session. Please try again.");
      toast({ title: "Error", description: "Could not load session data.", variant: "destructive" });
      setIsLoadingSession(false);
      setHasSubmittedNickname(false);
    });
    return () => unsubscribeFirestore();
  }, [sessionId, router, toast, authUser, authLoading, isCurrentUserAdmin, hasSubmittedNickname]);


  useEffect(() => {
    if (authUser && sessionData) {
      setIsCurrentUserAdmin(authUser.uid === sessionData.adminUid);
    } else {
      setIsCurrentUserAdmin(false);
    }
  }, [authUser, sessionData]);

  const handleSetNickname = async () => {
    let currentUser = authUser;
    if (!currentUser) {
        currentUser = await ensureAnonymousSignIn(); 
    }

    if (!currentUser || !nicknameInput.trim() || sessionData?.sessionEnded) {
      toast({ title: "Cannot set nickname", description: "Nickname is required or session has ended.", variant: "destructive"});
      return;
    }
    if (hasSubmittedNickname && sessionData?.participants?.[currentUser.uid]?.nickname === nicknameInput.trim()) { 
        toast({ title: "Nickname Set", description: "Your nickname for this session is already set.", variant: "default"});
        return;
    }
     if (hasSubmittedNickname) {
      toast({ title: "Nickname Immutable", description: "Your nickname cannot be changed for this session.", variant: "destructive" });
      return;
    }


    setIsSavingNickname(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      const currentSessionSnap = await getDoc(sessionDocRef);
      if (!currentSessionSnap.exists()) {
        toast({ title: "Error", description: "Session not found.", variant: "destructive" });
        setIsSavingNickname(false);
        return;
      }
      const currentSessionData = currentSessionSnap.data() as SessionData;
      if (currentSessionData.sessionEnded) {
        toast({ title: "Session Ended", description: "Cannot set nickname, the session has ended.", variant: "default"});
        setIsSavingNickname(false);
        return;
      }

      const trimmedNickname = nicknameInput.trim();
      const existingNicknames = Object.values(currentSessionData.participants || {}).map(p => p.nickname.toLowerCase());
      if (existingNicknames.includes(trimmedNickname.toLowerCase())) {
        toast({ title: "Nickname Taken", description: "This nickname is already in use in this session. Please choose another.", variant: "destructive" });
        setIsSavingNickname(false);
        return;
      }

      const newParticipantData: ParticipantData = {
        nickname: trimmedNickname,
        joinedAt: serverTimestamp(),
        uid: currentUser.uid 
      };
      await updateDoc(sessionDocRef, {
        [`participants.${currentUser.uid}`]: newParticipantData
      });
      toast({ title: "Nickname Set!", description: `You have joined the session as "${trimmedNickname}".` });
      setHasSubmittedNickname(true); 
    } catch (error) {
      console.error("Error setting nickname: ", error);
      let errorMessageText = "Could not save nickname.";
      if (error instanceof FirestoreError) errorMessageText = `Could not save nickname: ${error.message} (Code: ${error.code})`;
      else if (error instanceof Error) errorMessageText = `Could not save nickname: ${error.message}`;
      toast({ title: "Error", description: errorMessageText, variant: "destructive" });
    }
    setIsSavingNickname(false);
  };

  const handleAdminAction = async (action: () => Promise<void>, successMessage: string, errorMessage: string) => {
    if (!isCurrentUserAdmin || !sessionData || (sessionData.sessionEnded && action !== executeEndSession) || isProcessingAdminAction || !hasSubmittedNickname) {
        if (!hasSubmittedNickname && isCurrentUserAdmin) {
            toast({title: "Set Nickname First", description: "Please set your admin nickname to manage the session.", variant: "default"});
        }
        return;
    }
    setIsProcessingAdminAction(true);
    try {
      await action();
      if (successMessage) toast({ title: "Admin Action Successful", description: successMessage });
    } catch (error) {
      console.error(`Error during admin action (${successMessage || 'unknown action'}): `, error);
      let displayError = errorMessage;
      if (error instanceof FirestoreError) displayError = `${errorMessage} (Code: ${error.code})`;
      toast({ title: "Error", description: displayError, variant: "destructive" });
    } finally {
        setIsProcessingAdminAction(false);
    }
  };

  const handleTogglePauseResumeFeedback = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { isRoundActive: !sessionData!.isRoundActive });
      },
      `Feedback round is now ${!sessionData!.isRoundActive ? 'RESUMED (OPEN)' : 'PAUSED (CLOSED)'}.`,
      "Could not update feedback round status."
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

  const triggerEndSessionDialog = () => {
    if (isProcessingAdminAction || !isCurrentUserAdmin || !sessionData || !hasSubmittedNickname) { 
      return;
    }
    setShowEndSessionDialog(true);
  }

 const executeEndSession = async () => {
    if (!isCurrentUserAdmin || !sessionData || !hasSubmittedNickname) {
      setShowEndSessionDialog(false);
      return;
    }
    
    setIsProcessingAdminAction(true); 
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      const updatePayload: any = { 
          sessionEnded: true, 
          isRoundActive: false 
      };

      if (!sessionData.sessionEnded) { 
        if (
            sessionData.currentPresenterName &&
            sessionData.currentPresenterName !== "End of Queue" &&
            sessionData.presenterQueue && sessionData.presenterQueue.length > 0 &&
            sessionData.currentPresenterIndex !== undefined && sessionData.currentPresenterIndex >= 0 && sessionData.currentPresenterIndex < sessionData.presenterQueue.length
        ) {
            const currentPresenterDetails = sessionData.presenterQueue[sessionData.currentPresenterIndex];
            const finalScore: PresenterScore = {
                name: currentPresenterDetails.name, 
                uid: currentPresenterDetails.uid || null, 
                likes: sessionData.likeClicks,
                dislikes: sessionData.dislikeClicks,
                netScore: sessionData.likeClicks - sessionData.dislikeClicks,
            };
            updatePayload.presenterScores = arrayUnion(finalScore);
            await updateDoc(sessionDocRef, updatePayload);
            toast({ title: "Session Ended", description: `Final scores for ${currentPresenterDetails.name} recorded. Admin is redirecting...` });
        } else {
            await updateDoc(sessionDocRef, updatePayload);
            toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
        }
      } else {
        toast({ title: "Session Already Ended", description: "Admin is redirecting..." });
      }

      if (typeof router.asPath === 'string' && router.asPath.startsWith('/session/')) { 
         router.push('/');
      }
    } catch (error) {
      console.error("Error ending session details: ", error);
      let errorMessageText = "Could not end session. Please try again.";
      if (error instanceof FirestoreError) errorMessageText = `Could not end session: ${error.message} (Code: ${error.code})`;
      else if (error instanceof Error) errorMessageText = `Could not end session: ${error.message}`;
      toast({ title: "Error Ending Session", description: errorMessageText, variant: "destructive" });
    } finally {
      setIsProcessingAdminAction(false);
      setShowEndSessionDialog(false);
    }
  };

  const handleSetPresenterQueue = () =>
    handleAdminAction(
        async () => {
            const nameLines = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0);
            
            const participantNicknameToUidMap = new Map<string, string>();
            Object.entries(sessionData?.participants || {}).forEach(([uid, pData]) => {
                participantNicknameToUidMap.set(pData.nickname.toLowerCase(), uid);
            });

            const newQueue: PresenterEntry[] = nameLines.map(name => {
                const matchedUid = participantNicknameToUidMap.get(name.toLowerCase());
                return { name, uid: matchedUid || null };
            });

            const sessionDocRef = doc(db, 'sessions', sessionId);

            let newPresenterName = "";
            let newPresenterUid: string | null = null;
            let newPresenterIndex = -1;
            let roundActive = false;

            if (newQueue.length > 0) {
                newPresenterName = newQueue[0].name;
                newPresenterUid = newQueue[0].uid || null;
                newPresenterIndex = 0;
                roundActive = true;
            }

            await updateDoc(sessionDocRef, {
                presenterQueue: newQueue,
                currentPresenterIndex: newPresenterIndex,
                currentPresenterName: newPresenterName,
                currentPresenterUid: newPresenterUid,
                likeClicks: 0,
                dislikeClicks: 0,
                isRoundActive: roundActive,
                presenterScores: [], 
            });
        },
        presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name.length > 0).length > 0
            ? "Presenter list updated. Scores reset. Round started for the first presenter. Overall leaderboard reset."
            : "Presenter list cleared. Scores reset. Round closed. Overall leaderboard reset.",
        "Could not update presenter list."
    );

  const handleNextPresenter = () =>
    handleAdminAction(
        async () => {
            if (!sessionData || !sessionData.presenterQueue || sessionData.presenterQueue.length === 0) {
                toast({ title: "No Presenters Set", description: "The presenter list is empty. Please add presenters first.", variant: "default" });
                return;
            }
            const sessionDocRef = doc(db, 'sessions', sessionId);
            
            const { 
                currentPresenterName: currentPresenterNameFromState,
                currentPresenterUid: currentPresenterUidFromState,
                likeClicks: currentLikesFromState, 
                dislikeClicks: currentDislikesFromState,
                currentPresenterIndex: currentIndexFromState = -1,
                presenterQueue: currentQueueFromState = [],
            } = sessionData;

            const updatePayload: any = {
                likeClicks: 0,
                dislikeClicks: 0,
            }; 
            let scoreRecordedMessage = "";
            
            if (currentPresenterNameFromState && 
                currentPresenterNameFromState !== "End of Queue" && 
                currentIndexFromState >= 0 && 
                currentIndexFromState < currentQueueFromState.length) {

                const scoreToRecord: PresenterScore = {
                    name: currentPresenterNameFromState,
                    uid: currentPresenterUidFromState || null, 
                    likes: currentLikesFromState,
                    dislikes: currentDislikesFromState,
                    netScore: currentLikesFromState - currentDislikesFromState,
                };
                updatePayload.presenterScores = arrayUnion(scoreToRecord);
                scoreRecordedMessage = `Scores for ${currentPresenterNameFromState} (Likes: ${currentLikesFromState}, Dislikes: ${currentDislikesFromState}) recorded.`;
            }
            
            const newIndex = currentIndexFromState + 1;
            updatePayload.currentPresenterIndex = newIndex;

            if (newIndex >= currentQueueFromState.length) { 
                updatePayload.isRoundActive = false;
                updatePayload.currentPresenterName = "End of Queue";
                updatePayload.currentPresenterUid = null; 
                setPresenterQueueInput(''); // Clear textarea as queue is done
            } else { 
                const nextPresenter = currentQueueFromState[newIndex];
                updatePayload.currentPresenterName = nextPresenter.name;
                updatePayload.currentPresenterUid = nextPresenter.uid || null;
                updatePayload.isRoundActive = true;
                // Update textarea to show remaining presenters
                const remainingPresenters = currentQueueFromState.slice(newIndex).map(p => p.name).join('\n');
                setPresenterQueueInput(remainingPresenters);
            }
            
            await updateDoc(sessionDocRef, updatePayload);

            let toastTitle = "Next Feedback Round";
            let toastDescription = `${scoreRecordedMessage}`;

            if (newIndex >= currentQueueFromState.length) {
                 toastTitle = "End of Presenter Queue";
                 toastDescription += `${scoreRecordedMessage ? ' ' : ''}You have reached the end of the presenter list. Feedback round closed.`;
            } else {
                 toastDescription += `${scoreRecordedMessage ? ' ' : ''}Now presenting: ${currentQueueFromState[newIndex].name}. Scores reset, feedback round started.`;
            }
             if (scoreRecordedMessage) toastDescription += " Overall leaderboard updated.";
             toast({ title: toastTitle, description: toastDescription, variant: "default" });
        },
        "", 
        "Could not advance to the next feedback round."
    );

  const triggerKickParticipantDialog = (uid: string, nickname: string) => {
    if (!isCurrentUserAdmin || isProcessingAdminAction || authUser?.uid === uid) return;
    setParticipantToKick({ uid, nickname });
    setShowKickConfirmDialog(true);
  };

  const executeKickParticipant = () => {
    if (!participantToKick) return;
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, {
          [`participants.${participantToKick.uid}`]: deleteField()
        });
      },
      `Participant "${participantToKick.nickname}" has been kicked.`,
      `Could not kick participant "${participantToKick.nickname}".`
    ).finally(() => {
      setParticipantToKick(null);
      setShowKickConfirmDialog(false);
    });
  };


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


  const copySessionCode = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId)
      .then(() => toast({ title: "Session Code Copied!", description: sessionId }))
      .catch(() => toast({ title: "Copy Failed", description: "Could not copy code.", variant: "destructive"}));
  }

  if (authLoading || (isLoadingSession && !sessionData)) { 
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
  
  if (authUser && !hasSubmittedNickname && sessionData && !sessionData.sessionEnded) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Enter Your Nickname</CardTitle>
                    <CardDescription className="text-center">
                        Choose a nickname to join session <span className="font-bold">{sessionId}</span>. This cannot be changed later.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        type="text"
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        placeholder="Your nickname (e.g., AlphaLearner)"
                        maxLength={25}
                        disabled={isSavingNickname || hasSubmittedNickname}
                        className="text-lg h-12 text-center"
                    />
                    <Button 
                        onClick={handleSetNickname} 
                        disabled={isSavingNickname || !nicknameInput.trim()}
                        className="w-full text-lg py-6"
                    >
                        {isSavingNickname ? 'Joining...' : <> <LogIn className="mr-2 h-5 w-5"/> Join Session </>}
                    </Button>
                </CardContent>
            </Card>
             <Button onClick={() => router.push('/')} variant="link" className="mt-6 text-muted-foreground">
                <Home className="mr-2 h-4 w-4" /> Or go back to Homepage
            </Button>
        </main>
    );
  }
  

  if (!authUser && !authLoading && sessionData && !sessionData.sessionEnded && !hasSubmittedNickname) {
     return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
          <Card className="w-full max-w-md shadow-xl">
              <CardHeader>
                  <CardTitle className="text-2xl text-center">Enter Your Nickname</CardTitle>
                  <CardDescription className="text-center">
                      Choose a nickname to join session <span className="font-bold">{sessionId}</span>. This cannot be changed later.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <Input
                      type="text"
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="Your nickname (e.g., AlphaLearner)"
                      maxLength={25}
                      disabled={isSavingNickname}
                      className="text-lg h-12 text-center"
                  />
                  <Button 
                      onClick={handleSetNickname} 
                      disabled={isSavingNickname || !nicknameInput.trim()}
                      className="w-full text-lg py-6"
                  >
                      {isSavingNickname ? 'Joining...' : <> <LogIn className="mr-2 h-5 w-5"/> Join Session </>}
                  </Button>
              </CardContent>
          </Card>
           <Button onClick={() => router.push('/')} variant="link" className="mt-6 text-muted-foreground">
              <Home className="mr-2 h-4 w-4" /> Or go back to Homepage
          </Button>
      </main>
    );
  }

  if (isLoadingSession || !sessionData) { 
     return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-lg text-muted-foreground animate-pulse">Loading session data...</p>
      </main>
    );
  }


  const participantList = Object.entries(sessionData.participants || {})
    .map(([uid, data]) => ({ uid, nickname: data.nickname, joinedAt: data.joinedAt }))
    .sort((a, b) => {
        const timeAValue = a.joinedAt;
        const timeBValue = b.joinedAt;
        const timeA = timeAValue instanceof Timestamp ? timeAValue.toMillis() : (typeof (timeAValue as any)?.seconds === 'number' ? (timeAValue as any).seconds * 1000 : Date.now());
        const timeB = timeBValue instanceof Timestamp ? timeBValue.toMillis() : (typeof (timeBValue as any)?.seconds === 'number' ? (timeBValue as any).seconds * 1000 : Date.now());
        return timeA - timeB;
    });
  
  const currentParticipantCount = Object.keys(sessionData.participants || {}).length;
  
  const isCurrentPresenterTheLastInQueue = 
    !isPresenterQueueEffectivelyEmpty &&
    sessionData.currentPresenterIndex !== undefined &&
    sessionData.presenterQueue!.length > 0 &&
    sessionData.currentPresenterIndex === sessionData.presenterQueue!.length - 1 &&
    sessionData.currentPresenterName !== "End of Queue";


  let sessionStatusMessage = "";
  let presenterDisplayMessage = "";
  let currentPresenterInfoForDisplay = "";


  if (sessionData.currentPresenterName === "End of Queue") {
    currentPresenterInfoForDisplay = "End of Queue";
  } else if (isSpecificPresenterActive && sessionData.presenterQueue && sessionData.presenterQueue.length > 0 && sessionData.currentPresenterIndex !== undefined) {
    const totalPresenters = sessionData.presenterQueue.length;
    const currentIndexHuman = sessionData.currentPresenterIndex + 1;
    currentPresenterInfoForDisplay = `${sessionData.currentPresenterName} (${currentIndexHuman} of ${totalPresenters})`;
  } else if (!isPresenterQueueEffectivelyEmpty && sessionData.currentPresenterIndex === -1 && sessionData.presenterQueue && sessionData.presenterQueue.length > 0) {
    currentPresenterInfoForDisplay = `Queue ready (${sessionData.presenterQueue.length} presenter${sessionData.presenterQueue.length === 1 ? '' : 's'})`;
  } else {
    currentPresenterInfoForDisplay = "N/A";
  }


  if (isSpecificPresenterActive) {
      presenterDisplayMessage = `Now Presenting: ${sessionData.currentPresenterName}`;
      sessionStatusMessage = sessionData.isRoundActive ? "Feedback round is OPEN for the current presenter. Cast your vote!" : "Feedback round is PAUSED for the current presenter.";
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
      sessionStatusMessage = sessionData.isRoundActive ? "General feedback round is OPEN. Cast your vote!" : "General feedback round is PAUSED.";
  }


  const disablePauseResumeButton = isProcessingAdminAction || (sessionData.currentPresenterName === "End of Queue" && !sessionData.isRoundActive);

  const nextFeedbackRoundButtonDisabled = isProcessingAdminAction ||
                                   isPresenterQueueEffectivelyEmpty ||
                                   sessionData.currentPresenterName === "End of Queue" || 
                                   (sessionData.currentPresenterIndex === -1 && sessionData.presenterQueue && sessionData.presenterQueue.length === 0) || 
                                   (sessionData.currentPresenterIndex === -1 && sessionData.presenterQueue && sessionData.presenterQueue.length > 0 && !sessionData.isRoundActive && !isCurrentUserAdmin && !sessionData.sessionEnded); 

  const selfNickname = authUser ? sessionData?.participants?.[authUser.uid]?.nickname : undefined;
  const isSelfPresenter = !!(
      authUser &&
      sessionData?.currentPresenterName &&
      selfNickname &&
      sessionData.currentPresenterName === selfNickname &&
      sessionData.currentPresenterName !== "End of Queue" &&
      sessionData.currentPresenterUid === authUser.uid 
  );
  
  const isOverallLeaderboardVisibleToUser = sessionData.resultsVisible || isCurrentUserAdmin;
  const showLiveOverallLeaderboard =
    sessionData &&
    sessionData.presenterScores &&
    sessionData.presenterScores.length > 0 &&
    !sessionData.sessionEnded && 
    isOverallLeaderboardVisibleToUser;
  
  const showFinalOverallLeaderboard = 
    sessionData.sessionEnded &&
    sessionData.presenterScores && 
    sessionData.presenterScores.length > 0;


  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <TooltipProvider>
        <div className="text-center mb-6 relative">
            <div className="absolute top-0 left-0">
                 {selfNickname && (
                    <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                        Joined as: <span className="font-semibold text-primary">{selfNickname}</span>
                    </span>
                 )}
            </div>
            <div className="flex flex-col items-center justify-center mb-1">
                <div className="flex items-center justify-center">
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
                <div className="flex items-center justify-center mt-1 text-sm text-muted-foreground">
                    <Users className="mr-1.5 h-4 w-4" />
                    <span>{currentParticipantCount} Participant{currentParticipantCount === 1 ? '' : 's'}</span>
                </div>
            </div>
            {presenterDisplayMessage && (
                <p className={`text-xl md:text-2xl font-semibold ${isSpecificPresenterActive ? 'text-accent' : 'text-muted-foreground'}`}>{presenterDisplayMessage}</p>
            )}
            <p className="text-md sm:text-lg text-muted-foreground mt-1">
                {sessionStatusMessage}
            </p>
             {!sessionData.sessionEnded && !feedbackSubmissionAllowed && sessionData.isRoundActive && (
                <p className="text-sm text-orange-500 mt-1">
                    Submissions (votes) are paused until the admin selects an active presenter or if the queue has ended.
                </p>
            )}
        </div>

        {!sessionData.sessionEnded && (
            <div className="mb-8 flex justify-center">
                <GoodBadButtonsLoader
                    sessionId={sessionId}
                    isRoundActive={feedbackSubmissionAllowed}
                    soundsEnabled={sessionData.soundsEnabled}
                    roundId={sessionData?.currentPresenterIndex ?? -1}
                />
            </div>
        )}

        <div className={cn(
            "grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start"
        )}>

            <section className={cn(
                "space-y-4 md:col-span-7" 
            )}>
                <Leaderboard
                    sessionId={sessionId}
                    resultsVisible={sessionData.resultsVisible}
                    currentPresenterName={isSpecificPresenterActive ? sessionData.currentPresenterName : null}
                    presenterQueueEmpty={isPresenterQueueEffectivelyEmpty}
                    isCurrentPresenterSelf={isSelfPresenter}
                    likeClicks={sessionData.likeClicks}
                    dislikeClicks={sessionData.dislikeClicks}
                />
                 {showLiveOverallLeaderboard && (
                    <OverallLeaderboard presenterScores={sessionData.presenterScores!} />
                )}
                 {showFinalOverallLeaderboard && (
                    <OverallLeaderboard presenterScores={sessionData.presenterScores!} />
                 )}
            </section>

            <section className={cn(
                "space-y-4 md:col-span-5" 
            )}>
                 {(participantList.length > 0 ) && (
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
                                <li key={p.uid} className={`flex justify-between items-center p-1 text-xs hover:bg-muted/50 dark:hover:bg-muted/70 rounded ${authUser?.uid === p.uid ? 'font-bold text-primary bg-primary/10' : ''}`}>
                                    <span>{p.nickname || 'Anonymous User'}</span>
                                    {isCurrentUserAdmin && authUser?.uid !== p.uid && !sessionData.sessionEnded && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => triggerKickParticipantDialog(p.uid, p.nickname || 'Anonymous User')}
                                                    disabled={isProcessingAdminAction}
                                                >
                                                    <UserX className="mr-1 h-3 w-3"/> Kick
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Remove {p.nickname || 'this user'} from session</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                </li>
                                ))}
                            </ul>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                {isCurrentUserAdmin && sessionData && !sessionData.sessionEnded && (
                  <div className="space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center">
                                <ListChecks className="mr-2 h-5 w-5 text-primary" />
                                Presenter & Round Management
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="presenter-queue-input" className="text-sm font-medium">Presenter List</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6 align-middle"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                    <TooltipContent side="top" align="start"><p className="max-w-xs">Enter one presenter name per line. If a name matches a participant's nickname, their account will be linked. Click 'Set/Update' to apply. This resets scores and starts the round for the first presenter or clears the queue.</p></TooltipContent>
                                </Tooltip>
                                <Textarea
                                    id="presenter-queue-input"
                                    placeholder="Enter presenter names, one per line..."
                                    value={presenterQueueInput}
                                    onChange={(e) => setPresenterQueueInput(e.target.value)}
                                    rows={3}
                                    disabled={isProcessingAdminAction}
                                    className="mt-1"
                                />
                            </div>

                            {participantList.length > 0 && (
                                <details className="group">
                                    <summary className="flex items-center cursor-pointer text-sm font-medium text-primary hover:underline">
                                        <ListPlus className="mr-2 h-4 w-4" />
                                        Add from Participants to Queue
                                        <span className="ml-1 text-muted-foreground text-xs">(click to expand)</span>
                                    </summary>
                                    <ScrollArea className="mt-2 h-32 border rounded-md p-2 bg-muted/30 dark:bg-muted/50 group-open:animate-accordion-down">
                                        <ul className="space-y-1">
                                            {participantList.map(p => (
                                                <li key={`add-${p.uid}`} className="flex justify-between items-center text-xs p-1 hover:bg-muted/50 dark:hover:bg-muted/70 rounded">
                                                    <span>{p.nickname || 'Anonymous User'}</span>
                                                    <Button
                                                        variant="outline"
                                                        size="xs" 
                                                        onClick={() => {
                                                            const currentQueueNames = presenterQueueInput.split('\n').map(name => name.trim()).filter(name => name !== '');
                                                            if (p.nickname && !currentQueueNames.includes(p.nickname)) {
                                                                setPresenterQueueInput(prev => `${prev.trim()}\n${p.nickname}`.trim());
                                                                toast({ title: "Added to Text Area", description: `${p.nickname} added. Click 'Set/Update' to finalize.` });
                                                            } else if (!p.nickname) {
                                                                toast({ title: "Cannot Add", description: `Participant has no nickname.`, variant: "destructive"});
                                                            } else {
                                                                toast({ title: "Already in List", description: `${p.nickname} is already in the text area.`});
                                                            }
                                                        }}
                                                        disabled={isProcessingAdminAction || !p.nickname}
                                                        className="h-6 px-1.5 text-xs"
                                                    >
                                                        <UserPlusIcon className="mr-1 h-3 w-3"/> Add
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </ScrollArea>
                                </details>
                            )}
                            <div className="flex flex-col gap-2">
                                <Button onClick={handleSetPresenterQueue} variant="outline" className="w-full text-sm" disabled={isProcessingAdminAction}>
                                    Set/Update Presenter List
                                </Button>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleNextPresenter} 
                                            className="w-full text-sm bg-primary hover:bg-primary/90"
                                            disabled={nextFeedbackRoundButtonDisabled}
                                        >
                                            Next Feedback Round <ChevronsRight className="ml-1 h-4 w-4"/>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Advance to the next presenter. Records current scores, resets for next.</p></TooltipContent>
                                </Tooltip>
                            </div>
                             {!isPresenterQueueEffectivelyEmpty && (
                                <p className="text-xs text-muted-foreground">
                                    Current: {currentPresenterInfoForDisplay}
                                </p>
                            )}
                            <div className="flex items-center space-x-2 pt-2">
                                <Button
                                    onClick={handleTogglePauseResumeFeedback}
                                    variant="outline"
                                    className="flex-1 text-sm"
                                    disabled={disablePauseResumeButton}
                                >
                                {sessionData.isRoundActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                {sessionData.isRoundActive ? 'Pause Feedback' : 'Resume Feedback'}
                                </Button>
                                <Tooltip>
                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                    <TooltipContent><p>Pause or resume the current feedback round. Does not reset scores.</p></TooltipContent>
                                </Tooltip>
                            </div>
                            <p className={`text-xs text-center font-medium ${sessionData.isRoundActive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                Feedback Round Status: {sessionData.isRoundActive ? 'OPEN' : 'PAUSED'}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center">
                                <Settings className="mr-2 h-5 w-5 text-primary" />
                                Session Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between space-x-2 p-3 border rounded-md bg-muted/20 dark:bg-muted/30">
                                <Label htmlFor="sounds-enabled" className="flex items-center text-sm cursor-pointer">
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
                                        <TooltipContent><p>Enable/disable vote sound effects for all.</p></TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="flex items-center justify-between space-x-2 p-3 border rounded-md bg-muted/20 dark:bg-muted/30">
                                <Label htmlFor="results-visible" className="flex items-center text-sm cursor-pointer">
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
                                        <TooltipContent><p>Show/hide live leaderboard from participants.</p></TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-lg border-destructive/50">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center text-destructive">
                                <ShieldAlert className="mr-2 h-5 w-5" /> Danger Zone
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center">
                                <Button onClick={triggerEndSessionDialog} variant="destructive" className="w-full" disabled={isProcessingAdminAction && !showEndSessionDialog}>
                                    <Trash2 className="mr-2 h-4 w-4" /> End Session
                                </Button>
                                <Tooltip>
                                    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-8 w-8"><Info className="h-4 w-4 text-muted-foreground"/></Button></TooltipTrigger>
                                    <TooltipContent><p>Permanently end this session for all. Cannot be undone.</p></TooltipContent>
                                </Tooltip>
                            </div>
                        </CardContent>
                    </Card>
                  </div>
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
                        <p className="text-muted-foreground mb-4">This session has been ended. Final scores are shown above.</p>
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
                    If there is an active presenter, their final scores will be recorded.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowEndSessionDialog(false)} disabled={isProcessingAdminAction && showEndSessionDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeEndSession} disabled={isProcessingAdminAction && showEndSessionDialog}>
                    {(isProcessingAdminAction && showEndSessionDialog) ? "Ending..." : "Yes, End Session"}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showKickConfirmDialog} onOpenChange={setShowKickConfirmDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirm Kick</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to remove "<span className="font-semibold">{participantToKick?.nickname}</span>" from the session? They will be immediately disconnected.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setShowKickConfirmDialog(false); setParticipantToKick(null);}} disabled={isProcessingAdminAction && showKickConfirmDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={executeKickParticipant} className={buttonVariants({variant: "destructive"})} disabled={isProcessingAdminAction && showKickConfirmDialog}>
                    {(isProcessingAdminAction && showKickConfirmDialog) ? "Kicking..." : "Yes, Kick Participant"}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </TooltipProvider>
    </main>
  );
}

