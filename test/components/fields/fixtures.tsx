/**
 * Shared fixtures for the field renderer tests: a form that exercises every
 * field kind, and a stateful harness that applies writes to local values.
 */

import React, { useState } from 'react';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import type { FieldErrors, FieldSpec, FormSpec, Write } from '@/lib/fields/types';
import type { CustomRenderers } from '@/components/fields';

export const FILING_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'marriedJoint', label: 'Married filing jointly', description: 'One return for both' },
  { value: 'headOfHousehold', label: 'Head of household' },
] as const;

export const DEBT_ROW: readonly FieldSpec[] = [
  { path: 'name', kind: 'text', label: 'Name', tier: 'details', testId: 'debt-name-{i}' },
  { path: 'balance', kind: 'money', label: 'Balance', tier: 'details', min: 0 },
];

export const KIND_FIELDS: readonly FieldSpec[] = [
  { path: 'income.gross', kind: 'money', label: 'Gross pay', tier: 'core', help: 'Before taxes', hint: 'Look at your pay stub' },
  { path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 16, max: 100, help: 'Your age today' },
  { path: 'cash.apy', kind: 'percent', label: 'Savings APY', tier: 'details', help: 'Annual yield', max: 0.2 },
  {
    path: 'assumptions.multiplier',
    kind: 'slider',
    label: 'Healthcare multiplier',
    tier: 'assumption',
    min: 0.5,
    max: 3,
    step: 0.1,
    precision: 1,
    unit: { suffix: 'x' },
    help: 'Relative to the average cost',
  },
  {
    path: 'income.frequency',
    kind: 'select',
    label: 'Pay frequency',
    tier: 'core',
    help: 'How often you are paid',
    options: [
      { value: 'weekly', label: 'Weekly' },
      { value: 'bi-weekly', label: 'Every two weeks' },
    ],
  },
  { path: 'person.filingStatus', kind: 'choice', label: 'Filing status', tier: 'core', help: 'From your last return', options: FILING_OPTIONS },
  { path: 'workplace.has401k', kind: 'boolean', label: 'My employer offers a 401(k)', tier: 'details', help: 'Check your benefits portal' },
  { path: 'person.state', kind: 'state', label: 'State', tier: 'core', help: 'Where you file' },
  { path: 'person.nickname', kind: 'text', label: 'Nickname', tier: 'details', help: 'Optional', maxLength: 20 },
  {
    path: 'debts',
    kind: 'list',
    label: 'Debts',
    tier: 'details',
    row: DEBT_ROW,
    addLabel: 'Add a debt',
    emptyText: 'No debts yet.',
    newRow: () => ({ id: 'new', name: '', balance: 0 }),
  },
  { path: 'portfolio.holdings', kind: 'custom', label: 'Holdings', tier: 'details', renderer: 'holdings' },
];

export const KINDS_FORM: FormSpec = {
  id: 'kinds',
  fields: KIND_FIELDS,
  screens: [{ id: 'all', title: 'Everything', tier: 'details', fields: KIND_FIELDS.map((spec) => spec.path) }],
};

export const KIND_VALUES = {
  income: { gross: 3500, frequency: 'bi-weekly' },
  person: { age: 30, filingStatus: 'single', state: 'TX', nickname: 'Bufo' },
  cash: { apy: 0.04 },
  assumptions: { multiplier: 1 },
  workplace: { has401k: true },
  debts: [{ id: 'd1', name: 'Card', balance: 1200 }],
  portfolio: { holdings: ['VTI'] },
};

export const TEST_RENDERERS: CustomRenderers = {
  holdings: ({ value, onWrite, spec }) => (
    <div>
      <p>Custom holdings: {Array.isArray(value) ? value.join(', ') : ''}</p>
      <button type="button" onClick={() => onWrite([{ path: spec.path, value: ['VTI', 'BND'] }])}>
        Add BND
      </button>
    </div>
  ),
};

export interface HarnessRenderArgs {
  values: Record<string, unknown>;
  get: (path: string) => unknown;
  onWrite: (writes: Write[]) => void;
  errors: FieldErrors;
}

export interface HarnessProps {
  initial: Record<string, unknown>;
  errors?: FieldErrors;
  onWrites?: (writes: Write[]) => void;
  children: (args: HarnessRenderArgs) => React.ReactNode;
}

/** Holds values in state; every write is recorded and applied. */
export function Harness({ initial, errors = {}, onWrites, children }: HarnessProps) {
  const [values, setValues] = useState(initial);
  const onWrite = (writes: Write[]) => {
    onWrites?.(writes);
    setValues((prev) => applyWrites(prev, writes));
  };
  return <>{children({ values, get: makeGet(values), onWrite, errors })}</>;
}
