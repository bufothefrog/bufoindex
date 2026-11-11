'use client';

/**
 * FieldSection
 * One topic screen of a FormSpec as a calculator card: the screen title and
 * description, its visible fields, its notes, an optional collapse toggle
 * (the collapsed body is the screen's one-line summary) and, on assumption
 * screens, "Restore defaults". A section with an error on one of its fields
 * is forced open so the error is never hidden.
 */

import React, { useId } from 'react';
import { ChevronDown, ChevronUp, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { resolveText, screenErrors, summarizeScreen, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldErrors, FieldSpec, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { cn } from '@/lib/utils';
import { FieldInput } from './FieldInput';
import type { CustomRenderers, FieldSize } from './types';

export interface SectionToggleProps {
  expanded: boolean;
  onToggle: () => void;
  /** Id of the element the toggle shows and hides. */
  controls: string;
  /** Lower-case section name for the accessible label ("quick answers"). */
  sectionName: string;
  expandLabel?: string;
  collapseLabel?: string;
  expandIcon?: 'edit' | 'chevron';
}

/** The Edit / Done toggle of a collapsible input card (44px tap target). */
export function SectionToggle({
  expanded,
  onToggle,
  controls,
  sectionName,
  expandLabel = 'Edit',
  collapseLabel = 'Done',
  expandIcon = 'chevron',
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

export interface FieldSectionProps {
  form: FormSpec;
  screen: ScreenSpec;
  get: Get;
  errors: FieldErrors;
  onWrite: (writes: Write[]) => void;
  renderers?: CustomRenderers;
  /** Collapsed to its summary (ignored while a field on the screen has an error). */
  collapsed?: boolean;
  /** Shows the Edit / Done toggle when given. */
  onToggle?: () => void;
  /** Shows "Restore defaults" on assumption screens when given. */
  onRestoreDefaults?: () => void;
  size?: FieldSize;
}

/** Fields that need the full row width in the two-column grid. */
function isWide(spec: FieldSpec): boolean {
  return (
    spec.kind === 'list' ||
    spec.kind === 'custom' ||
    spec.kind === 'choice' ||
    spec.kind === 'slider' ||
    (spec.kind === 'percent' && spec.slider === true) ||
    spec.nullable !== undefined
  );
}

const CARD_HEADER_CLASS = 'p-4 pb-2 sm:p-6 sm:pb-4';
const CARD_CONTENT_CLASS = 'p-4 pt-0 sm:p-6 sm:pt-0';

export function FieldSection({
  form,
  screen,
  get,
  errors,
  onWrite,
  renderers,
  collapsed = false,
  onToggle,
  onRestoreDefaults,
  size = 'md',
}: FieldSectionProps) {
  const bodyId = useId();
  const fields = visibleScreenFields(form, screen, get);
  const hasError = Object.keys(screenErrors(form, screen, get, errors)).length > 0;
  const isCollapsed = collapsed && !hasError;
  const notes = (screen.notes ?? []).filter((note) => !note.visibleWhen || note.visibleWhen(get));
  const showRestore = screen.tier === 'assumption' && onRestoreDefaults !== undefined;
  const sectionName = screen.title.toLowerCase();

  return (
    <InputCard
      title={screen.title}
      headerClassName={CARD_HEADER_CLASS}
      contentClassName={CARD_CONTENT_CLASS}
      testId={`field-section-${screen.id}`}
      actions={
        onToggle ? (
          <SectionToggle
            expanded={!isCollapsed}
            onToggle={onToggle}
            controls={bodyId}
            sectionName={sectionName}
            expandIcon={screen.tier === 'core' ? 'edit' : 'chevron'}
          />
        ) : undefined
      }
    >
      <div id={bodyId} data-collapsed={isCollapsed}>
        {isCollapsed ? (
          <p className="text-sm text-muted-foreground">{summarizeScreen(form, screen, get)}</p>
        ) : (
          <div className="space-y-4">
            {screen.description && <p className="text-sm text-muted-foreground">{screen.description}</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              {fields.map((spec) => (
                <div key={spec.path} className={cn(isWide(spec) && 'md:col-span-2')}>
                  <FieldInput
                    spec={spec}
                    get={get}
                    onWrite={onWrite}
                    error={errors[spec.path]}
                    errors={errors}
                    size={size}
                    renderers={renderers}
                    idPrefix={form.id}
                  />
                </div>
              ))}
            </div>
            {notes.map((note, index) => {
              const text = resolveText(note.text, get);
              if (!text) return null;
              return (
                <StatusAlert key={index} tone={note.tone ?? 'info'}>
                  {text}
                </StatusAlert>
              );
            })}
            {showRestore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRestoreDefaults}
                className="min-h-11"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Restore defaults
              </Button>
            )}
          </div>
        )}
      </div>
    </InputCard>
  );
}

export default FieldSection;
