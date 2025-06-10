
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged 
} from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAnonymousGuest: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  ensureAnonymousSignIn: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      toast({ title: "Signed in successfully!", description: `Welcome ${result.user.displayName || 'User'}!` });
      setLoading(false);
      return result.user;
    } catch (error) {
      console.error("Error signing in with Google: ", error);
      toast({ title: "Sign-in Error", description: "Could not sign in with Google. Please try again.", variant: "destructive" });
      setLoading(false);
      return null;
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      toast({ title: "Signed Out", description: "You have been signed out." });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ title: "Sign-out Error", description: "Could not sign out. Please try again.", variant: "destructive" });
    }
    setLoading(false);
  };
  
  const ensureAnonymousSignIn = async (): Promise<User | null> => {
    if (auth.currentUser) return auth.currentUser; // Already signed in (Google or anon)
    setLoading(true);
    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      setUser(userCredential.user);
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      console.error("Error ensuring anonymous sign-in: ", error);
      toast({ title: "Session Error", description: "Could not establish an anonymous session.", variant: "destructive"});
      setLoading(false);
      return null;
    }
  };

  const isAnonymousGuest = user ? user.isAnonymous : true; // Treat loading or null user as guest for simplicity in some UI

  return (
    <AuthContext.Provider value={{ user, loading, isAnonymousGuest, signInWithGoogle, signOut, ensureAnonymousSignIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
