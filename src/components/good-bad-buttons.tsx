
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import * as Tone from "tone";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, getDoc, setDoc, FirebaseError } from "firebase/firestore";

interface GoodBadButtonsProps {
  sessionId: string;
  isRoundActiveInitially: boolean; 
}

const GoodBadButtons: React.FC<GoodBadButtonsProps> = ({ sessionId, isRoundActiveInitially }) => {
  const { toast } = useToast();
  const likeSynth = useRef<Tone.Synth | null>(null);
  const dislikeSynth = useRef<Tone.Synth | null>(null);
  
  // isRoundActive is now primarily controlled by the parent SessionPage via props
  const [isRoundActive, setIsRoundActive] = useState(isRoundActiveInitially);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false); // No longer fetching status here directly
  const [hasVotedInCurrentRound, setHasVotedInCurrentRound] = useState(false);
  const localStorageKey = `hasVoted_${sessionId}`;

  useEffect(() => {
    setIsRoundActive(isRoundActiveInitially);
    if (isRoundActiveInitially) {
      const voted = localStorage.getItem(localStorageKey) === 'true';
      setHasVotedInCurrentRound(voted);
    } else {
      // If round is not active from prop, ensure vote status is reset
      localStorage.removeItem(localStorageKey);
      setHasVotedInCurrentRound(false);
    }
  }, [isRoundActiveInitially, localStorageKey]);


  useEffect(() => {
    likeSynth.current = new Tone.Synth().toDestination();
    dislikeSynth.current = new Tone.Synth().toDestination();
    
    if (likeSynth.current) {
      likeSynth.current.oscillator.type = "sine";
      likeSynth.current.envelope.attack = 0.01;
      likeSynth.current.envelope.decay = 0.1;
      likeSynth.current.envelope.sustain = 0.3;
      likeSynth.current.envelope.release = 0.4;
      likeSynth.current.volume.value = -3;
    }

    if (dislikeSynth.current) {
      dislikeSynth.current.oscillator.type = "sawtooth";
      dislikeSynth.current.envelope.attack = 0.05;
      dislikeSynth.current.envelope.decay = 0.2;
      dislikeSynth.current.envelope.sustain = 0.1;
      dislikeSynth.current.envelope.release = 0.5;
      dislikeSynth.current.volume.value = -9;
    }

    return () => {
      likeSynth.current?.dispose();
      dislikeSynth.current?.dispose();
    };
  }, []);

  const ensureAudioContextStarted = async () => {
    if (Tone.context.state !== "running") {
      try {
        await Tone.start();
      } catch (error) {
        console.error("Failed to start audio context:", error);
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
      // First, check if the round is still active on the server
      const currentSessionDoc = await getDoc(sessionDocRef);
      if (!currentSessionDoc.exists() || !currentSessionDoc.data()?.isRoundActive) {
        toast({ title: "Vote Not Counted", description: "The round may have just ended or the session is closed.", variant: "default" });
        setIsRoundActive(false); // Update local state
        localStorage.removeItem(localStorageKey);
        setHasVotedInCurrentRound(false);
        return false;
      }

      await updateDoc(sessionDocRef, {
        [type === 'like' ? 'likeClicks' : 'dislikeClicks']: increment(1)
      });
      localStorage.setItem(localStorageKey, 'true');
      setHasVotedInCurrentRound(true);
      return true;
    } catch (error) {
      console.error("Error updating score: ", error);
      if ((error as FirebaseError)?.code === 'permission-denied' || (error as FirebaseError)?.code === 'aborted') {
           toast({ title: "Vote Not Counted", description: "The round may have just ended.", variant: "default" });
      } else {
          toast({ title: "Score Update Error", description: "Could not update score.", variant: "destructive" });
      }
      // If update fails, check current round status from server again
      const currentSessionDoc = await getDoc(sessionDocRef);
      if (currentSessionDoc.exists()) {
        const isActive = currentSessionDoc.data()?.isRoundActive ?? false;
        setIsRoundActive(isActive);
        if (!isActive) {
          localStorage.removeItem(localStorageKey);
          setHasVotedInCurrentRound(false);
        }
      } else { // Session deleted
        setIsRoundActive(false);
        localStorage.removeItem(localStorageKey);
        setHasVotedInCurrentRound(false);
      }
      return false;
    }
  };

  const playLikeSound = async () => {
    if (!isRoundActive || isLoadingStatus || hasVotedInCurrentRound || !await ensureAudioContextStarted()) return;
    
    setIsLoadingStatus(true); // Prevent double clicks while processing
    const scoreUpdated = await updateScore('like');
    setIsLoadingStatus(false);

    if (scoreUpdated) {
      likeSynth.current?.triggerAttackRelease("C5", "8n", Tone.now());
      setTimeout(() => likeSynth.current?.triggerAttackRelease("E5", "8n", Tone.now() + 0.1), 50);
      setTimeout(() => likeSynth.current?.triggerAttackRelease("G5", "8n", Tone.now() + 0.2), 100);
    }
  };

  const playDislikeSound = async () => {
    if (!isRoundActive || isLoadingStatus || hasVotedInCurrentRound || !await ensureAudioContextStarted()) return;

    setIsLoadingStatus(true); // Prevent double clicks
    const scoreUpdated = await updateScore('dislike');
    setIsLoadingStatus(false);

    if (scoreUpdated) {
      dislikeSynth.current?.triggerAttackRelease("C3", "4n", Tone.now());
      setTimeout(() => dislikeSynth.current?.triggerAttackRelease("C#3", "4n", Tone.now() + 0.05), 25);
    }
  };
  
  const pulseAnimationClass = "active:scale-95 transform transition-transform duration-150 ease-in-out";
  const buttonDisabledState = !isRoundActive || isLoadingStatus || hasVotedInCurrentRound;
  const disabledClass = buttonDisabledState ? "opacity-50 cursor-not-allowed" : "";

  // isLoadingStatus for buttons refers to the processing of a click, not initial load of component
  if (isLoadingStatus && !buttonDisabledState) { // Show specific loading on buttons if processing click
      return (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
            <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md opacity-70 cursor-wait`} disabled>
              <ThumbsUp className="mr-3 h-6 w-6" /> Processing...
            </Button>
            <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md opacity-70 cursor-wait`} disabled>
              <ThumbsDown className="mr-3 h-6 w-6" /> Processing...
            </Button>
          </div>
        </div>
      );
  }


  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <Button
          onClick={playLikeSound}
          className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-green-500 hover:bg-green-600 text-white`}
          aria-label="Play like sound"
          disabled={buttonDisabledState}
        >
          <ThumbsUp className="mr-3 h-6 w-6" /> Like
        </Button>
        <Button
          onClick={playDislikeSound}
          className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-red-500 hover:bg-red-600 text-white`}
          aria-label="Play dislike sound"
          disabled={buttonDisabledState}
        >
          <ThumbsDown className="mr-3 h-6 w-6" /> Dislike
        </Button>
      </div>
      {hasVotedInCurrentRound && isRoundActive && (
        <p className="mt-2 text-sm text-muted-foreground">
          You have already voted in this round.
        </p>
      )}
       {!isRoundActive && ( // Removed !isLoadingStatus because status is now from props
        <p className="mt-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
          The current round has ended. Please wait for the admin to start a new round.
        </p>
      )}
    </div>
  );
};

export default GoodBadButtons;
