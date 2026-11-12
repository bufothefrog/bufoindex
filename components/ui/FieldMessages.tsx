/**
 * Help text and the error under a field: the one rule every input primitive
 * and field group uses (BaseInput, Checkbox, SelectInput, StateSelector,
 * ChoiceGroup, FieldList). Help is hidden while an error shows, and the
 * error is announced. Pair it with fieldMessageIds so the control's
 * aria-describedby points at whichever of the two is rendered.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface FieldMessageIds {
  helpId?: string;
  errorId?: string;
  /** For aria-describedby; undefined when neither message renders. */
  describedBy?: string;
}

export function fieldMessageIds(id: string, help?: string, error?: string): FieldMessageIds {
  const helpId = help && !error ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return { helpId, errorId, describedBy };
}

export interface FieldMessagesProps {
  /** The same id given to fieldMessageIds. */
  id: string;
  help?: string;
  error?: string;
  className?: string;
  /**
   * Prefix the error with the warning glyph (default). SelectInput and
   * StateSelector have always shown a plain error line and pass false.
   */
  glyph?: boolean;
}

export function FieldMessages({ id, help, error, className, glyph = true }: FieldMessagesProps) {
  const { helpId, errorId } = fieldMessageIds(id, help, error);
  if (!helpId && !errorId) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {helpId && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {errorId &&
        (glyph ? (
          <p id={errorId} role="alert" className="flex items-start space-x-1 text-xs text-negative">
            <span className="font-bold" aria-hidden="true">
              {'\u26a0'}
            </span>
            <span>{error}</span>
          </p>
        ) : (
          <p id={errorId} role="alert" className="text-xs text-negative">
            {error}
          </p>
        ))}
    </div>
  );
}

export default FieldMessages;
