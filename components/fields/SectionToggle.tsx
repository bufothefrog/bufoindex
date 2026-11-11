'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SectionToggleProps {
  expanded: boolean;
  onToggle: () => void;
  /** Id of the section body the toggle shows and hides. */
  controls: string;
  expandLabel: string;
  collapseLabel: string;
  expandIcon?: 'edit' | 'chevron';
  /** Completes the accessible name: "Show assumptions". */
  sectionName: string;
}

/**
 * The Edit / Done (or Show / Hide) button in an input card's header. It
 * stays mounted in both states, so focus stays on it when the body swaps.
 */
export function SectionToggle({
  expanded,
  onToggle,
  controls,
  expandLabel,
  collapseLabel,
  expandIcon = 'chevron',
  sectionName,
}: SectionToggleProps) {
  const ExpandIcon = expandIcon === 'edit' ? Pencil : ChevronDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={`${expanded ? collapseLabel : expandLabel} ${sectionName}`}
      className="min-h-11 shrink-0 px-3 text-sage-700 hover:bg-sage-100 dark:text-sage-200 dark:hover:bg-sage-800"
    >
      {expanded ? (
        <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
      ) : (
        <ExpandIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      {expanded ? collapseLabel : expandLabel}
    </Button>
  );
}

export default SectionToggle;
