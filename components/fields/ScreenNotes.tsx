'use client';

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { visibleScreenNotes } from '@/lib/fields/runtime';
import type { Get, ScreenSpec } from '@/lib/fields/types';

const NOTE_ICON = { info: Info, caution: AlertTriangle } as const;

export interface ScreenNotesProps {
  screen: ScreenSpec;
  get: Get;
}

/**
 * A screen's visible notes, one tinted alert each. The calculator card
 * (FieldSection) and the intake wizard both render notes through this, so a
 * ScreenNote looks the same on both surfaces.
 */
export function ScreenNotes({ screen, get }: ScreenNotesProps) {
  return (
    <>
      {visibleScreenNotes(screen, get).map((note) => (
        <StatusAlert key={note.text} tone={note.tone} appearance="tinted" icon={NOTE_ICON[note.tone]}>
          {note.text}
        </StatusAlert>
      ))}
    </>
  );
}

export default ScreenNotes;
