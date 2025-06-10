
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';

interface PresenterScore {
  name: string;
  likes: number;
  dislikes: number;
  netScore: number;
}

interface OverallLeaderboardProps {
  presenterScores: PresenterScore[];
}

const OverallLeaderboard: React.FC<OverallLeaderboardProps> = ({ presenterScores }) => {
  if (!presenterScores || presenterScores.length === 0) {
    return (
      <Card className="w-full shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="text-center text-xl md:text-2xl font-bold flex items-center justify-center">
            <Award className="mr-2 h-6 w-6 text-yellow-500" /> Overall Session Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">No presenter scores recorded yet or the presenter queue has not finished.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedScores = [...presenterScores].sort((a, b) => b.netScore - a.netScore);

  return (
    <Card className="w-full shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="text-center text-xl md:text-2xl font-bold flex items-center justify-center">
            <Award className="mr-2 h-6 w-6 text-yellow-500" /> Overall Session Leaderboard
        </CardTitle>
        <CardDescription className="text-center text-muted-foreground">
            Final scores for all presenters in this session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">Rank</TableHead>
              <TableHead>Presenter</TableHead>
              <TableHead className="text-center">Net Score <TrendingUp className="inline-block h-4 w-4 ml-1"/></TableHead>
              <TableHead className="text-center">Likes <ThumbsUp className="inline-block h-4 w-4 ml-1 text-green-500"/></TableHead>
              <TableHead className="text-center">Dislikes <ThumbsDown className="inline-block h-4 w-4 ml-1 text-red-500"/></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedScores.map((score, index) => (
              <TableRow key={score.name + index} className={index === 0 ? 'bg-yellow-100/50 dark:bg-yellow-700/30 font-semibold' : ''}>
                <TableCell className="text-center font-medium">{index + 1}</TableCell>
                <TableCell>{score.name}</TableCell>
                <TableCell className="text-center font-bold">{score.netScore}</TableCell>
                <TableCell className="text-center text-green-600 dark:text-green-400">{score.likes}</TableCell>
                <TableCell className="text-center text-red-600 dark:text-red-400">{score.dislikes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default OverallLeaderboard;
