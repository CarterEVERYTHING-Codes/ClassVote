
"use client";

import React from 'react'; // Removed useState, useEffect
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, EyeOff, Presentation } from 'lucide-react';
// Skeleton can be removed if loading is primarily handled by parent
// import { Skeleton } from '@/components/ui/skeleton';

interface Scores {
  likeClicks: number;
  dislikeClicks: number;
}

interface LeaderboardProps extends Scores { // Inherit Scores directly
  sessionId: string; // Keep sessionId if needed for other things, or remove if only for scores
  resultsVisible: boolean;
  currentPresenterName?: string | null;
  presenterQueueEmpty?: boolean;
  isCurrentPresenterSelf?: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  sessionId, // Retaining for potential future use, though not for scores now
  resultsVisible,
  currentPresenterName,
  presenterQueueEmpty,
  isCurrentPresenterSelf,
  likeClicks, // Directly use from props
  dislikeClicks, // Directly use from props
}) => {
  // Loading state is now primarily managed by the parent component (SessionPage)
  // If SessionPage shows a skeleton for the whole section, this component might not need its own skeleton.
  // However, if SessionPage loads but these specific scores might be delayed, a small skeleton here could still be useful.
  // For this refactor, assuming parent handles broader loading.

  const showScoresForSelf = isCurrentPresenterSelf && currentPresenterName && currentPresenterName !== "End of Queue";
  const canShowScores = resultsVisible || showScoresForSelf;

  const getCardTitleText = () => {
    if (!canShowScores && !resultsVisible) return "Live Leaderboard";

    if (currentPresenterName && currentPresenterName !== "End of Queue") {
      if (showScoresForSelf && !resultsVisible) {
        return `Your Scores: ${currentPresenterName}`;
      }
      return `Scores for: ${currentPresenterName}`;
    }
    if (currentPresenterName === "End of Queue") {
      return "Final Scores (Queue Ended)";
    }
    return "Live Leaderboard (General Session)";
  };
  
  const cardTitleText = getCardTitleText();
  const showQueueEndedMessage = canShowScores && currentPresenterName === "End of Queue";
  const showGeneralOrWaitingMessage = canShowScores && !currentPresenterName && presenterQueueEmpty;

  // Example: If parent is loading, perhaps show nothing or a minimal placeholder
  // if (parentIsLoading) return <Skeleton className="h-40 w-full" />;

  if (!canShowScores) {
    return (
      <Card className="w-full shadow-lg">
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
  
  if (showGeneralOrWaitingMessage && !currentPresenterName) {
     return (
      <Card className="w-full shadow-lg">
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
                {likeClicks}
            </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg shadow">
            <div className="flex items-center space-x-2">
                <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                <span className="text-lg font-medium text-red-700 dark:text-red-300">Dislikes:</span>
            </div>
            <span className="text-xl font-bold text-red-700 dark:text-red-300">
                {dislikeClicks}
            </span>
            </div>
        </CardContent>
      </Card>
    );
  }

  if (showQueueEndedMessage) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
            <Presentation className="mr-2 h-6 w-6" />
            {cardTitleText}
            </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">All presentations have concluded. Final scores for the last presenter were:</p>
           <div className="flex items-center justify-center space-x-6 p-3 mt-2">
            <div className="flex items-center space-x-2">
              <ThumbsUp className="h-6 w-6 text-green-500" />
              <span className="text-lg font-bold">{likeClicks}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ThumbsDown className="h-6 w-6 text-red-500" />
              <span className="text-lg font-bold">{dislikeClicks}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg">
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
            {likeClicks}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-100 dark:bg-red-900/30 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            <span className="text-lg font-medium text-red-700 dark:text-red-300">Dislikes:</span>
          </div>
          <span className="text-xl font-bold text-red-700 dark:text-red-300">
            {dislikeClicks}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
