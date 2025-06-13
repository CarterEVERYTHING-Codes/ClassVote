
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
// Removed: import type { SessionData } from '@/app/session/[sessionId]/page'; 

interface GoodBadButtonsProps {
  sessionId: string;
  isRoundActive: boolean;
  soundsEnabled: boolean;
  roundId?: number; 
  votingMode: 'single' | 'infinite'; // Directly defined type
  generalRoundInstanceId?: number; 
}

const GoodBadButtons = dynamic<GoodBadButtonsProps>(() => import('@/components/good-bad-buttons'), {
  ssr: false, 
  loading: () => (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
        <Skeleton className="h-12 w-32 rounded-lg" />
        <Skeleton className="h-12 w-32 rounded-lg" />
      </div>
       <Skeleton className="h-5 w-3/4 mt-2" />
    </div>
  ),
});

export default function GoodBadButtonsLoader(props: GoodBadButtonsProps) {
  return <GoodBadButtons {...props} />;
}
