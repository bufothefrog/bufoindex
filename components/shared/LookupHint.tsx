/**
 * LookupHint
 * Muted "where to find this" helper text for fields that usually need a
 * document or a moment of thought (benefit portals, pay stubs, ssa.gov).
 */

import React from 'react';
import { FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LookupHintProps {
  children: React.ReactNode;
  className?: string;
}

export function LookupHint({ children, className }: LookupHintProps) {
  return (
    <p className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}>
      <FileSearch className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export default LookupHint;
