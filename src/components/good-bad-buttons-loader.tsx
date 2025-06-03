
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Props for the actual GoodBadButtons component
interface GoodBadButtonsProps {
  sessionId: string;
  isRoundActive: boolean;
}

// Dynamically import GoodBadButtons
const GoodBadButtons = dynamic<GoodBadButtonsProps>(() => import('@/components/good-bad-buttons'), {
  ssr: false, // Keep SSR false as Tone.js is client-side
  loading: () => (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
      <Skeleton className="h-12 w-32 rounded-lg" />
      <Skeleton className="h-12 w-32 rounded-lg" />
    </div>
  ),
});

// The loader component now accepts props and passes them down
export default function GoodBadButtonsLoader(props: GoodBadButtonsProps) {
  return <GoodBadButtons {...props} />;
}
