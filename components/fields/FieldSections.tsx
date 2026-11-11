'use client';

import React, { useState } from 'react';
import { screensFor, visibleScreenFields } from '@/lib/fields/runtime';
import type { ScreenSpec, Write } from '@/lib/fields/types';
import { FieldSection, screenHasError } from './FieldSection';
import type { FieldSectionsProps } from './types';

/**
 * Every screen of a form for the calculator page, one FieldSection each.
 *
 * Collapse by tier: a core screen starts collapsed once every visible field
 * on it is in `provided`, details start expanded, assumptions collapsed
 * (initiallyCollapsed replaces this rule). Until the visitor acts, the
 * defaults follow the props, so a core card folds once the profile has
 * hydrated. The first edit freezes every card as it is shown, so a card
 * never folds shut under someone filling it in; a toggle or an edit inside a
 * card pins that card. The state is component-local and never persisted.
 */
export function FieldSections({
  form,
  get,
  errors,
  onWrite,
  renderers,
  surface = 'calculator',
  provided,
  initiallyCollapsed,
  onRestoreDefaults,
}: FieldSectionsProps) {
  const [pinned, setPinned] = useState<Readonly<Record<string, boolean>>>({});
  const [frozen, setFrozen] = useState(false);
  const screens = screensFor(form, get, { mode: 'all', surface });
  const answered: ReadonlySet<string> = provided instanceof Set ? provided : new Set(provided ?? []);

  const startsCollapsed = (screen: ScreenSpec): boolean => {
    if (initiallyCollapsed) return initiallyCollapsed(screen);
    if (screen.tier === 'core') {
      return visibleScreenFields(form, screen, get).every((spec) => answered.has(spec.path));
    }
    return screen.tier === 'assumption';
  };
  const isCollapsed = (screen: ScreenSpec) => pinned[screen.id] ?? startsCollapsed(screen);
  const isShownCollapsed = (screen: ScreenSpec) => isCollapsed(screen) && !screenHasError(form, screen, get, errors);

  const handleWrite = (screen: ScreenSpec, writes: Write[]) => {
    const next: Record<string, boolean> = { ...pinned };
    if (!frozen) {
      for (const each of screens) next[each.id] ??= isShownCollapsed(each);
      setFrozen(true);
    }
    // The visitor is editing this card, so it is open and stays open.
    next[screen.id] = false;
    setPinned(next);
    onWrite(writes);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {screens.map((screen) => (
        <FieldSection
          key={screen.id}
          form={form}
          screen={screen}
          get={get}
          errors={errors}
          onWrite={(writes) => handleWrite(screen, writes)}
          renderers={renderers}
          collapsed={isCollapsed(screen)}
          onToggle={() => setPinned({ ...pinned, [screen.id]: !isShownCollapsed(screen) })}
          onRestoreDefaults={onRestoreDefaults ? () => onRestoreDefaults(screen) : undefined}
        />
      ))}
    </div>
  );
}

export default FieldSections;
