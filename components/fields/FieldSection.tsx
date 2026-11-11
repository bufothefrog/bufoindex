'use client';

import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileSearch, RotateCcw, SlidersHorizontal, User } from 'lucide-react';
import { InputCard } from '@/components/ui/cards';
import { Button } from '@/components/ui/button';
import { summarizeScreen, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldErrors, FieldKind, FieldSpec, FormSpec, Get, ScreenSpec, Tier } from '@/lib/fields/types';
import { cn } from '@/lib/utils';
import { FieldInput } from './FieldInput';
import { ScreenNotes } from './ScreenNotes';
import { SectionToggle } from './SectionToggle';
import type { FieldSectionProps } from './types';

const TIER_ICON: Record<Tier, LucideIcon> = {
  core: User,
  details: FileSearch,
  assumption: SlidersHorizontal,
};

const TIER_TOGGLE: Record<Tier, { expand: string; collapse: string; icon: 'edit' | 'chevron' }> = {
  core: { expand: 'Edit', collapse: 'Done', icon: 'edit' },
  details: { expand: 'Show', collapse: 'Hide', icon: 'chevron' },
  assumption: { expand: 'Show', collapse: 'Hide', icon: 'chevron' },
};

/** Kinds that take the full width of the two-column field grid. */
const WIDE_KINDS: ReadonlySet<FieldKind> = new Set(['choice', 'list', 'custom']);

const CARD_HEADER_CLASS = 'p-4 pb-2 sm:p-6 sm:pb-4';
const CARD_CONTENT_CLASS = 'p-4 pt-0 sm:p-6 sm:pt-0';

function hasErrorUnder(errors: FieldErrors, path: string): boolean {
  const prefix = `${path}.`;
  return Object.keys(errors).some((key) => key === path || key.startsWith(prefix));
}

function fieldHasError(spec: FieldSpec, errors: FieldErrors): boolean {
  return [spec.path, ...(spec.covers ?? [])].some((path) => hasErrorUnder(errors, path));
}

/**
 * True when a visible field on the screen has an error: its own path, a row
 * of a list ('debts.0.balance'), or a path a custom field covers.
 */
export function screenHasError(form: FormSpec, screen: ScreenSpec, get: Get, errors: FieldErrors): boolean {
  return visibleScreenFields(form, screen, get).some((spec) => fieldHasError(spec, errors));
}

/**
 * One topic screen as an input card: its visible fields, its notes, and a
 * one-line summary while collapsed. A field error forces it open, so a
 * collapsed card never hides an error; while it does, the toggle is
 * disabled, since hiding the card would have no effect.
 */
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
}: FieldSectionProps) {
  const bodyId = useId();
  const fields = visibleScreenFields(form, screen, get);
  const hasError = fields.some((spec) => fieldHasError(spec, errors));
  const open = !collapsed || hasError;
  const toggle = TIER_TOGGLE[screen.tier];
  const canRestore = screen.tier === 'assumption' && onRestoreDefaults !== undefined;
  const sectionName = screen.title.toLowerCase();

  // The controls share one wrapping row (a named group) rather than sit
  // straight in the card header, so on a phone the toggle moves under
  // Restore defaults instead of pushing the header past the card; on wider
  // screens they stay on one line.
  const actions =
    canRestore || onToggle ? (
      <div role="group" aria-label={`Controls for ${sectionName}`} className="flex flex-wrap items-center justify-end gap-2">
        {canRestore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestoreDefaults}
            aria-label={`Restore defaults for ${sectionName}`}
            className="min-h-11 shrink-0 px-3 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Restore defaults
          </Button>
        )}
        {onToggle && (
          <SectionToggle
            expanded={open}
            onToggle={onToggle}
            controls={bodyId}
            expandLabel={toggle.expand}
            collapseLabel={toggle.collapse}
            expandIcon={toggle.icon}
            sectionName={sectionName}
            disabled={hasError}
          />
        )}
      </div>
    ) : undefined;

  return (
    <section aria-label={screen.title}>
      <InputCard
        title={screen.title}
        icon={TIER_ICON[screen.tier]}
        headerClassName={CARD_HEADER_CLASS}
        contentClassName={CARD_CONTENT_CLASS}
        actions={actions}
      >
        <div id={bodyId}>
          {open ? (
            <div className="space-y-6">
              {screen.description && <p className="text-sm text-muted-foreground">{screen.description}</p>}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {fields.map((spec) => (
                  <div key={spec.path} className={cn('min-w-0', WIDE_KINDS.has(spec.kind) && 'md:col-span-2')}>
                    <FieldInput
                      spec={spec}
                      get={get}
                      onWrite={onWrite}
                      error={errors[spec.path]}
                      errors={errors}
                      renderers={renderers}
                    />
                  </div>
                ))}
              </div>
              <ScreenNotes screen={screen} get={get} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {summarizeScreen(form, screen, get) || screen.description}
            </p>
          )}
        </div>
      </InputCard>
    </section>
  );
}

export default FieldSection;
