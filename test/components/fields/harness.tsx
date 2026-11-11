/**
 * A stateful host for the field renderers: it keeps plain values, hands the
 * renderer a Get over them, applies every onWrite batch with applyWrites
 * (as the wizard's working copy does) and records each batch, so a test can
 * assert both what was written and what the visitor sees next.
 */

import React, { useState } from 'react';
import { vi } from 'vitest';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import type { FieldErrors, Get, Write } from '@/lib/fields/types';

export interface HarnessRenderArgs {
  get: Get;
  onWrite: (writes: Write[]) => void;
  errors: FieldErrors;
  values: Record<string, unknown>;
}

export interface FieldHarnessProps {
  initial: Record<string, unknown>;
  errors?: FieldErrors;
  onWrite?: (writes: Write[]) => void;
  children: (args: HarnessRenderArgs) => React.ReactNode;
}

export function FieldHarness({ initial, errors = {}, onWrite, children }: FieldHarnessProps) {
  const [values, setValues] = useState(initial);
  const handleWrite = (writes: Write[]) => {
    onWrite?.(writes);
    setValues((current) => applyWrites(current, writes));
  };
  return <>{children({ get: makeGet(values), onWrite: handleWrite, errors, values })}</>;
}

/** A spy for onWrite batches, typed for the renderers. */
export function writeSpy() {
  return vi.fn<(writes: Write[]) => void>();
}

/** Radix Slider measures its thumb with ResizeObserver, which jsdom lacks. */
export class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
