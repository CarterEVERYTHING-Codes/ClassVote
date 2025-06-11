
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthError } from 'firebase/auth';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously as firebaseSignInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail, // Renamed import
  deleteUser as firebaseDeleteUser // Renamed import
} from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAnonymousGuest: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signUpWithEmail: (email: string, password: string) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  ensureAnonymousSignIn: () => Promise<User | null>;
  sendPasswordReset: () => Promise<boolean>; // Changed signature
  deleteAccount: () => Promise<boolean>;
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
        // Use defaultMessage or a generic one
        break;
    }
    toast({ title: title, description: message, variant: "destructive" });
  }

  const signInWithGoogle = async (): Promise<User | null> => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      toast({ title: "Signed in successfully!", description: `Welcome ${result.user.displayName || 'User'}!` });
      setLoading(false);
      return result.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign in with Google. Please try again.");
      setLoading(false);
      return null;
    }
  };

  const signUpWithEmail = async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      toast({ title: "Signed up successfully!", description: `Welcome!` });
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign up. Please try again.");
      setLoading(false);
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      toast({ title: "Signed in successfully!", description: `Welcome back!` });
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign in. Please try again.");
      setLoading(false);
      return null;
    }
  };

  const signOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null); // Explicitly set user to null
      toast({ title: "Signed Out", description: "You have been signed out." });
    } catch (error) {
      handleAuthError(error as AuthError, "Could not sign out. Please try again.");
    }
    setLoading(false);
  };
  
  const ensureAnonymousSignIn = async (): Promise<User | null> => {
    if (auth.currentUser) return auth.currentUser; 
    setLoading(true);
    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      setUser(userCredential.user);
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not establish an anonymous session.");
      setLoading(false);
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
      setUser(null); // Ensure local state is cleared
      // SignOut is implicitly handled by deleteUser, but explicit signOut after might be needed if issues arise
      return true;
    } catch (error) {
      handleAuthError(error as AuthError, "Could not delete your account. You might need to sign in again if it has been too long.", "Account Deletion Failed");
      return false;
    }
  };


  const isAnonymousGuest = user ? user.isAnonymous : true;

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
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
