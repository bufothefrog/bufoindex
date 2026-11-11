'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { isIntakeIntent } from '@/lib/constants/intake';
import { Wizard } from './Wizard';

export interface CoreStartWizardProps {
  className?: string;
}

/**
 * The shared core intake for the static /start page. Reads `?next=<intent>`
 * on the client (useSearchParams, so the page must wrap this in Suspense);
 * an unknown value continues to the chooser.
 */
export function CoreStartWizard({ className }: CoreStartWizardProps) {
  const raw = useSearchParams().get('next');
  const next = raw && isIntakeIntent(raw) ? raw : undefined;
  return (
    <div className={className}>
      <Wizard flow="core" next={next} />
    </div>
  );
}

export default CoreStartWizard;
