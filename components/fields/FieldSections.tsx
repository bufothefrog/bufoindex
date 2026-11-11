'use client';

/**
 * FieldSections
 * Every screen of a FormSpec as a stack of FieldSections: the calculator's
 * whole input surface as one long form. Collapse state is component-local.
 * By default core and detail screens start open and assumption screens
 * start collapsed; `initiallyCollapsed` overrides that per screen (the
 * calculator page collapses the core screens once every core field is
 * provided). The initial choice follows its inputs until the person toggles
 * a section, so a value that changes after hydration still applies.
 */

import React, { useState } from 'react';
import { screensFor } from '@/lib/fields/runtime';
import type { FieldErrors, FormSpec, Get, ScreenSpec, Write } from '@/lib/fields/types';
import { FieldSection } from './FieldSection';
import type { CustomRenderers, FieldSize } from './types';

export interface FieldSectionsProps {
  form: FormSpec;
  get: Get;
  errors: FieldErrors;
  onWrite: (writes: Write[]) => void;
  renderers?: CustomRenderers;
  /** Keep only screens shown on this surface (intake-only screens are dropped). */
  surface?: 'calculator';
  initiallyCollapsed?: (screen: ScreenSpec) => boolean;
  onRestoreDefaults?: (screen: ScreenSpec) => void;
  /** False renders every section open with no toggles (default true). */
  collapsible?: boolean;
  size?: FieldSize;
  className?: string;
}

/** The default collapse rule: assumption screens start collapsed. */
export function defaultCollapsed(screen: ScreenSpec): boolean {
  return screen.tier === 'assumption';
}

export function FieldSections({
  form,
  get,
  errors,
  onWrite,
  renderers,
  surface,
  initiallyCollapsed,
  onRestoreDefaults,
  collapsible = true,
  size = 'md',
  className,
}: FieldSectionsProps) {
  // Only explicit toggles are stored; everything else is derived.
  const [overrides, setOverrides] = useState<Readonly<Record<string, boolean>>>({});
  const screens = screensFor(form, get, { surface });

  return (
    <div className={className ?? 'space-y-4 lg:space-y-6'}>
      {screens.map((screen) => {
        const collapsed = collapsible
          ? (overrides[screen.id] ?? (initiallyCollapsed ? initiallyCollapsed(screen) : defaultCollapsed(screen)))
          : false;
        return (
          <FieldSection
            key={screen.id}
            form={form}
            screen={screen}
            get={get}
            errors={errors}
            onWrite={onWrite}
            renderers={renderers}
            collapsed={collapsed}
            onToggle={
              collapsible ? () => setOverrides((prev) => ({ ...prev, [screen.id]: !collapsed })) : undefined
            }
            onRestoreDefaults={onRestoreDefaults ? () => onRestoreDefaults(screen) : undefined}
            size={size}
          />
        );
      })}
    </div>
  );
}

export default FieldSections;
