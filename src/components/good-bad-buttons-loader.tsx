"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const GoodBadButtons = dynamic(() => import('@/components/good-bad-buttons'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
      <Skeleton className="h-12 w-32 rounded-lg" />
      <Skeleton className="h-12 w-32 rounded-lg" />
    </div>
  ),
});

export default function GoodBadButtonsLoader() {
  return <GoodBadButtons />;
}
