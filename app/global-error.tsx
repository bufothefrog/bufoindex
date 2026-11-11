'use client';

// Replaces the root layout when the layout itself throws, so it renders its
// own <html> and <body> and imports the global stylesheet for the theme tokens.
import './globals.css';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  // next.config.js keeps console.error in production builds so this survives.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong | BufoIndex</title>
      </head>
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 py-16">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            BufoIndex hit an unexpected error while loading. Calculator inputs are kept in this
            browser, so retrying should not lose them.
          </p>
          <div>
            <Button onClick={reset} className="min-h-11">
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
