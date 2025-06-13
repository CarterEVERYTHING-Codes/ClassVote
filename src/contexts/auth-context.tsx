
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthError } from 'firebase/auth';
import { 
  auth, 
  db, // Import db
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  deleteUser as firebaseDeleteUser
} from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore'; // Import doc and getDoc
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean; // True if either auth state or initial server check is pending
  isAnonymousGuest: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signUpWithEmail: (email: string, password: string) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  ensureAnonymousSignIn: () => Promise<User | null>;
  sendPasswordReset: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialServerCheckStatus, setInitialServerCheckStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [serverCheckError, setServerCheckError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkServerStatus = async () => {
      // Only run the check if it's pending
      if (initialServerCheckStatus !== 'pending') return;

      try {
        // This path is for health check. It doesn't need to exist.
        // Rules should allow a read attempt even if it results in "not found".
        // We are testing connectivity.
        const healthCheckDocRef = doc(db, '_internal_health_check/status_test_doc');
        await getDoc(healthCheckDocRef); 
        setInitialServerCheckStatus('success');
      } catch (err) {
        console.error("Initial server health check failed:", err);
        setInitialServerCheckStatus('error');
        // Set the error to be thrown in the render cycle
        setServerCheckError(new Error("Failed to connect to ClassVote servers. Please check your internet connection or try again later."));
      }
    };

    // Don't run server check until Firebase auth is initialized to prevent premature errors if db isn't ready
    if (!authLoading && auth && db) {
        checkServerStatus();
    }
  }, [authLoading, initialServerCheckStatus]); // Depend on authLoading and initialServerCheckStatus

  // If serverCheckError is set, throw it. This will be caught by src/app/error.tsx
  if (serverCheckError) {
    throw serverCheckError;
  }

  const handleAuthError = (error: AuthError, defaultMessage: string, title: string = "Authentication Error") => {
    console.error("Firebase Auth Error: ", error);
    let message = defaultMessage;
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'This email address is already in use. Try signing in or use a different email.';
        break;
      case 'auth/invalid-email':
        message = 'The email address is not valid.';
        break;
      case 'auth/operation-not-allowed':
        message = 'Email/password accounts are not enabled. Please contact support.';
        break;
      case 'auth/weak-password':
        message = 'The password is too weak. Please choose a stronger password.';
        break;
      case 'auth/user-disabled':
        message = 'This user account has been disabled.';
        break;
      case 'auth/user-not-found':
        message = 'No user found with this email. Try signing up or check the email address.';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password. Please try again.';
        break;
      case 'auth/invalid-credential':
        message = 'Invalid credentials. Please check your email and password.';
        break;
      case 'auth/requires-recent-login':
        message = 'This operation is sensitive and requires recent authentication. Please sign out and sign back in to continue.';
        title = "Action Required";
        break;
      default:
        break;
    }
    toast({ title: title, description: message, variant: "destructive" });
  }

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      toast({ title: "Signed in successfully!", description: `Welcome ${result.user.displayName || 'User'}!` });
      setAuthLoading(false);
      return result.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign in with Google. Please try again.");
      setAuthLoading(false);
      return null;
    }
  };

  const signUpWithEmail = async (email: string, password: string): Promise<User | null> => {
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      toast({ title: "Signed up successfully!", description: `Welcome!` });
      setAuthLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign up. Please try again.");
      setAuthLoading(false);
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
    setAuthLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      toast({ title: "Signed in successfully!", description: `Welcome back!` });
      setAuthLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign in. Please try again.");
      setAuthLoading(false);
      return null;
    }
  };

  const signOut = async (): Promise<void> => {
    setAuthLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      toast({ title: "Signed Out", description: "You have been signed out." });
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign out. Please try again.");
    }
    setAuthLoading(false);
  };
  
  const ensureAnonymousSignIn = async (): Promise<User | null> => {
    if (auth.currentUser) return auth.currentUser; 
    setAuthLoading(true);
    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      setUser(userCredential.user);
      setAuthLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not establish an anonymous session.");
      setAuthLoading(false);
      return null;
    }
  };

  const sendPasswordReset = async (): Promise<boolean> => {
    if (!auth.currentUser || !auth.currentUser.email) {
      toast({title: "Error", description: "No authenticated user email found.", variant: "destructive"});
      return false;
    }
    try {
      await firebaseSendPasswordResetEmail(auth, auth.currentUser.email);
      toast({title: "Password Reset Email Sent", description: `If an account exists for ${auth.currentUser.email}, you will receive an email with instructions to reset your password.`, variant: "default"});
      return true;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not send password reset email. Please try again later.", "Password Reset Failed");
      return false;
    }
  };

  const deleteAccount = async (): Promise<boolean> => {
    if (!auth.currentUser) {
       toast({title: "Error", description: "No user is currently signed in to delete.", variant: "destructive"});
      return false;
    }
    const currentUser = auth.currentUser;
    try {
      await firebaseDeleteUser(currentUser);
      toast({title: "Account Deleted", description: "Your account has been successfully deleted.", variant: "default"});
      setUser(null);
      return true;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not delete your account. You might need to sign in again if it has been too long.", "Account Deletion Failed");
      return false;
    }
  };

  const isAnonymousGuest = user ? user.isAnonymous : true;
  const appIsGloballyLoading = authLoading || initialServerCheckStatus === 'pending';

  if (appIsGloballyLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <svg className="animate-spin h-12 w-12 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg text-muted-foreground">Loading ClassVote...</p>
        {initialServerCheckStatus === 'pending' && !authLoading && <p className="text-sm text-muted-foreground animate-pulse">Checking server connection...</p>}
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading: appIsGloballyLoading, // Propagate combined loading state
        isAnonymousGuest, 
        signInWithGoogle, 
        signUpWithEmail, 
        signInWithEmail, 
        signOut, 
        ensureAnonymousSignIn,
        sendPasswordReset,
        deleteAccount
      }}>
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
