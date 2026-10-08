'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ResetProfileButtonProps {
  onReset: () => void;
  className?: string;
}

/** Two-step reset: the first tap asks for confirmation, the second clears the profile. */
export function ResetProfileButton({ onReset, className }: ResetProfileButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={cn('w-full px-4 sm:w-auto', className)}
        onClick={() => setConfirming(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        Reset profile
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby="reset-profile-prompt"
      className={cn('w-full rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:w-auto', className)}
    >
      <p id="reset-profile-prompt" className="mb-2 text-sm text-foreground">
        Clear the saved profile from this browser?
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          size="lg"
          className="px-4"
          onClick={() => {
            setConfirming(false);
            onReset();
          }}
        >
          Confirm reset
        </Button>
        <Button type="button" variant="outline" size="lg" className="px-4" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default ResetProfileButton;
