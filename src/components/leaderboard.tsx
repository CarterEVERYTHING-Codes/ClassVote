"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, EyeOff, Presentation } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Scores {
  likeClicks: number;
  dislikeClicks: number;
}

interface LeaderboardProps {
  sessionId: string;
  resultsVisible: boolean; 
  currentPresenterName?: string | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ sessionId, resultsVisible, currentPresenterName }) => {
  const [scores, setScores] = useState<Scores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const scoresDocRef = doc(db, 'sessions', sessionId);
    const unsubscribe = onSnapshot(scoresDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setScores({ 
          likeClicks: data?.likeClicks ?? 0, 
          dislikeClicks: data?.dislikeClicks ?? 0 
        });
      } else {
        setScores({ likeClicks: 0, dislikeClicks: 0 });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching session scores: ", error);
      setScores({ likeClicks: 0, dislikeClicks: 0 }); 
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId]);

  const cardTitleText = currentPresenterName && currentPresenterName !== "End of Queue" && resultsVisible 
    ? `Scores for: ${currentPresenterName}` 
    : "Live Leaderboard";
  
  const showNoPresenterMessage = !currentPresenterName && resultsVisible;
  const showQueueEndedMessage = currentPresenterName === "End of Queue" && resultsVisible;


  if (loading) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
            <Presentation className="mr-2 h-6 w-6" />
            Live Leaderboard
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <span className="text-lg">Likes:</span>
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <span className="text-lg">Dislikes:</span>
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resultsVisible) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
             <Presentation className="mr-2 h-6 w-6" />
            Live Leaderboard
            </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <EyeOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Live results are currently hidden by the admin.</p>
        </CardContent>
      </Card>
    );
  }

  if (showNoPresenterMessage) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
            <Presentation className="mr-2 h-6 w-6" />
            Live Leaderboard
            </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Waiting for admin to select a presenter.</p>
        </CardContent>
      </Card>
    );
  }

  if (showQueueEndedMessage) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
            <Presentation className="mr-2 h-6 w-6" />
            Live Leaderboard
            </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">All presentations have concluded. Final scores were:</p>
           <div className="flex items-center justify-center space-x-6 p-3 mt-2">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold">{scores?.likeClicks ?? 0}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <span className="text-lg font-bold">{scores?.dislikeClicks ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
            <Presentation className="mr-2 h-6 w-6" />
            {cardTitleText}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-green-100 dark:bg-green-900/30 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span className="text-lg font-medium text-green-700 dark:text-green-300">Likes:</span>
          </div>
          <span className="text-xl font-bold text-green-700 dark:text-green-300">
            {scores?.likeClicks ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            <span className="text-lg font-medium text-red-700 dark:text-red-300">Dislikes:</span>
          </div>
          <span className="text-xl font-bold text-red-700 dark:text-red-300">
            {scores?.dislikeClicks ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;