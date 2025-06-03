"use client";

import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import * as Tone from "tone";
import { useToast } from "@/hooks/use-toast";

const GoodBadButtons: React.FC = () => {
  const { toast } = useToast();
  const goodSynth = useRef<Tone.Synth | null>(null);
  const badSynth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    goodSynth.current = new Tone.Synth().toDestination();
    badSynth.current = new Tone.Synth().toDestination();
    
    if (goodSynth.current) {
      goodSynth.current.oscillator.type = "sine";
      goodSynth.current.envelope.attack = 0.01;
      goodSynth.current.envelope.decay = 0.1;
      goodSynth.current.envelope.sustain = 0.3;
      goodSynth.current.envelope.release = 0.4;
      goodSynth.current.volume.value = -3; // Slightly louder for good
    }

    if (badSynth.current) {
      badSynth.current.oscillator.type = "sawtooth"; // More harsh for bad
      badSynth.current.envelope.attack = 0.05;
      badSynth.current.envelope.decay = 0.2;
      badSynth.current.envelope.sustain = 0.1;
      badSynth.current.envelope.release = 0.5;
      badSynth.current.volume.value = -9; // Quieter for bad
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

  const playGoodSound = async () => {
    if (!await ensureAudioContextStarted()) return;
    try {
      // A pleasant, short major chord-like sound (simplified)
      goodSynth.current?.triggerAttackRelease("C5", "8n", Tone.now());
      setTimeout(() => goodSynth.current?.triggerAttackRelease("E5", "8n", Tone.now() + 0.1), 50);
      setTimeout(() => goodSynth.current?.triggerAttackRelease("G5", "8n", Tone.now() + 0.2), 100);
    } catch (error) {
      console.error("Error playing good sound:", error);
      toast({
        title: "Sound Error",
        description: "Could not play the 'good' sound.",
        variant: "destructive",
      });
    }
  };

  const playBadSound = async () => {
    if (!await ensureAudioContextStarted()) return;
    try {
      // A dissonant, short sound
      badSynth.current?.triggerAttackRelease("C3", "4n", Tone.now());
      setTimeout(() => badSynth.current?.triggerAttackRelease("C#3", "4n", Tone.now() + 0.05), 25);
    } catch (error) {
      console.error("Error playing bad sound:", error);
      toast({
        title: "Sound Error",
        description: "Could not play the 'bad' sound.",
        variant: "destructive",
      });
    }
  };
  
  const pulseAnimationClass = "active:scale-95 transform transition-transform duration-150 ease-in-out";

  return (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
      <Button
        onClick={playGoodSound}
        className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass}`}
        aria-label="Play good sound"
      >
        <ThumbsUp className="mr-3 h-6 w-6" /> Good
      </Button>
      <Button
        onClick={playBadSound}
        className={`px-8 py-4 text-lg font-medium rounded-lg shadow-md hover:shadow-lg ${pulseAnimationClass}`}
        aria-label="Play bad sound"
      >
        <ThumbsDown className="mr-3 h-6 w-6" /> Bad
      </Button>
    </div>
  );
};

export default GoodBadButtons;
