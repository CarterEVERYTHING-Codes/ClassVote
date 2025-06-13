
"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service or console
    // In a real app, you might send this to Sentry, LogRocket, etc.
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl text-destructive">Application Error</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            We're sorry, but something went wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            This might be a temporary issue with our services or your connection.
            Please try again in a few moments.
          </p>
          {/* Conditionally display more error info in development */}
          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md text-left text-xs overflow-auto max-h-32 border border-dashed">
              <p className="font-semibold">Error Details (Development Mode Only):</p>
              <pre className="whitespace-pre-wrap">{error.message}</pre>
              {error.digest && <p className="mt-1"><span className="font-semibold">Digest:</span> {error.digest}</p>}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={
                // Attempt to recover by trying to re-render the segment
                () => reset()
              }
              variant="outline"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={() => window.location.href = '/'} // Simple redirect to home
              className="w-full sm:w-auto"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
