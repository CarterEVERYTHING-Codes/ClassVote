
"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Home, ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ChangelogPage() {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchChangelog = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Ensure CHANGELOG.md is in the public folder
        const response = await fetch('/CHANGELOG.md');
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Changelog file not found. Please ensure CHANGELOG.md is in the /public directory.');
          }
          throw new Error(`Failed to fetch changelog: ${response.statusText}`);
        }
        const text = await response.text();
        setMarkdown(text);
      } catch (err) {
        console.error("Error fetching changelog:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching the changelog.");
      }
      setIsLoading(false);
    };

    fetchChangelog();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <ScrollText className="mr-3 h-8 w-8 text-primary" />
            What's New - Changelog
          </h1>
          <p className="text-muted-foreground">Recent updates and changes to ClassVote.</p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-4 sm:mt-0">
          <Home className="mr-2 h-4 w-4" /> Back to Homepage
        </Button>
      </div>

      <Card className="w-full shadow-xl">
        <CardHeader>
          <CardTitle>Application Changelog</CardTitle>
          <CardDescription>
            Tracks notable features, improvements, and bug fixes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-1/2 mt-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}
          {error && (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Changelog</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                If you are the developer, please ensure the `CHANGELOG.md` file is placed in the `public` directory of your project.
              </p>
            </div>
          )}
          {!isLoading && !error && markdown && (
            <article className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none 
                                  [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 
                                  [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 
                                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
                                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1
                                  [&_p]:leading-relaxed
                                  [&_a]:text-primary hover:[&_a]:underline
                                  [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-sm
                                  [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-md [&_pre]:overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </article>
          )}
          {!isLoading && !error && !markdown && (
            <p className="text-muted-foreground text-center py-4">Changelog content is empty or could not be loaded.</p>
          )}
        </CardContent>
      </Card>
       <p className="text-center mt-8">
        <Link href="/" className="text-sm text-primary hover:underline">
          &larr; Back to Home
        </Link>
      </p>
    </main>
  );
}
