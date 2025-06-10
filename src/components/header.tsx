
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LogIn, LogOut, UserCircle } from 'lucide-react';
import { ThemeToggleButton } from './theme-toggle-button';

const Header: React.FC = () => {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-auto flex items-center space-x-2">
          <Image src="/classvote-logo-icon.png" alt="ClassVote Icon" width={32} height={32} data-ai-hint="logo icon" />
          <span className="font-bold hidden sm:inline-block">ClassVote</span>
        </Link>
        <nav className="flex items-center space-x-2">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : user ? (
            <>
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user.isAnonymous ? 'Guest' : (user.displayName || user.email || 'User')}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="mr-1 h-4 w-4" /> Logout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={signInWithGoogle}>
              <LogIn className="mr-1 h-4 w-4" /> Sign in with Google
            </Button>
          )}
          <ThemeToggleButton />
        </nav>
      </div>
    </header>
  );
};

export default Header;
