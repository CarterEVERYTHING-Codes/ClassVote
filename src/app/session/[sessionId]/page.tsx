
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation'; 
import { doc, onSnapshot, updateDoc, DocumentData, serverTimestamp, Timestamp, FieldValue, increment, getDoc, FirestoreError, deleteField, arrayUnion, arrayRemove, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/contexts/auth-context'; 
import { User as FirebaseUserType } from 'firebase/auth'; 
import GoodBadButtonsLoader from '@/components/good-bad-buttons-loader';
import Leaderboard from '@/components/leaderboard';
import OverallLeaderboard from '@/components/overall-leaderboard'; 
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    ListChecks, ChevronsRight, Info, UserPlusIcon, LogIn, UserX, Settings, ListPlus, Save, RotateCcw, ListX, ListOrdered
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";


interface ParticipantData {
  nickname: string;
  joinedAt: Timestamp | FieldValue;
  uid: string; 
}

interface PresenterEntry {
  name: string;
  uid: string | null; // Firebase UID of the participant if they have an account
  participantId: string; // The UID of the participant entry when they joined the session (could be anonymous UID)
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
  presenterQueue: PresenterEntry[]; // Changed
  currentPresenterIndex: number; // Remains
  sessionType?: string;
  presenterScores?: PresenterScore[];
  isPermanentlySaved?: boolean;
  votingMode: 'single' | 'infinite'; // New field
}

interface ParticipantToKick {
  uid: string;
  nickname: string;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname(); 
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

        if (data.sessionEnded) {
          if (data.sessionType === 'quick' && !data.isPermanentlySaved) {
            setError("This quick session has ended and was likely removed.");
            setTimeout(() => {
                if (pathname === `/session/${sessionId}`) router.push('/');
            }, 3000);
          } else {
            setError("This session has ended.");
          }
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
  }, [sessionId, router, toast, authUser, authLoading, hasSubmittedNickname, pathname]);


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
  
  const handleTogglePermanentSave = () =>
    handleAdminAction(
      async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { isPermanentlySaved: !sessionData!.isPermanentlySaved });
      },
      `Session is now ${!sessionData!.isPermanentlySaved ? "permanently saved" : "set for potential auto-deletion (if applicable)"}.`,
      "Could not update session save status."
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
    
    const sessionDocRef = doc(db, 'sessions', sessionId);
    setIsProcessingAdminAction(true);

    if (sessionData.sessionType === 'quick' && !sessionData.isPermanentlySaved) {
        try {
            await deleteDoc(sessionDocRef);
            toast({ title: "Quick Session Ended & Deleted", description: "The session has been removed. Admin is redirecting..." });
            if (pathname && pathname.startsWith(`/session/${sessionId}`)) {
                router.push('/');
            }
        } catch (error) {
            console.error("Error deleting quick session: ", error);
            let errorMessageText = "Could not delete quick session. Please try again.";
            if (error instanceof FirestoreError) errorMessageText = `Could not delete quick session: ${error.message} (Code: ${error.code})`;
            else if (error instanceof Error) errorMessageText = `Could not delete quick session: ${error.message}`;
            toast({ title: "Error Ending Session", description: errorMessageText, variant: "destructive" });
            try { await updateDoc(sessionDocRef, { sessionEnded: true, isRoundActive: false }); } catch (e) { console.error("Fallback end failed", e); }
        } finally {
            setIsProcessingAdminAction(false);
            setShowEndSessionDialog(false);
        }
    } else {
        try {
            const updatePayload: any = {
                sessionEnded: true,
                isRoundActive: false
            };

            if (!sessionData.sessionEnded) {
                const currentPresenter = (sessionData.currentPresenterIndex >= 0 && sessionData.presenterQueue[sessionData.currentPresenterIndex]) 
                                         ? sessionData.presenterQueue[sessionData.currentPresenterIndex] 
                                         : null;

                if (currentPresenter) {
                    const finalScore: PresenterScore = {
                        name: currentPresenter.name,
                        uid: currentPresenter.uid || null,
                        likes: sessionData.likeClicks,
                        dislikes: sessionData.dislikeClicks,
                        netScore: sessionData.likeClicks - sessionData.dislikeClicks,
                    };
                    updatePayload.presenterScores = arrayUnion(finalScore);
                    await updateDoc(sessionDocRef, updatePayload);
                    toast({ title: "Session Ended", description: `Final scores for ${currentPresenter.name} recorded. Admin is redirecting...` });
                } else {
                    await updateDoc(sessionDocRef, updatePayload);
                    toast({ title: "Session Ended", description: "The session has been closed. Admin is redirecting..." });
                }
            } else {
                toast({ title: "Session Already Ended", description: "Admin is redirecting..." });
            }
            
            setSessionData(prev => prev ? {...prev, sessionEnded: true, isRoundActive: false} : null);

            if (pathname && pathname.startsWith(`/session/${sessionId}`)) {
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
    }
  };

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
        // Also remove from presenterQueue if they are in it
        const batch = writeBatch(db);
        batch.update(sessionDocRef, {
          [`participants.${participantToKick.uid}`]: deleteField()
        });

        if (sessionData?.presenterQueue && sessionData.presenterQueue.some(p => p.participantId === participantToKick.uid)) {
            const newQueue = sessionData.presenterQueue.filter(p => p.participantId !== participantToKick.uid);
            let newIndex = sessionData.currentPresenterIndex;
            
            // Adjust currentPresenterIndex if the kicked user was before or at the current index
            if (sessionData.currentPresenterIndex >=0 && sessionData.presenterQueue.length > 0) {
                const kickedUserIndexInQueue = sessionData.presenterQueue.findIndex(p => p.participantId === participantToKick.uid);
                if (kickedUserIndexInQueue !== -1 && kickedUserIndexInQueue <= sessionData.currentPresenterIndex) {
                    newIndex = sessionData.currentPresenterIndex - 1; // Decrement if kicked user was at or before current
                }
            }
            // If the kicked user was the current presenter, and was the last in newQueue, it's end of queue
            const currentPresenter = sessionData.presenterQueue[sessionData.currentPresenterIndex];
            if (currentPresenter?.participantId === participantToKick.uid && newIndex >= newQueue.length -1 && newQueue.length > 0) {
                 // No, if current presenter is kicked, newIndex should point to next, or if no next, then -1 or end of queue
            } else if (currentPresenter?.participantId === participantToKick.uid && newIndex < 0 && newQueue.length === 0){
                 newIndex = -1; // No presenters left
            }


            batch.update(sessionDocRef, { presenterQueue: newQueue });
            // If the kicked user *was* the current presenter, we might need to advance or reset.
            // For simplicity now, we just remove them. Admin might need to manually advance.
            // More complex logic would be to auto-advance if current presenter is kicked.
            // This could involve resetting scores if they were active.
             toast({title: "Participant Kicked", description: `Participant "${participantToKick.nickname}" also removed from presenter queue if present.`})
        }
        await batch.commit();
      },
      `Participant "${participantToKick.nickname}" has been kicked.`,
      `Could not kick participant "${participantToKick.nickname}".`
    ).finally(() => {
      setParticipantToKick(null);
      setShowKickConfirmDialog(false);
    });
  };

  const handleAddParticipantToQueue = (participantEntry: ParticipantData) => {
    if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded) return;
    const { nickname, uid: participantId } = participantEntry; // uid here is the key from participants map
    const actualAccountUid = authUser?.isAnonymous === false && authUser?.uid === participantId ? authUser.uid : null;

    const newPresenter: PresenterEntry = { name: nickname, uid: actualAccountUid, participantId: participantId };

    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, {
            presenterQueue: arrayUnion(newPresenter)
        });
    }, `${nickname} added to presenter queue.`, `Could not add ${nickname} to queue.`);
  };

  const handleRemovePresenterFromQueue = (indexToRemove: number) => {
     if (!isCurrentUserAdmin || !sessionData || sessionData.sessionEnded || !sessionData.presenterQueue) return;
     const presenterToRemove = sessionData.presenterQueue[indexToRemove];
     if (!presenterToRemove) return;

     handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        let newIndex = sessionData.currentPresenterIndex;
        let newQueue = sessionData.presenterQueue.filter((_, i) => i !== indexToRemove);

        if (indexToRemove < sessionData.currentPresenterIndex) {
            newIndex = sessionData.currentPresenterIndex - 1;
        } else if (indexToRemove === sessionData.currentPresenterIndex) {
            // If current presenter is removed, reset votes and stay at this index (which will now point to next or end)
            // Or, if it makes it out of bounds, set to end of queue or last valid
            newIndex = Math.min(sessionData.currentPresenterIndex, newQueue.length -1);
            if (newQueue.length === 0) newIndex = -1;
            // If current presenter removed, also reset votes
            await updateDoc(sessionDocRef, {
                presenterQueue: newQueue,
                currentPresenterIndex: newIndex,
                likeClicks: 0,
                dislikeClicks: 0,
                isRoundActive: newQueue.length > 0 && newIndex !== -1 && newIndex < newQueue.length // Only active if valid presenter
            });
            return; // Exit early as update is done
        }
         await updateDoc(sessionDocRef, {
             presenterQueue: newQueue,
             currentPresenterIndex: newIndex // Adjust index if needed
         });
     }, `${presenterToRemove.name} removed from queue.`, `Could not remove ${presenterToRemove.name}.`);
  };

  const handleClearPresenterQueue = () => {
    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, {
            presenterQueue: [],
            currentPresenterIndex: -1,
            likeClicks: 0,
            dislikeClicks: 0,
            isRoundActive: true, // General feedback becomes active
            presenterScores: [] // Clear overall scores too
        });
    }, "Presenter queue cleared. Scores reset. Overall leaderboard cleared.", "Could not clear presenter queue.");
  };

  const handleSetVotingMode = (mode: 'single' | 'infinite') => {
    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { votingMode: mode });
    }, `Voting mode set to ${mode === 'single' ? 'Single Vote per Round' : 'Infinite Votes per Round'}.`, "Could not set voting mode.");
  };
  
  const handleStartNextFeedbackRound = () => {
    if (!isCurrentUserAdmin || !sessionData || !sessionData.presenterQueue || sessionData.presenterQueue.length === 0) {
        toast({ title: "Action Failed", description: "Presenter queue is empty.", variant: "destructive" });
        return;
    }
    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const { currentPresenterIndex, presenterQueue, likeClicks, dislikeClicks, presenterScores = [] } = sessionData;
        const updatePayload: any = { likeClicks: 0, dislikeClicks: 0 };
        let toastDescription = "";

        if (currentPresenterIndex >= 0 && currentPresenterIndex < presenterQueue.length) {
            const currentPres = presenterQueue[currentPresenterIndex];
            const scoreToRecord: PresenterScore = {
                name: currentPres.name,
                uid: currentPres.uid || null,
                likes: likeClicks,
                dislikes: dislikeClicks,
                netScore: likeClicks - dislikeClicks,
            };
            updatePayload.presenterScores = arrayUnion(scoreToRecord);
            toastDescription += `Scores for ${currentPres.name} (Likes: ${likeClicks}, Dislikes: ${dislikeClicks}) recorded. `;
        }

        const newIndex = currentPresenterIndex + 1;
        if (newIndex >= presenterQueue.length) {
            updatePayload.currentPresenterIndex = newIndex; // Mark as past the end
            updatePayload.isRoundActive = false;
            toastDescription += "End of presenter queue. Feedback round closed.";
        } else {
            updatePayload.currentPresenterIndex = newIndex;
            updatePayload.isRoundActive = true;
            toastDescription += `Now presenting: ${presenterQueue[newIndex].name}. Feedback round started.`;
        }
        await updateDoc(sessionDocRef, updatePayload);
        // Success message handled by handleAdminAction if toastDescription is passed
    }, 
    // This will be dynamically generated by the logic above if successful
    "", 
    "Could not start next feedback round.");
  };

  const handleResetCurrentPresenterVotes = () => {
    if (!isCurrentUserAdmin || !sessionData || sessionData.currentPresenterIndex < 0 || !sessionData.presenterQueue || sessionData.currentPresenterIndex >= sessionData.presenterQueue.length) {
        toast({ title: "Action Failed", description: "No active presenter in the queue.", variant: "destructive" });
        return;
    }
    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { likeClicks: 0, dislikeClicks: 0 });
    }, `Votes for current presenter (${sessionData.presenterQueue[sessionData.currentPresenterIndex].name}) have been reset.`, "Could not reset current presenter votes.");
  };

  const handleResetGeneralSessionVotes = () => {
     if (!isCurrentUserAdmin || !sessionData || (sessionData.presenterQueue && sessionData.presenterQueue.length > 0)) {
        toast({ title: "Action Failed", description: "This action is for general feedback mode (empty presenter queue).", variant: "destructive" });
        return;
    }
    handleAdminAction(async () => {
        const sessionDocRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionDocRef, { likeClicks: 0, dislikeClicks: 0 });
    }, "General session votes have been reset.", "Could not reset general session votes.");
  };

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

  if (error && (!sessionData || sessionData.sessionEnded || error.includes("cannot be found") || error.includes("has ended") || error.includes("likely removed"))) {
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
                        Choose a nickname to join session <span className="font-bold">{sessionId}</span> at <strong className="text-primary">classvote.online</strong>. This cannot be changed later.
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
                      Choose a nickname to join session <span className="font-bold">{sessionId}</span> at <strong className="text-primary">classvote.online</strong>. This cannot be changed later.
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

  const { 
    presenterQueue = [], 
    currentPresenterIndex = -1,
    votingMode = 'single'
  } = sessionData;

  const currentPresenterDetails = (currentPresenterIndex >= 0 && currentPresenterIndex < presenterQueue.length)
                                  ? presenterQueue[currentPresenterIndex]
                                  : null;
  const currentPresenterNameForDisplay = currentPresenterDetails ? currentPresenterDetails.name : null;

  const isPresenterQueueActive = presenterQueue.length > 0 && currentPresenterIndex >= 0 && currentPresenterIndex < presenterQueue.length;
  const isEndOfQueue = presenterQueue.length > 0 && currentPresenterIndex >= presenterQueue.length;

  const feedbackSubmissionAllowed = !!(sessionData.isRoundActive && !sessionData.sessionEnded && (isPresenterQueueActive || presenterQueue.length === 0));

  const copySessionCode = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId)
      .then(() => toast({ title: "Session Code Copied!", description: `${sessionId} - Tell participants to go to classvote.online` }))
      .catch(() => toast({ title: "Copy Failed", description: "Could not copy code.", variant: "destructive"}));
  }

  const participantListForAdmin = Object.entries(sessionData.participants || {})
    .map(([uid_key, data]) => ({ id: uid_key, ...data })) // id is the key from participants map
    .sort((a, b) => {
        const timeAValue = a.joinedAt;
        const timeBValue = b.joinedAt;
        const timeA = timeAValue instanceof Timestamp ? timeAValue.toMillis() : (typeof (timeAValue as any)?.seconds === 'number' ? (timeAValue as any).seconds * 1000 : Date.now());
        const timeB = timeBValue instanceof Timestamp ? timeBValue.toMillis() : (typeof (timeBValue as any)?.seconds === 'number' ? (timeBValue as any).seconds * 1000 : Date.now());
        return timeA - timeB;
    });
  
  const currentParticipantCount = Object.keys(sessionData.participants || {}).length;
  
  let sessionStatusMessage = "";
  let presenterDisplayMessage = "";


  if (isEndOfQueue) {
    presenterDisplayMessage = "Presenter queue finished.";
    sessionStatusMessage = "Feedback round is CLOSED.";
  } else if (currentPresenterDetails) {
    const totalPresenters = presenterQueue.length;
    const currentIndexHuman = currentPresenterIndex + 1;
    presenterDisplayMessage = `Now Presenting: ${currentPresenterDetails.name} (${currentIndexHuman} of ${totalPresenters})`;
    sessionStatusMessage = sessionData.isRoundActive ? "Feedback round is OPEN. Cast your vote!" : "Feedback round is PAUSED.";
  } else if (presenterQueue.length > 0 && currentPresenterIndex === -1) {
    presenterDisplayMessage = `Queue ready (${presenterQueue.length} presenter${presenterQueue.length === 1 ? '' : 's'}). Admin can start.`
    sessionStatusMessage = "Waiting for admin to start presentations."
  }
  else { // General feedback mode
    presenterDisplayMessage = isCurrentUserAdmin ? "General feedback. Add presenters or reset votes." : "General feedback session.";
    sessionStatusMessage = sessionData.isRoundActive ? "General feedback round is OPEN. Cast your vote!" : "General feedback round is PAUSED.";
  }

  const selfNickname = authUser ? sessionData?.participants?.[authUser.uid]?.nickname : undefined;
  const isSelfPresenter = !!(
      authUser &&
      currentPresenterDetails &&
      currentPresenterDetails.participantId === authUser.uid 
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
                        <TooltipContent><p>Copy Session Code (Participants join at classvote.online)</p></TooltipContent>
                    </Tooltip>
                </div>
                 <p className="text-xs text-muted-foreground">Participants join at <strong className="text-primary">classvote.online</strong></p>
                <div className="flex items-center justify-center mt-1 text-sm text-muted-foreground">
                    <Users className="mr-1.5 h-4 w-4" />
                    <span>{currentParticipantCount} Participant{currentParticipantCount === 1 ? '' : 's'}</span>
                </div>
            </div>
            {presenterDisplayMessage && (
                <p className={`text-xl md:text-2xl font-semibold ${currentPresenterDetails ? 'text-accent' : 'text-muted-foreground'}`}>{presenterDisplayMessage}</p>
            )}
            <p className="text-md sm:text-lg text-muted-foreground mt-1">
                {sessionStatusMessage}
            </p>
             {!sessionData.sessionEnded && !feedbackSubmissionAllowed && sessionData.isRoundActive && (
                <p className="text-sm text-orange-500 mt-1">
                    Submissions (votes) are currently disabled.
                </p>
            )}
        </div>

        {!sessionData.sessionEnded && (
            <div className="mb-8 flex justify-center">
                <GoodBadButtonsLoader
                    sessionId={sessionId}
                    isRoundActive={!!feedbackSubmissionAllowed}
                    soundsEnabled={sessionData.soundsEnabled}
                    roundId={sessionData?.currentPresenterIndex ?? -1}
                    votingMode={sessionData.votingMode}
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
                    likeClicks={sessionData.likeClicks}
                    dislikeClicks={sessionData.dislikeClicks}
                    resultsVisible={sessionData.resultsVisible}
                    currentPresenterName={currentPresenterNameForDisplay}
                    presenterQueueEmpty={presenterQueue.length === 0}
                    isCurrentPresenterSelf={isSelfPresenter}
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
                 {(participantListForAdmin.length > 0 ) && (
                    <Card className="w-full shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center justify-center">
                            <Users className="mr-2 h-5 w-5" /> Participants ({participantListForAdmin.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-40">
                            <ul className="space-y-1">
                                {participantListForAdmin.map(p => (
                                <li key={p.id} className={`flex justify-between items-center p-1 text-xs hover:bg-muted/50 dark:hover:bg-muted/70 rounded ${authUser?.uid === p.id ? 'font-bold text-primary bg-primary/10' : ''}`}>
                                    <span>{p.nickname || 'Anonymous User'}</span>
                                    <div className="flex items-center space-x-1">
                                        {isCurrentUserAdmin && !sessionData.sessionEnded && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 px-1.5 text-primary hover:text-primary hover:bg-primary/10"
                                                        onClick={() => handleAddParticipantToQueue(p)}
                                                        disabled={isProcessingAdminAction || presenterQueue.some(pq => pq.participantId === p.id)}
                                                    >
                                                        <ListPlus className="mr-1 h-3 w-3"/> Add to Queue
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Add {p.nickname || 'this user'} to presenter queue</p></TooltipContent>
                                            </Tooltip>
                                        )}
                                        {isCurrentUserAdmin && authUser?.uid !== p.id && !sessionData.sessionEnded && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => triggerKickParticipantDialog(p.id, p.nickname || 'Anonymous User')}
                                                        disabled={isProcessingAdminAction}
                                                    >
                                                        <UserX className="mr-1 h-3 w-3"/> Kick
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Remove {p.nickname || 'this user'} from session</p></TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
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
                                <ListOrdered className="mr-2 h-5 w-5 text-primary" />
                                Presenter Queue Management
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {presenterQueue.length > 0 ? (
                                <>
                                    <ScrollArea className="h-32 border rounded-md p-2 bg-muted/30 dark:bg-muted/50">
                                        <ul className="space-y-1">
                                            {presenterQueue.map((p, index) => (
                                                <li key={`${p.participantId}-${index}`} 
                                                    className={cn("flex justify-between items-center text-xs p-1.5 rounded",
                                                                index === currentPresenterIndex && "bg-primary/20 font-semibold")}>
                                                    <span>{index + 1}. {p.name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemovePresenterFromQueue(index)}
                                                        disabled={isProcessingAdminAction}
                                                    >
                                                        <ListX className="mr-1 h-3 w-3"/> Remove
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </ScrollArea>
                                    <Button onClick={handleClearPresenterQueue} variant="outline" size="sm" className="w-full text-destructive border-destructive hover:bg-destructive/10" disabled={isProcessingAdminAction}>
                                        <ListX className="mr-2 h-4 w-4"/> Clear Entire Queue & Scores
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    Presenter queue is empty. Add participants to the queue using the list above.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center">
                                <ListChecks className="mr-2 h-5 w-5 text-primary" />
                                Round Controls
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                           {presenterQueue.length > 0 ? (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                onClick={handleStartNextFeedbackRound} 
                                                className="w-full text-sm bg-primary hover:bg-primary/90"
                                                disabled={isProcessingAdminAction || isEndOfQueue}
                                            >
                                                <ChevronsRight className="mr-1 h-4 w-4"/> 
                                                {currentPresenterIndex === -1 ? "Start First Presenter" : (isEndOfQueue ? "Queue Finished" : "Next Feedback Round")}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>{currentPresenterIndex === -1 ? "Start with the first presenter in the queue." : (isEndOfQueue ? "All presenters finished." : "Record current scores, advance to next presenter, reset votes.")}</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                onClick={handleResetCurrentPresenterVotes}
                                                variant="outline"
                                                className="w-full text-sm"
                                                disabled={isProcessingAdminAction || !currentPresenterDetails}
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" /> Reset Current Presenter's Votes
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Reset like/dislike counts for the current presenter without advancing. Does not affect overall scores.</p></TooltipContent>
                                    </Tooltip>
                                </>
                           ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleResetGeneralSessionVotes}
                                            variant="outline"
                                            className="w-full text-sm"
                                            disabled={isProcessingAdminAction}
                                        >
                                            <RotateCcw className="mr-2 h-4 w-4" /> Reset General Session Votes
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Reset like/dislike counts for the current general feedback session.</p></TooltipContent>
                                </Tooltip>
                           )}
                            <div className="flex items-center space-x-2 pt-2">
                                <Button
                                    onClick={handleTogglePauseResumeFeedback}
                                    variant="outline"
                                    className="flex-1 text-sm"
                                    disabled={isProcessingAdminAction || isEndOfQueue}
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
                            <div>
                                <Label className="text-sm font-medium mb-1 block">Voting Mode</Label>
                                <RadioGroup
                                    defaultValue={sessionData.votingMode}
                                    onValueChange={(value: 'single' | 'infinite') => handleSetVotingMode(value)}
                                    className="flex space-x-4"
                                    disabled={isProcessingAdminAction}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="single" id="single-vote" />
                                        <Label htmlFor="single-vote" className="text-sm">Single Vote per Round</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="infinite" id="infinite-votes" />
                                        <Label htmlFor="infinite-votes" className="text-sm">Infinite Votes per Round</Label>
                                    </div>
                                </RadioGroup>
                                <Tooltip>
                                    <TooltipTrigger asChild><Button variant="ghost" size="sm" className="mt-1 px-1 py-0 h-auto"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                    <TooltipContent side="bottom" align="start"><p className="max-w-xs">'Single': Each participant can vote once per presenter/round. 'Infinite': Participants can vote multiple times.</p></TooltipContent>
                                </Tooltip>
                            </div>
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
                             <div className="flex items-center justify-between space-x-2 p-3 border rounded-md bg-muted/20 dark:bg-muted/30">
                                <Label htmlFor="permanent-save" className="flex items-center text-sm cursor-pointer">
                                    <Save className="mr-2 h-5 w-5" />
                                    Keep This Session
                                </Label>
                                <div className="flex items-center">
                                    <Switch
                                        id="permanent-save"
                                        checked={!!sessionData.isPermanentlySaved}
                                        onCheckedChange={handleTogglePermanentSave}
                                        disabled={isProcessingAdminAction}
                                    />
                                    <Tooltip>
                                        <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-7 w-7 -mr-1"><Info className="h-3 w-3 text-muted-foreground"/></Button></TooltipTrigger>
                                        <TooltipContent><p>{sessionData.isPermanentlySaved ? "Session is marked to be kept permanently." : "Session may be auto-deleted after 30 days of ending (if not linked to an account and this is off)."}</p></TooltipContent>
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
                                    <TooltipContent><p>End session. Unsaved 'Quick' sessions will be deleted immediately. Saved/Account sessions are marked as ended.</p></TooltipContent>
                                </Tooltip>
                            </div>
                        </CardContent>
                    </Card>
                  </div>
                )}
            </section>
        </div>

        <div className="mt-12 flex justify-center">
            {isCurrentUserAdmin && sessionData && sessionData.sessionEnded && !(sessionData.sessionType === 'quick' && !sessionData.isPermanentlySaved) && (
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
                    This action will end the session. 
                    If this is a 'Quick Session' and not marked to 'Keep Permanently', it will be <strong className="text-destructive">deleted immediately</strong>. 
                    Otherwise, it will be marked as ended.
                    If there is an active presenter, their final scores will be recorded (unless the session is deleted).
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowEndSessionDialog(false)} disabled={isProcessingAdminAction && showEndSessionDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={executeEndSession} 
                    disabled={isProcessingAdminAction && showEndSessionDialog}
                    className={cn((sessionData?.sessionType === 'quick' && !sessionData?.isPermanentlySaved) && buttonVariants({variant: "destructive"}))}
                >
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
                    Are you sure you want to remove "<span className="font-semibold">{participantToKick?.nickname}</span>" from the session? They will be immediately disconnected and removed from the presenter queue if present.
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
