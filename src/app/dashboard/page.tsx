"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import OverallLeaderboard from '@/components/overall-leaderboard'; // Reuse for displaying scores
import { ListCollapse, CalendarDays, AlertCircle, Home } from 'lucide-react';
import { format } from 'date-fns';

interface PresenterScore {
  name: string;
  likes: number;
  dislikes: number;
  netScore: number;
}

interface SessionDoc {
  id: string;
  adminUid: string;
  createdAt: Timestamp;
  sessionEnded: boolean;
  presenterScores?: PresenterScore[];
  // Add other relevant fields you might want to display about the session
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user || user.isAnonymous) {
      toast({ title: "Access Denied", description: "You must be signed in to view the dashboard.", variant: "destructive"});
      router.replace('/auth'); // Or '/' if you prefer homepage
      return;
    }

    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setError(null);
      try {
        const sessionsRef = collection(db, 'sessions');
        const q = query(
          sessionsRef,
          where('adminUid', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedSessions: SessionDoc[] = [];
        querySnapshot.forEach((doc) => {
          fetchedSessions.push({ id: doc.id, ...doc.data() } as SessionDoc);
        });
        setSessions(fetchedSessions);
      } catch (err) {
        console.error("Error fetching sessions: ", err);
        setError("Could not load your past sessions. Please try again later.");
        toast({ title: "Error", description: "Failed to fetch session history.", variant: "destructive" });
      }
      setIsLoadingSessions(false);
    };

    fetchSessions();
  }, [user, authLoading, router]);

  if (authLoading || isLoadingSessions) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
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
        <h1 className="text-2xl font-semibold text-destructive mb-2">Error Loading Dashboard</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/')} variant="outline">
            <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }
  
  if (!user) { // Should be caught by useEffect redirect, but as a fallback
    return (
         <main className="container mx-auto px-4 py-8 text-center">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </main>
    );
  }


  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Past Sessions</h1>
            <p className="text-muted-foreground">Review the results from sessions you've administered.</p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4 sm:mt-0">
            <Home className="mr-2 h-4 w-4" /> Back to Homepage
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <ListCollapse className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Sessions Found</h3>
            <p className="text-muted-foreground">You haven't administered any sessions yet, or they haven't finished loading.</p>
            <Button onClick={() => router.push('/')} className="mt-6">Create a New Session</Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4">
          {sessions.map((session) => (
            <AccordionItem value={session.id} key={session.id} className="border rounded-lg bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
                    <div className="text-left">
                        <h2 className="text-lg font-semibold text-primary">Session ID: {session.id}</h2>
                        <p className="text-sm text-muted-foreground flex items-center">
                            <CalendarDays className="mr-1.5 h-4 w-4" /> 
                            Created: {session.createdAt ? format(session.createdAt.toDate(), 'PPP p') : 'Date not available'}
                        </p>
                    </div>
                    <span className={`mt-2 sm:mt-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${session.sessionEnded ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                        {session.sessionEnded ? 'Ended' : 'Active/Unknown'}
                    </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                {session.presenterScores && session.presenterScores.length > 0 ? (
                  <OverallLeaderboard presenterScores={session.presenterScores} />
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No presenter scores were recorded for this session, or the session might not have had a presenter queue.</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </main>
  );
}
