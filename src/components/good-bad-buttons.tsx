
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import * as Tone from "tone";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, updateDoc, increment, onSnapshot, setDoc } from "firebase/firestore";

const GoodBadButtons: React.FC = () => {
  const { toast } = useToast();
  const goodSynth = useRef<Tone.Synth | null>(null);
  const badSynth = useRef<Tone.Synth | null>(null);
  const [isRoundActive, setIsRoundActive] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [hasVotedInCurrentRound, setHasVotedInCurrentRound] = useState(false);

  useEffect(() => {
    const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
    const unsubscribe = onSnapshot(gameStatusDocRef, (docSnap) => {
      let currentRoundIsActive = true; // Default if not exists
      if (docSnap.exists()) {
        currentRoundIsActive = docSnap.data()?.isRoundActive ?? true;
      } else {
        // Initialize if document doesn't exist, default to active
        setDoc(gameStatusDocRef, { isRoundActive: true }, { merge: true });
      }
      setIsRoundActive(currentRoundIsActive);

      // Manage "voted in current round" status based on round activity
      if (currentRoundIsActive) {
        const voted = localStorage.getItem('hasVotedGoodBadSoundGame') === 'true';
        setHasVotedInCurrentRound(voted);
      } else {
        // Round is not active, so clear vote status for the next round
        localStorage.removeItem('hasVotedGoodBadSoundGame');
        setHasVotedInCurrentRound(false);
      }
      setIsLoadingStatus(false);
    }, (error) => {
      console.error("Error fetching game status for buttons: ", error);
      // Fallback behavior on error
      setIsRoundActive(true); // Default to active
      const voted = localStorage.getItem('hasVotedGoodBadSoundGame') === 'true';
      setHasVotedInCurrentRound(voted && true); // Check localStorage but respect default active state
      setIsLoadingStatus(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    goodSynth.current = new Tone.Synth().toDestination();
    badSynth.current = new Tone.Synth().toDestination();
    
    if (goodSynth.current) {
      goodSynth.current.oscillator.type = "sine";
      goodSynth.current.envelope.attack = 0.01;
      goodSynth.current.envelope.decay = 0.1;
      goodSynth.current.envelope.sustain = 0.3;
      goodSynth.current.envelope.release = 0.4;
      goodSynth.current.volume.value = -3;
    }

    if (badSynth.current) {
      badSynth.current.oscillator.type = "sawtooth";
      badSynth.current.envelope.attack = 0.05;
      badSynth.current.envelope.decay = 0.2;
      badSynth.current.envelope.sustain = 0.1;
      badSynth.current.envelope.release = 0.5;
      badSynth.current.volume.value = -9;
    }

    return () => {
      goodSynth.current?.dispose();
      badSynth.current?.dispose();
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

  const updateScore = async (type: 'good' | 'bad') => {
    const scoresDocRef = doc(db, 'leaderboard', 'scores');
    try {
      await updateDoc(scoresDocRef, {
        [type === 'good' ? 'goodClicks' : 'badClicks']: increment(1)
      });
      localStorage.setItem('hasVotedGoodBadSoundGame', 'true');
      setHasVotedInCurrentRound(true);
    } catch (error) {
        if ((error as any).code === 'not-found' || (error as any).message?.includes('No document to update')) {
             await setDoc(scoresDocRef, { goodClicks: type === 'good' ? 1:0, badClicks: type === 'bad' ? 1:0 }, {merge: true});
             localStorage.setItem('hasVotedGoodBadSoundGame', 'true');
             setHasVotedInCurrentRound(true);
        } else {
            console.error("Error updating score: ", error);
            toast({ title: "Score Update Error", description: "Could not update score.", variant: "destructive" });
        }
    }
  };

  const playGoodSound = async () => {
    if (!isRoundActive || isLoadingStatus || hasVotedInCurrentRound || !await ensureAudioContextStarted()) return;
    try {
      goodSynth.current?.triggerAttackRelease("C5", "8n", Tone.now());
      setTimeout(() => goodSynth.current?.triggerAttackRelease("E5", "8n", Tone.now() + 0.1), 50);
      setTimeout(() => goodSynth.current?.triggerAttackRelease("G5", "8n", Tone.now() + 0.2), 100);
      await updateScore('good');
    } catch (error) {
      console.error("Error playing good sound:", error);
      toast({ title: "Sound Error", description: "Could not play the 'good' sound.", variant: "destructive" });
    }
  };

  const playBadSound = async () => {
    if (!isRoundActive || isLoadingStatus || hasVotedInCurrentRound || !await ensureAudioContextStarted()) return;
    try {
      badSynth.current?.triggerAttackRelease("C3", "4n", Tone.now());
      setTimeout(() => badSynth.current?.triggerAttackRelease("C#3", "4n", Tone.now() + 0.05), 25);
      await updateScore('bad');
    } catch (error) {
      console.error("Error playing bad sound:", error);
      toast({ title: "Sound Error", description: "Could not play the 'bad' sound.", variant: "destructive" });
    }
  };
  
  const pulseAnimationClass = "active:scale-95 transform transition-transform duration-150 ease-in-out";
  const buttonDisabledState = !isRoundActive || isLoadingStatus || hasVotedInCurrentRound;
  const disabledClass = buttonDisabledState ? "opacity-50 cursor-not-allowed" : "";

  if (isLoadingStatus) {
      return (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
            <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md opacity-50 cursor-not-allowed`} disabled>
              <ThumbsUp className="mr-3 h-6 w-6" /> Loading...
            </Button>
            <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md opacity-50 cursor-not-allowed`} disabled>
              <ThumbsDown className="mr-3 h-6 w-6" /> Loading...
            </Button>
          </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <Button
          onClick={playGoodSound}
          className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-green-500 hover:bg-green-600 text-white`}
          aria-label="Play good sound"
          disabled={buttonDisabledState}
        >
          <ThumbsUp className="mr-3 h-6 w-6" /> Good
        </Button>
        <Button
          onClick={playBadSound}
          className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-red-500 hover:bg-red-600 text-white`}
          aria-label="Play bad sound"
          disabled={buttonDisabledState}
        >
          <ThumbsDown className="mr-3 h-6 w-6" /> Bad
        </Button>
      </div>
      {hasVotedInCurrentRound && isRoundActive && (
        <p className="mt-2 text-sm text-muted-foreground">
          You have already voted in this round.
        </p>
      )}
       {!isRoundActive && !isLoadingStatus && (
        <p className="mt-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
          The current round has ended. Please wait for the admin to start a new round.
        </p>
      )}
    </div>
  );
};

export default GoodBadButtons;
