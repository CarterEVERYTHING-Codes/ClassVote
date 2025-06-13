
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import * as Tone from "tone";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  increment,
  getDoc,
  FirestoreError,
} from "firebase/firestore";
// Removed: import type { SessionData } from '@/app/session/[sessionId]/page';

interface GoodBadButtonsProps {
  sessionId: string;
  isRoundActive: boolean;
  soundsEnabled: boolean;
  roundId?: number; 
  votingMode: 'single' | 'infinite'; // Directly defined type
  generalRoundInstanceId?: number; 
}

const GoodBadButtons: React.FC<GoodBadButtonsProps> = ({ 
    sessionId, 
    isRoundActive: isRoundActiveProp, 
    soundsEnabled, 
    roundId, 
    votingMode,
    generalRoundInstanceId = 1 
}) => {
  const { toast } = useToast();
  const likeSynth = useRef<Tone.Synth | null>(null);
  const dislikeSynth = useRef<Tone.Synth | null>(null);
  
  const [internalIsRoundActive, setInternalIsRoundActive] = useState(isRoundActiveProp);
  const [isLoadingClick, setIsLoadingClick] = useState(false);
  const [hasVotedInCurrentRound, setHasVotedInCurrentRound] = useState(false);
  
  const getLocalStorageKey = useCallback(() => {
    // If roundId is -1 (general session) or undefined (could happen if not passed correctly),
    // use generalRoundInstanceId to make the key unique per general round instance.
    if (roundId === -1 || roundId === undefined) { 
      return `hasVoted_${sessionId}_general_${generalRoundInstanceId}`;
    }
    // Otherwise, it's a specific presenter round.
    return `hasVoted_${sessionId}_${roundId}`; 
  }, [sessionId, roundId, generalRoundInstanceId]);

  useEffect(() => {
    // console.log("[GoodBadButtons EFFECT] Triggered with props:", { isRoundActiveProp, roundId, sessionId, votingMode, generalRoundInstanceId });
    setInternalIsRoundActive(isRoundActiveProp);
    const currentKey = getLocalStorageKey();
    // console.log("[GoodBadButtons EFFECT] localStorageKey:", currentKey);

    if (votingMode === 'single') {
      if (isRoundActiveProp) {
        const votedInThisSpecificRound = localStorage.getItem(currentKey) === 'true';
        // console.log(`[GoodBadButtons EFFECT] localStorage.getItem('${currentKey}') found:`, localStorage.getItem(currentKey));
        setHasVotedInCurrentRound(votedInThisSpecificRound);
        // console.log("[GoodBadButtons EFFECT] Setting hasVotedInCurrentRound to:", votedInThisSpecificRound);
      } else {
        // If the round is not active, they haven't voted in *this* instance of it.
        setHasVotedInCurrentRound(false); 
        // console.log("[GoodBadButtons EFFECT] isRoundActiveProp is false, setting hasVotedInCurrentRound to false");
      }
    } else { // Infinite voting mode
      setHasVotedInCurrentRound(false); // In infinite mode, they can always vote.
      // console.log("[GoodBadButtons EFFECT] votingMode is not 'single', setting hasVotedInCurrentRound to false");
    }
  }, [isRoundActiveProp, roundId, sessionId, votingMode, generalRoundInstanceId, getLocalStorageKey]);


  useEffect(() => {
    const initializeAudio = async () => {
      try {
        if (Tone.context.state !== "running") {
          await Tone.start();
        }
      } catch (e) {
        console.warn("Tone.js could not start audio context on mount (will attempt on first click):", e);
      }

      if (!likeSynth.current) {
        likeSynth.current = new Tone.Synth().toDestination();
        likeSynth.current.oscillator.type = "sine";
        likeSynth.current.envelope.attack = 0.01;
        likeSynth.current.envelope.decay = 0.1;
        likeSynth.current.envelope.sustain = 0.3;
        likeSynth.current.envelope.release = 0.4;
        likeSynth.current.volume.value = -3;
      }

      if (!dislikeSynth.current) {
        dislikeSynth.current = new Tone.Synth().toDestination();
        dislikeSynth.current.oscillator.type = "sawtooth";
        dislikeSynth.current.envelope.attack = 0.05;
        dislikeSynth.current.envelope.decay = 0.2;
        dislikeSynth.current.envelope.sustain = 0.1;
        dislikeSynth.current.envelope.release = 0.5;
        dislikeSynth.current.volume.value = -9;
      }
    };

    initializeAudio();

    return () => {
      likeSynth.current?.dispose();
      likeSynth.current = null;
      dislikeSynth.current?.dispose();
      dislikeSynth.current = null;
    };
  }, []);

  const ensureAudioContextStarted = async () => {
    if (Tone.context.state !== "running") {
      try {
        await Tone.start();
      } catch (error) {
        console.error("Failed to start audio context on demand:", error);
        toast({
          title: "Audio Error",
          description: "Could not initialize audio. Please interact with the page again or check browser settings.",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const updateScore = async (type: 'like' | 'dislike'): Promise<boolean> => {
    if (!sessionId) return false;
    const sessionDocRef = doc(db, 'sessions', sessionId);
    try {
      const currentSessionDoc = await getDoc(sessionDocRef);
      if (!currentSessionDoc.exists() || !currentSessionDoc.data()?.isRoundActive) {
        toast({ title: "Vote Not Counted", description: "The feedback round may have just closed or the session has ended.", variant: "default" });
        setInternalIsRoundActive(false); // Sync internal state
        if (votingMode === 'single') setHasVotedInCurrentRound(false); // Reset vote status if round closed
        return false;
      }

      await updateDoc(sessionDocRef, {
        [type === 'like' ? 'likeClicks' : 'dislikeClicks']: increment(1)
      });
      if (votingMode === 'single') {
        const currentKey = getLocalStorageKey();
        localStorage.setItem(currentKey, 'true'); // Mark as voted for this specific round instance
        setHasVotedInCurrentRound(true);
      }
      return true;
    } catch (error) {
      console.error("Error updating score: ", error);
      if ((error as FirestoreError)?.code === 'permission-denied' || (error as FirestoreError)?.code === 'aborted') {
           toast({ title: "Vote Not Counted", description: "The feedback round may have just closed.", variant: "default" });
      } else {
          toast({ title: "Score Update Error", description: "Could not update score.", variant: "destructive" });
      }
      // Attempt to re-sync round active status from Firestore on error
      try {
        const currentSessionDoc = await getDoc(sessionDocRef);
        if (currentSessionDoc.exists()) {
          const isActive = currentSessionDoc.data()?.isRoundActive ?? false;
          setInternalIsRoundActive(isActive);
          if (!isActive && votingMode === 'single') {
            // If round is now inactive, reset local vote status
            setHasVotedInCurrentRound(false);
          }
        } else { // Session doc doesn't exist anymore
          setInternalIsRoundActive(false); 
          if (votingMode === 'single') setHasVotedInCurrentRound(false);
        }
      } catch (docReadError) {
        console.error("Error re-reading session doc for state sync:", docReadError);
         setInternalIsRoundActive(false); // Fallback
         if (votingMode === 'single') setHasVotedInCurrentRound(false);
      }
      return false;
    }
  };

  const playLikeSound = async () => {
    if (!internalIsRoundActive || isLoadingClick || (votingMode === 'single' && hasVotedInCurrentRound)) return;
    if (soundsEnabled && !await ensureAudioContextStarted()) return;
    if (!likeSynth.current) return;
    
    setIsLoadingClick(true); 
    const scoreUpdated = await updateScore('like');
    setIsLoadingClick(false);

    if (scoreUpdated && soundsEnabled) {
      likeSynth.current?.triggerAttackRelease("C5", "8n", Tone.now());
      setTimeout(() => likeSynth.current?.triggerAttackRelease("E5", "8n", Tone.now() + 0.1), 50);
      setTimeout(() => likeSynth.current?.triggerAttackRelease("G5", "8n", Tone.now() + 0.2), 100);
    }
  };

  const playDislikeSound = async () => {
    if (!internalIsRoundActive || isLoadingClick || (votingMode === 'single' && hasVotedInCurrentRound)) return;
    if (soundsEnabled && !await ensureAudioContextStarted()) return;
    if (!dislikeSynth.current) return;

    setIsLoadingClick(true); 
    const scoreUpdated = await updateScore('dislike');
    setIsLoadingClick(false);

    if (scoreUpdated && soundsEnabled) {
      dislikeSynth.current?.triggerAttackRelease("C3", "4n", Tone.now());
      setTimeout(() => dislikeSynth.current?.triggerAttackRelease("C#3", "4n", Tone.now() + 0.05), 25);
    }
  };
  
  const pulseAnimationClass = "active:scale-95 transform transition-transform duration-150 ease-in-out";
  const buttonDisabledState = !internalIsRoundActive || isLoadingClick || (votingMode === 'single' && hasVotedInCurrentRound);
  const disabledClass = buttonDisabledState ? "opacity-50 cursor-not-allowed" : "";

  let statusMessage = "";
  if (votingMode === 'single' && hasVotedInCurrentRound && internalIsRoundActive) {
    statusMessage = "You have already voted in this feedback round.";
  } else if (!internalIsRoundActive) {
    statusMessage = "The feedback round is currently CLOSED. Please wait for the admin to open it.";
  } else if (internalIsRoundActive) {
    statusMessage = "The feedback round is OPEN. Cast your vote!";
    if (votingMode === 'infinite') {
        statusMessage += " (Infinite votes allowed)";
    }
  }


  if (isLoadingClick && !buttonDisabledState) { 
      return (
        <div className="flex flex-col items-center space-y-3 w-full max-w-md">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full">
            <Button className={`flex-1 py-3 text-md font-semibold rounded-lg shadow-md opacity-70 cursor-wait`} disabled>
              <ThumbsUp className="mr-2 h-5 w-5" /> Processing...
            </Button>
            <Button className={`flex-1 py-3 text-md font-semibold rounded-lg shadow-md opacity-70 cursor-wait`} disabled>
              <ThumbsDown className="mr-2 h-5 w-5" /> Processing...
            </Button>
          </div>
           <p className="mt-1 text-xs text-muted-foreground">{statusMessage}</p>
        </div>
      );
  }


  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-md">
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full">
        <Button
          onClick={playLikeSound}
          className={`flex-1 py-3 text-md font-semibold rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-green-500 hover:bg-green-600 text-white`}
          aria-label="Vote Like"
          disabled={buttonDisabledState}
        >
          <ThumbsUp className="mr-2 h-5 w-5" /> Like
        </Button>
        <Button
          onClick={playDislikeSound}
          className={`flex-1 py-3 text-md font-semibold rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-red-500 hover:bg-red-600 text-white`}
          aria-label="Vote Dislike"
          disabled={buttonDisabledState}
        >
          <ThumbsDown className="mr-2 h-5 w-5" /> Dislike
        </Button>
      </div>
      <p className={`mt-1 text-xs ${!internalIsRoundActive ? 'font-semibold text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
        {statusMessage}
      </p>
    </div>
  );
};

export default GoodBadButtons;
