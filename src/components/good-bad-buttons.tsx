
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

  useEffect(() => {
    const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
    const unsubscribe = onSnapshot(gameStatusDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsRoundActive(docSnap.data()?.isRoundActive ?? true);
      } else {
        // Initialize if document doesn't exist, default to active
        setDoc(gameStatusDocRef, { isRoundActive: true }, { merge: true });
        setIsRoundActive(true);
      }
      setIsLoadingStatus(false);
    }, (error) => {
      console.error("Error fetching game status for buttons: ", error);
      setIsRoundActive(true); // Default to active on error
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
    } catch (error) {
        // If the document doesn't exist, create it.
        if ((error as any).code === 'not-found' || (error as any).message?.includes('No document to update')) {
             await setDoc(scoresDocRef, { goodClicks: type === 'good' ? 1:0, badClicks: type === 'bad' ? 1:0 }, {merge: true});
        } else {
            console.error("Error updating score: ", error);
            toast({ title: "Score Update Error", description: "Could not update score.", variant: "destructive" });
        }
    }
  };

  const playGoodSound = async () => {
    if (!isRoundActive || !await ensureAudioContextStarted()) return;
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
    if (!isRoundActive || !await ensureAudioContextStarted()) return;
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
  const disabledClass = !isRoundActive || isLoadingStatus ? "opacity-50 cursor-not-allowed" : "";

  if (isLoadingStatus) {
      return (
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
          <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md ${disabledClass}`} disabled>
            <ThumbsUp className="mr-3 h-6 w-6" /> Loading...
          </Button>
          <Button className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md ${disabledClass}`} disabled>
            <ThumbsDown className="mr-3 h-6 w-6" /> Loading...
          </Button>
        </div>
      );
  }

  return (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
      <Button
        onClick={playGoodSound}
        className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-green-500 hover:bg-green-600 text-white`}
        aria-label="Play good sound"
        disabled={!isRoundActive || isLoadingStatus}
      >
        <ThumbsUp className="mr-3 h-6 w-6" /> Good
      </Button>
      <Button
        onClick={playBadSound}
        className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass} ${disabledClass} bg-red-500 hover:bg-red-600 text-white`}
        aria-label="Play bad sound"
        disabled={!isRoundActive || isLoadingStatus}
      >
        <ThumbsDown className="mr-3 h-6 w-6" /> Bad
      </Button>
    </div>
  );
};

export default GoodBadButtons;
