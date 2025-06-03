
"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Scores {
  goodClicks: number;
  badClicks: number;
}

const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<Scores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scoresDocRef = doc(db, 'leaderboard', 'scores');
    const unsubscribe = onSnapshot(scoresDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setScores(docSnap.data() as Scores);
      } else {
        // Initialize if document doesn't exist
        setScores({ goodClicks: 0, badClicks: 0 });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching scores: ", error);
      setScores({ goodClicks: 0, badClicks: 0 }); // Default on error
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Live Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <span className="text-lg">Good Clicks:</span>
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <span className="text-lg">Bad Clicks:</span>
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">Live Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span className="text-lg font-medium text-green-700 dark:text-green-300">Good Clicks:</span>
          </div>
          <span className="text-xl font-bold text-green-700 dark:text-green-300">
            {scores?.goodClicks ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            <span className="text-lg font-medium text-red-700 dark:text-red-300">Bad Clicks:</span>
          </div>
          <span className="text-xl font-bold text-red-700 dark:text-red-300">
            {scores?.badClicks ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
