
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import OverallLeaderboard from '@/components/overall-leaderboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ListCollapse, CalendarDays, AlertCircle, Home, UserCheck, ThumbsUp, ThumbsDown, TrendingUp, BarChart3, ShieldCheck, Save, Trash2, ShieldQuestion } from 'lucide-react';
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
  adminUid: string;
  createdAt: Timestamp;
  sessionEnded: boolean;
  presenterScores?: PresenterScoreData[];
  sessionType?: string;
  isPermanentlySaved?: boolean; // New field
}

interface CombinedResult {
  session: SessionDocForResults;
  isAdminView: boolean;
  userSpecificScores: PresenterScoreData[]; 
}

export default function ResultsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [combinedResults, setCombinedResults] = useState<CombinedResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.isAnonymous) {
      toast({ title: "Access Denied", description: "You must be signed in to view results.", variant: "destructive" });
      router.replace('/auth');
      return;
    }

    const fetchResults = async () => {
      setIsLoadingResults(true);
      setError(null);
      try {
        const sessionsRef = collection(db, 'sessions');
        const q = query(sessionsRef, orderBy('createdAt', 'desc'));
        
        const querySnapshot = await getDocs(q);
        const fetchedCombinedResults: CombinedResult[] = [];

        querySnapshot.forEach((docSnap) => {
          const sessionData = docSnap.data() as SessionDocForResults;
          sessionData.id = docSnap.id; 

          const isAdmin = sessionData.adminUid === user.uid;
          let userSpecificScores: PresenterScoreData[] = [];

          if (!isAdmin && sessionData.presenterScores && Array.isArray(sessionData.presenterScores)) {
            userSpecificScores = sessionData.presenterScores.filter(score => score.uid === user.uid);
          }

          if (isAdmin || userSpecificScores.length > 0) {
            fetchedCombinedResults.push({
              session: sessionData,
              isAdminView: isAdmin,
              userSpecificScores: userSpecificScores,
            });
          }
        });
        
        setCombinedResults(fetchedCombinedResults);

      } catch (err) {
        console.error("Error fetching results: ", err);
        setError("Could not load your results. Please try again later.");
        toast({ title: "Error", description: "Failed to fetch your results history.", variant: "destructive" });
      }
      setIsLoadingResults(false);
    };

    fetchResults();
  }, [user, authLoading, router, toast]);

  const handleTogglePermanentSave = async (sessionId: string, currentSaveStatus: boolean | undefined) => {
    setIsProcessingAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionDocRef, { isPermanentlySaved: !currentSaveStatus });
      setCombinedResults(prevResults =>
        prevResults.map(r =>
          r.session.id === sessionId
            ? { ...r, session: { ...r.session, isPermanentlySaved: !currentSaveStatus } }
            : r
        )
      );
      toast({ title: "Session Updated", description: `Session is now ${!currentSaveStatus ? "permanently saved" : "set for potential auto-deletion after 30 days"}.` });
    } catch (err) {
      console.error("Error updating permanent save status:", err);
      toast({ title: "Error", description: "Could not update session save status.", variant: "destructive" });
    }
    setIsProcessingAction(false);
  };

  const confirmDeleteSession = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteConfirmDialog(true);
  };

  const executeDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsProcessingAction(true);
    try {
      const sessionDocRef = doc(db, 'sessions', sessionToDelete);
      await deleteDoc(sessionDocRef);
      setCombinedResults(prevResults => prevResults.filter(r => r.session.id !== sessionToDelete));
      toast({ title: "Session Deleted", description: "The session has been permanently deleted." });
    } catch (err) {
      console.error("Error deleting session:", err);
      toast({ title: "Error", description: "Could not delete session.", variant: "destructive" });
    }
    setIsProcessingAction(false);
    setShowDeleteConfirmDialog(false);
    setSessionToDelete(null);
  };


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
        <h1 className="text-2xl font-semibold text-destructive mb-2">Error Loading Results</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <Home className="mr-2 h-4 w-4" /> Go to Homepage
        </Button>
      </main>
    );
  }

  if (!user) { 
    return <main className="container mx-auto px-4 py-8 text-center"><p>Redirecting...</p></main>;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <BarChart3 className="mr-3 h-8 w-8 text-primary" /> Session Results
          </h1>
          <p className="text-muted-foreground">Review scores from sessions you've administered or participated in as a presenter.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Note: Sessions not marked "Keep Permanently" may be automatically deleted after 30 days. (Automatic deletion requires server-side setup).
          </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4 sm:mt-0">
          <Home className="mr-2 h-4 w-4" /> Back to Homepage
        </Button>
      </div>

      {combinedResults.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <ListCollapse className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Results Found</h3>
            <p className="text-muted-foreground">
              We couldn't find any session results linked to your account (either as an admin or a presenter).
            </p>
             <Button onClick={() => router.push('/')} className="mt-6">Create or Join a Session</Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4">
          {combinedResults.map(({ session, isAdminView, userSpecificScores }) => (
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
                    <div className="flex flex-col items-end mt-2 sm:mt-0">
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full mb-1 ${
                            isAdminView ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' 
                                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                            }`}>
                            {isAdminView ? (<><ShieldCheck className="inline h-3 w-3 mr-1"/>Admin View</>) : (<><UserCheck className="inline h-3 w-3 mr-1"/>Presenter View</>)}
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${session.sessionEnded ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                            {session.sessionEnded ? 'Ended' : 'Active/Unknown'}
                        </span>
                         {isAdminView && (
                            <span className={`mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${session.isPermanentlySaved ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                {session.isPermanentlySaved ? <><Save className="inline h-3 w-3 mr-1"/>Kept</> : <><ShieldQuestion className="inline h-3 w-3 mr-1"/>Not Permanent</>}
                            </span>
                         )}
                    </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                {isAdminView && (
                  <div className="mb-4 p-3 border rounded-md bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`keep-session-${session.id}`} className="flex items-center text-sm font-medium">
                        <Save className="mr-2 h-4 w-4" /> Keep This Session Permanently
                      </Label>
                      <Switch
                        id={`keep-session-${session.id}`}
                        checked={!!session.isPermanentlySaved}
                        onCheckedChange={() => handleTogglePermanentSave(session.id, session.isPermanentlySaved)}
                        disabled={isProcessingAction}
                      />
                    </div>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => confirmDeleteSession(session.id)}
                        disabled={isProcessingAction}
                        className="w-full sm:w-auto"
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Session
                    </Button>
                  </div>
                )}

                {isAdminView ? (
                  session.presenterScores && session.presenterScores.length > 0 ? (
                    <OverallLeaderboard presenterScores={session.presenterScores} />
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No presenter scores were recorded for this session, or the presenter queue was not used.</p>
                    </div>
                  )
                ) : ( 
                  userSpecificScores.length > 0 ? (
                    <div>
                      <h3 className="text-md font-semibold mb-2">Your Presentations in this Session:</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Presentation Name</TableHead>
                            <TableHead className="text-center">Likes <ThumbsUp className="inline h-4 w-4 ml-1 text-green-500"/></TableHead>
                            <TableHead className="text-center">Dislikes <ThumbsDown className="inline h-4 w-4 ml-1 text-red-500"/></TableHead>
                            <TableHead className="text-center">Net Score <TrendingUp className="inline h-4 w-4 ml-1"/></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userSpecificScores.map((score, index) => (
                            <TableRow key={`${session.id}-${score.name}-${index}`}>
                              <TableCell className="font-medium">{score.name}</TableCell>
                              <TableCell className="text-center text-green-600 font-semibold">{score.likes}</TableCell>
                              <TableCell className="text-center text-red-600 font-semibold">{score.dislikes}</TableCell>
                              <TableCell className="text-center font-bold">{score.netScore}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                     <div className="text-center py-4">
                        <p className="text-muted-foreground">You did not have any scored presentations linked to your account in this session.</p>
                     </div>
                  )
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete session {sessionToDelete}.
              All associated data for this session will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setShowDeleteConfirmDialog(false); setSessionToDelete(null);}} disabled={isProcessingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDeleteSession} 
              disabled={isProcessingAction}
              className={buttonVariants({variant: "destructive"})}
            >
              {isProcessingAction ? "Deleting..." : "Yes, Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </main>
  );
}
