
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LogIn, LogOut, UserCircle, LifeBuoy, BarChart3, Settings } from 'lucide-react'; // Added Settings
import { ThemeToggleButton } from './theme-toggle-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Header: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleLoginSignUpClick = () => {
    router.push('/auth');
  };

  const feedbackFormUrl = "https://forms.office.com/Pages/ResponsePage.aspx?id=BLz2Ec8cMUi0vqcgjsi4-GqIj1C-TohGgk1iAQp1X5BUQkxXNlRLTktLNk9PV0dEVlVMN1M4VThGRC4u";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-auto flex items-center space-x-2">
          <Image src="/ClassVote-Ico-Favicon.png" alt="ClassVote Icon" width={32} height={32} data-ai-hint="logo icon" className="rounded-md" />
          <span className="font-bold hidden sm:inline-block">ClassVote</span>
        </Link>
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm" 
                  className="px-2 sm:px-3" 
                  onClick={() => window.open(feedbackFormUrl, '_blank', 'noopener,noreferrer')}
                >
                  <LifeBuoy className="h-[1.2rem] w-[1.2rem] mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Feedback</span>
                  <span className="sm:hidden text-xs">Feedback</span> 
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Feedback / Report Bug</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {loading ? (
            <Skeleton className="h-9 w-24" /> 
          ) : user && !user.isAnonymous ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => router.push('/results')} className="px-2 sm:px-3">
                      <BarChart3 className="mr-1 h-4 w-4" /> 
                      <span className="hidden sm:inline">Results</span>
                      <span className="sm:hidden text-xs">Results</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Session Results</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => router.push('/account')} className="px-2 sm:px-3">
                      <Settings className="mr-1 h-4 w-4" /> 
                      <span className="hidden sm:inline">Account</span>
                      <span className="sm:hidden text-xs">Account</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage Your Account</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-sm text-muted-foreground hidden md:inline ml-2">
                {user.displayName || user.email || 'User'}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="px-2 sm:px-3">
                <LogOut className="mr-1 h-4 w-4" /> 
                <span className="hidden sm:inline">Logout</span>
                <span className="sm:hidden text-xs">Logout</span>
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLoginSignUpClick} className="px-2 sm:px-3">
              <UserCircle className="mr-1 h-4 w-4" /> 
              <span className="hidden sm:inline">Login / Sign Up</span>
              <span className="sm:hidden text-xs">Login/Up</span>
            </Button>
          )}
          <ThemeToggleButton />
        </nav>
      </div>
    </header>
  );
};

export default Header;
