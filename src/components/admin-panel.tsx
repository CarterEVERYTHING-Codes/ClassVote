
"use client";

import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, LogOut, Zap, Play, Pause, RotateCcw } from 'lucide-react';

const ADMIN_EMAIL = "your-admin-email@example.com"; // IMPORTANT: Change this to your admin email

const AdminPanel: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoundActive, setIsRoundActive] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === ADMIN_EMAIL);
      setLoadingAuth(false);
    });

    const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
    const unsubscribeStatus = onSnapshot(gameStatusDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsRoundActive(docSnap.data()?.isRoundActive ?? true);
      } else {
        // Initialize if document doesn't exist
        setDoc(gameStatusDocRef, { isRoundActive: true }, { merge: true });
        setIsRoundActive(true);
      }
    }, (error) => {
      console.error("Error fetching game status: ", error);
      setIsRoundActive(true); // Default on error
    });
    
    // Ensure leaderboard scores document is initialized if it doesn't exist
    const scoresDocRef = doc(db, 'leaderboard', 'scores');
    onSnapshot(scoresDocRef, (docSnap) => {
      if (!docSnap.exists()) {
        setDoc(scoresDocRef, { goodClicks: 0, badClicks: 0 }, { merge: true });
      }
    });


    return () => {
      unsubscribeAuth();
      unsubscribeStatus();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast({ title: "Signed In", description: "Successfully signed in." });
    } catch (error) {
      console.error("Error signing in: ", error);
      toast({ title: "Sign In Error", description: "Could not sign in.", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Successfully signed out." });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: "Sign Out Error", description: "Could not sign out.", variant: "destructive" });
    }
  };

  const handleClearLeaderboard = async () => {
    if (!isAdmin) return;
    try {
      const scoresDocRef = doc(db, 'leaderboard', 'scores');
      await setDoc(scoresDocRef, { goodClicks: 0, badClicks: 0 });
      toast({ title: "Leaderboard Cleared", description: "Scores have been reset." });
    } catch (error) {
      console.error("Error clearing leaderboard: ", error);
      toast({ title: "Error", description: "Could not clear leaderboard.", variant: "destructive" });
    }
  };

  const handleToggleRound = async () => {
    if (!isAdmin) return;
    try {
      const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
      await setDoc(gameStatusDocRef, { isRoundActive: !isRoundActive }, { merge: true });
      toast({ title: "Round Status Updated", description: `Round is now ${!isRoundActive ? 'active' : 'stopped'}.` });
    } catch (error) {
      console.error("Error toggling round: ", error);
      toast({ title: "Error", description: "Could not update round status.", variant: "destructive" });
    }
  };
  
  if (loadingAuth) {
    return <div className="text-center p-4">Loading Admin Panel...</div>;
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold flex items-center justify-center">
          <Zap className="mr-2 h-6 w-6" /> Admin Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user ? (
          <Button onClick={handleSignIn} className="w-full">
            <LogIn className="mr-2" /> Sign In with Google
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">Welcome, {user.displayName || user.email}!</p>
            {isAdmin && (
              <div className="space-y-2 pt-2 border-t">
                <h3 className="text-lg font-semibold text-center mb-2">Admin Actions</h3>
                <p className="text-sm text-center font-medium">
                  Round Status: <span className={isRoundActive ? "text-green-500" : "text-red-500"}>{isRoundActive ? 'ACTIVE' : 'STOPPED'}</span>
                </p>
                <Button onClick={handleToggleRound} variant="outline" className="w-full">
                  {isRoundActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                  {isRoundActive ? 'Stop Round' : 'Start Round'}
                </Button>
                <Button onClick={handleClearLeaderboard} variant="destructive" className="w-full">
                  <RotateCcw className="mr-2" /> Clear Leaderboard
                </Button>
              </div>
            )}
            {!isAdmin && <p className="text-center text-red-500 text-sm">You are not authorized as an admin.</p>}
             <p className="text-xs text-center text-muted-foreground pt-2">Remember to replace `your-admin-email@example.com` in `AdminPanel.tsx` with your actual admin email.</p>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="mr-2" /> Sign Out
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
