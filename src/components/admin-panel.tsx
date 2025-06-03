
"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase'; // Removed auth, googleProvider
import { doc, setDoc, onSnapshot, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, LogOut, Zap, Play, Pause, RotateCcw, ShieldAlert } from 'lucide-react';

const ADMIN_USERNAME = "Admin123";
const ADMIN_PASSWORD = "Carter2012";

const AdminPanel: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isRoundActive, setIsRoundActive] = useState(true);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize game status and leaderboard scores
    const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
    const unsubscribeStatus = onSnapshot(gameStatusDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsRoundActive(docSnap.data()?.isRoundActive ?? true);
      } else {
        setDoc(gameStatusDocRef, { isRoundActive: true }, { merge: true });
        setIsRoundActive(true);
      }
      setLoadingInitialData(false);
    }, (error) => {
      console.error("Error fetching game status: ", error);
      setIsRoundActive(true); // Default on error
      setLoadingInitialData(false);
    });
    
    const scoresDocRef = doc(db, 'leaderboard', 'scores');
    const unsubscribeScores = onSnapshot(scoresDocRef, (docSnap) => {
      if (!docSnap.exists()) {
        setDoc(scoresDocRef, { goodClicks: 0, badClicks: 0 }, { merge: true });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeScores();
    };
  }, []);

  const handleAdminLogin = () => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      toast({ title: "Admin Login Successful", description: "You are now logged in as admin." });
      setUsername('');
      setPassword('');
    } else {
      toast({ title: "Admin Login Failed", description: "Invalid username or password.", variant: "destructive" });
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    toast({ title: "Admin Logged Out", description: "You have successfully logged out." });
  };

  const handleClearLeaderboard = async () => {
    if (!isAdminLoggedIn) return;
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
    if (!isAdminLoggedIn) return;
    try {
      const gameStatusDocRef = doc(db, 'gameAdmin', 'status');
      await setDoc(gameStatusDocRef, { isRoundActive: !isRoundActive }, { merge: true });
      toast({ title: "Round Status Updated", description: `Round is now ${!isRoundActive ? 'active' : 'stopped'}.` });
    } catch (error) {
      console.error("Error toggling round: ", error);
      toast({ title: "Error", description: "Could not update round status.", variant: "destructive" });
    }
  };
  
  if (loadingInitialData) {
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
        {!isAdminLoggedIn ? (
          <div className="space-y-4">
            <div className="flex items-center p-3 rounded-md bg-yellow-100 border border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300">
              <ShieldAlert className="h-5 w-5 mr-2 shrink-0" />
              <p className="text-xs">
                <strong>Warning:</strong> This login method is not secure for production use. Credentials are hardcoded.
              </p>
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Admin Username" 
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Admin Password"
                className="mt-1"
              />
            </div>
            <Button onClick={handleAdminLogin} className="w-full">
              <LogIn className="mr-2" /> Admin Login
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-green-600 dark:text-green-400 font-semibold">Welcome, Admin!</p>
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
            <Button onClick={handleAdminLogout} variant="outline" className="w-full">
              <LogOut className="mr-2" /> Admin Logout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
