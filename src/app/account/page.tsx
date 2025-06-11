
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Home, UserCircle, Mail, KeyRound, Trash2, ShieldAlert } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, sendPasswordReset, deleteAccount, signOut } = useAuth();
  const { toast } = useToast();

  const [isProcessingPasswordReset, setIsProcessingPasswordReset] = useState(false);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.isAnonymous)) {
      toast({ title: "Access Denied", description: "You must be signed in to manage your account.", variant: "destructive" });
      router.replace('/auth');
    }
  }, [user, authLoading, router, toast]);

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "User email not found.", variant: "destructive" });
      return;
    }
    setIsProcessingPasswordReset(true);
    await sendPasswordReset();
    setIsProcessingPasswordReset(false);
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirmDialog(false);
    if (!user) return;

    setIsProcessingDelete(true);
    const success = await deleteAccount();
    setIsProcessingDelete(false);

    if (success) {
      // Auth context should set user to null, leading to redirect by useEffect or manual redirect
      // router.replace('/'); // User will be signed out, onAuthStateChanged will set user to null.
    }
  };

  const isEmailPasswordUser = user?.providerData.some(provider => provider.providerId === 'password');

  if (authLoading || (!user && !authLoading)) { // Show skeleton if auth is loading OR if user is null and not done loading (initial state)
    return (
      <main className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/3 mb-6" />
        <Card className="w-full max-w-lg mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="pt-6 border-t">
              <Skeleton className="h-10 w-full bg-red-300/50" />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }
  
  // If user becomes null/anonymous AFTER initial load (e.g., due to deletion or sign out), useEffect redirects.
  // This check is for the case where user is already null/anonymous when component attempts to render content.
  if (!user || user.isAnonymous) {
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <UserCircle className="mr-3 h-8 w-8 text-primary" /> Account Management
          </h1>
          <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4 sm:mt-0">
          <Home className="mr-2 h-4 w-4" /> Back to Homepage
        </Button>
      </div>

      <Card className="w-full max-w-lg mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl">Your Information</CardTitle>
          <CardDescription>View and manage your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-md">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Email Address</p>
              <p className="text-sm text-muted-foreground">{user.email || "No email associated"}</p>
            </div>
          </div>
          
          {isEmailPasswordUser && (
            <div className="space-y-3">
              <h3 className="text-md font-semibold flex items-center text-foreground">
                <KeyRound className="mr-2 h-5 w-5" /> Password
              </h3>
              <Button 
                onClick={handlePasswordReset} 
                variant="outline" 
                className="w-full"
                disabled={isProcessingPasswordReset || authLoading}
              >
                {isProcessingPasswordReset ? "Sending..." : "Send Password Reset Email"}
              </Button>
            </div>
          )}

          <div className="pt-6 border-t border-border">
            <h3 className="text-md font-semibold flex items-center text-destructive mb-3">
              <ShieldAlert className="mr-2 h-5 w-5" /> Danger Zone
            </h3>
            <Button 
              onClick={() => setShowDeleteConfirmDialog(true)} 
              variant="destructive" 
              className="w-full"
              disabled={isProcessingDelete || authLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isProcessingDelete ? "Deleting..." : "Delete My Account"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and all associated data from ClassVote.
              Your created sessions and presentation scores will be disassociated but might remain if not explicitly designed for cascading delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmDialog(false)} disabled={isProcessingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount} 
              disabled={isProcessingDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isProcessingDelete ? "Deleting..." : "Yes, Delete My Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
