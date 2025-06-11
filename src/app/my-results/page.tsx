
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, Timestamp, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, CalendarDays, AlertCircle, Home, ThumbsUp, ThumbsDown, TrendingUp, UserCheck, ListCollapse } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PresenterScoreData {
  name: string;
  uid?: string | null;
  likes: number;
  dislikes: number;
  netScore: number;
}

interface SessionDocForResults {
  id: string;
  createdAt: Timestamp;
  // other session fields if needed for context, e.g., adminNickname
}

interface UserResult {
  sessionId: string;
  sessionCreatedAt: Timestamp;
  presentationName: string; // This was the 'name' field in PresenterScore
  likes: number;
  dislikes: number;
  netScore: number;
}

export default function MyResultsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.isAnonymous) {
      toast({ title: "Access Denied", description: "You must be signed in to view your results.", variant: "destructive" });
      router.replace('/auth');
      return;
    }

    const fetchUserResults = async () => {
      setIsLoadingResults(true);
      setError(null);
      try {
        const sessionsRef = collection(db, 'sessions');
        // Query for sessions where the presenterScores array contains an object with the user's UID.
        // Firestore doesn't support querying for array elements containing a specific map value directly in a general way without specific indexing.
        // So, we fetch all sessions and filter client-side. This is not scalable for very large numbers of sessions.
        // For better scalability, a separate collection for user-specific results or more complex indexing would be needed.
        const q = query(sessionsRef, orderBy('createdAt', 'desc')); // Order to show recent sessions first
        
        const querySnapshot = await getDocs(q);
        const fetchedResults: UserResult[] = [];

        querySnapshot.forEach((docSnap) => {
          const sessionData = docSnap.data();
          const sessionId = docSnap.id;
          const sessionCreatedAt = sessionData.createdAt as Timestamp;

          if (sessionData.presenterScores && Array.isArray(sessionData.presenterScores)) {
            sessionData.presenterScores.forEach((score: PresenterScoreData) => {
              if (score.uid === user.uid) {
                fetchedResults.push({
                  sessionId: sessionId,
                  sessionCreatedAt: sessionCreatedAt,
                  presentationName: score.name,
                  likes: score.likes,
                  dislikes: score.dislikes,
                  netScore: score.netScore,
                });
              }
            });
          }
        });
        
        // Sort primarily by session date (desc), then by presentation name (asc)
        fetchedResults.sort((a, b) => {
            const dateDiff = b.sessionCreatedAt.toMillis() - a.sessionCreatedAt.toMillis();
            if (dateDiff !== 0) return dateDiff;
            return a.presentationName.localeCompare(b.presentationName);
        });

        setUserResults(fetchedResults);
      } catch (err) {
        console.error("Error fetching user results: ", err);
        setError("Could not load your presentation results. Please try again later.");
        toast({ title: "Error", description: "Failed to fetch your results history.", variant: "destructive" });
      }
      setIsLoadingResults(false);
    };

    fetchUserResults();
  }, [user, authLoading, router, toast]);

  if (authLoading || isLoadingResults) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-8 w-1/4 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold text-destructive mb-2">Error Loading Your Results</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }

  if (!user) { // Should be caught by useEffect redirect
    return <main className="container mx-auto px-4 py-8 text-center"><p>Redirecting...</p></main>;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <UserCheck className="mr-3 h-8 w-8 text-primary" /> Your Presentation Results
          </h1>
          <p className="text-muted-foreground">Review scores from presentations you've delivered.</p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4 sm:mt-0">
          <Home className="mr-2 h-4 w-4" /> Back to Homepage
        </Button>
      </div>

      {userResults.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <ListCollapse className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Results Found</h3>
            <p className="text-muted-foreground">
              We couldn't find any presentation scores linked to your account.
              <br />
              This could be because you haven't presented yet, or the session admin didn't link your name to your account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
            {/* Group results by session ID if you want accordion style, or just list them */}
            {/* For simplicity, let's list them directly in a table for now */}
            <Card>
                <CardHeader>
                    <CardTitle>All Your Recorded Presentations</CardTitle>
                    <CardDescription>Sorted by most recent session, then by presentation name.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Session Date</TableHead>
                                <TableHead>Session ID</TableHead>
                                <TableHead>Presentation Name</TableHead>
                                <TableHead className="text-center">Likes <ThumbsUp className="inline h-4 w-4 ml-1 text-green-500"/></TableHead>
                                <TableHead className="text-center">Dislikes <ThumbsDown className="inline h-4 w-4 ml-1 text-red-500"/></TableHead>
                                <TableHead className="text-center">Net Score <TrendingUp className="inline h-4 w-4 ml-1"/></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userResults.map((result, index) => (
                                <TableRow key={`${result.sessionId}-${result.presentationName}-${index}`}>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {format(result.sessionCreatedAt.toDate(), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{result.sessionId}</TableCell>
                                    <TableCell className="font-medium">{result.presentationName}</TableCell>
                                    <TableCell className="text-center text-green-600 font-semibold">{result.likes}</TableCell>
                                    <TableCell className="text-center text-red-600 font-semibold">{result.dislikes}</TableCell>
                                    <TableCell className="text-center font-bold">{result.netScore}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      )}
    </main>
  );
}

