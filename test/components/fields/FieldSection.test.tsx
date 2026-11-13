/**
 * FieldSection renders one topic screen as an input card (fields, notes,
 * a one-line summary while collapsed, forced open on an error, "Restore
 * defaults" on assumption screens). FieldSections renders a whole form for
 * the calculator page and collapses by tier, with component-local state.
 */

import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FieldSection, FieldSections } from '@/components/fields';
import { FORMS } from '@/lib/calculators/forms';
import { CORE_SCREENS } from '@/lib/fields/shared';
import { getDefaultFinancialProfile, getProfileValue } from '@/lib/profile/defaults';
import type { FieldSectionsProps } from '@/components/fields';
import type { FieldErrors, FieldSpec, FormSpec, ScreenSpec } from '@/lib/fields/types';
import { FieldHarness, writeSpy } from './harness';

const money = (value: unknown) => `$${Number(value).toLocaleString('en-US')}`;

const FIELDS: readonly FieldSpec[] = [
  { path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 16, max: 100, summary: (v) => `age ${String(v)}` },
  { path: 'income.gross', kind: 'money', label: 'Gross pay', tier: 'core', summary: (v) => `${money(v)} per paycheck` },
  {
    path: 'hsa.eligible',
    kind: 'boolean',
    label: 'I can use an HSA',
    tier: 'details',
    summary: (v) => (v ? 'HSA eligible' : null),
  },
  {
    path: 'hsa.monthly',
    kind: 'money',
    label: 'HSA contribution',
    tier: 'details',
    visibleWhen: (get) => get('hsa.eligible') === true,
    summary: (v) => `${money(v)}/mo to the HSA`,
  },
  { path: 'assumptions.inflation', kind: 'percent', label: 'Inflation', tier: 'assumption', summary: (v) => `${Number(v) * 100}% inflation` },
  { path: 'intake.only', kind: 'text', label: 'Intake only', tier: 'details' },
];

const SCREENS: Record<string, ScreenSpec> = {
  about: { id: 'about', title: 'About you', tier: 'core', fields: ['person.age', 'income.gross'] },
  hsa: {
    id: 'hsa',
    title: 'Health savings',
    tier: 'details',
    description: 'Only if your plan qualifies.',
    fields: ['hsa.eligible', 'hsa.monthly'],
    notes: [
      { text: 'An HSA is triple tax-advantaged.', visibleWhen: (get) => get('hsa.eligible') === true },
      { text: (get) => (get('hsa.monthly') ? 'Check the annual limit.' : undefined), tone: 'caution' },
    ],
  },
  assumptions: { id: 'assumptions', title: 'Assumptions', tier: 'assumption', fields: ['assumptions.inflation'] },
  intake: { id: 'intake', title: 'Intake screen', tier: 'details', surface: 'intake', fields: ['intake.only'] },
};

const FORM: FormSpec = { id: 'test', fields: FIELDS, screens: Object.values(SCREENS) };

const VALUES = {
  person: { age: 30 },
  income: { gross: 3500 },
  hsa: { eligible: true, monthly: 200 },
  assumptions: { inflation: 0.03 },
  intake: { only: '' },
};

function renderSection(screenSpec: ScreenSpec, errors: FieldErrors = {}, startCollapsed = false, onRestoreDefaults?: () => void) {
  const onWrite = writeSpy();
  function Host() {
    const [collapsed, setCollapsed] = useState(startCollapsed);
    return (
      <FieldHarness initial={VALUES} onWrite={onWrite}>
        {({ get, onWrite: write }) => (
          <FieldSection
            form={FORM}
            screen={screenSpec}
            get={get}
            errors={errors}
            onWrite={write}
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            onRestoreDefaults={onRestoreDefaults}
          />
        )}
      </FieldHarness>
    );
  }
  render(<Host />);
  return onWrite;
}

describe('FieldSection', () => {
  it('is a region named by the screen title with its visible fields, description and notes', () => {
    renderSection(SCREENS.hsa);
    const region = screen.getByRole('region', { name: 'Health savings' });
    expect(within(region).getByRole('heading', { name: 'Health savings' })).toBeInTheDocument();
    expect(within(region).getByText('Only if your plan qualifies.')).toBeInTheDocument();
    expect(within(region).getByRole('checkbox', { name: 'I can use an HSA' })).toBeChecked();
    expect(within(region).getByRole('textbox', { name: 'HSA contribution' })).toHaveValue('200');
    expect(within(region).getByText('An HSA is triple tax-advantaged.')).toBeInTheDocument();
    expect(within(region).getByText('Check the annual limit.')).toBeInTheDocument();
  });

  it('hides a field and its note when visibleWhen turns false', async () => {
    const user = userEvent.setup();
    renderSection(SCREENS.hsa);
    await user.click(screen.getByRole('checkbox', { name: 'I can use an HSA' }));
    expect(screen.queryByRole('textbox', { name: 'HSA contribution' })).not.toBeInTheDocument();
    expect(screen.queryByText('An HSA is triple tax-advantaged.')).not.toBeInTheDocument();
  });

  it('shows the summary while collapsed and toggles with a button that keeps focus', async () => {
    const user = userEvent.setup();
    renderSection(SCREENS.about, {}, true);
    expect(screen.getByText('age 30, $3,500 per paycheck')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Age' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Edit about you' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('textbox', { name: 'Age' })).toBeInTheDocument();
    const done = screen.getByRole('button', { name: 'Done about you' });
    expect(done).toHaveAttribute('aria-expanded', 'true');
    expect(done).toHaveFocus();
    expect(document.getElementById(done.getAttribute('aria-controls') ?? '')).toContainElement(
      screen.getByRole('textbox', { name: 'Age' })
    );
  });

  it('words the saved values as "label: value", not the description, when no own summary gives a fragment', () => {
    render(
      <FieldHarness initial={{ ...VALUES, hsa: { eligible: false, monthly: 0 } }}>
        {({ get, onWrite }) => (
          <FieldSection form={FORM} screen={SCREENS.hsa} get={get} errors={{}} onWrite={onWrite} collapsed />
        )}
      </FieldHarness>
    );
    const region = screen.getByRole('region', { name: 'Health savings' });
    expect(within(region).getByText('I can use an HSA: No')).toBeInTheDocument();
    expect(within(region).queryByText('Only if your plan qualifies.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /health savings/ })).not.toBeInTheDocument();
  });

  it('falls back to the description only while no field on it holds a value', () => {
    const empty: ScreenSpec = { ...SCREENS.intake, description: 'Nothing saved here yet.' };
    render(
      <FieldHarness initial={VALUES}>
        {({ get, onWrite }) => <FieldSection form={FORM} screen={empty} get={get} errors={{}} onWrite={onWrite} collapsed />}
      </FieldHarness>
    );
    expect(screen.getByText('Nothing saved here yet.')).toBeInTheDocument();
  });

  it('shows "Not answered yet" while collapsed when there is neither a summary nor a description', () => {
    render(
      <FieldHarness initial={VALUES}>
        {({ get, onWrite }) => (
          <FieldSection form={FORM} screen={SCREENS.intake} get={get} errors={{}} onWrite={onWrite} collapsed />
        )}
      </FieldHarness>
    );
    const region = screen.getByRole('region', { name: 'Intake screen' });
    expect(within(region).getByText(/./, { selector: 'p' })).toHaveTextContent(/^Not answered yet$/);
  });

  it('shows "Not answered yet" instead of the values when summaries are turned off and there is no description', () => {
    render(
      <FieldHarness initial={VALUES}>
        {({ get, onWrite }) => (
          <FieldSection form={FORM} screen={SCREENS.about} get={get} errors={{}} onWrite={onWrite} collapsed summarize={false} />
        )}
      </FieldHarness>
    );
    const region = screen.getByRole('region', { name: 'About you' });
    expect(within(region).getByText('Not answered yet')).toBeInTheDocument();
    expect(within(region).queryByText('age 30, $3,500 per paycheck')).not.toBeInTheDocument();
  });

  it('shows the core cards of a calculator as compact values while collapsed', () => {
    const form = FORMS.paycheck;
    render(
      <>
        {CORE_SCREENS.map((core) => (
          <FieldSection
            key={core.id}
            form={form}
            screen={form.screens.find((each) => each.id === core.id)!}
            get={(path) => getProfileValue(getDefaultFinancialProfile(), path)}
            errors={{}}
            onWrite={() => {}}
            collapsed
            onToggle={() => {}}
          />
        ))}
      </>
    );
    const line = (title: string) => within(screen.getByRole('region', { name: title })).getByText(/./, { selector: 'p' });
    expect(line('A little about you')).toHaveTextContent(/^25, CA, single$/);
    expect(line('What does a typical paycheck look like?')).toHaveTextContent(
      /^\$4,000 gross every 2 weeks, \$2,550 take-home$/
    );
    expect(line('What do you have to pay each month?')).toHaveTextContent(/^\$3,000 a month$/);
    expect(screen.queryByText(/Age sets the time horizon/)).not.toBeInTheDocument();
    expect(screen.queryByText('A close guess is fine.')).not.toBeInTheDocument();
  });

  it('is forced open while a field on it has an error, and shows that error', () => {
    renderSection(SCREENS.about, { 'person.age': 'Age must be between 16 and 100.' }, true);
    expect(screen.getByRole('textbox', { name: 'Age' })).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Age must be between 16 and 100.');
    expect(screen.getByRole('button', { name: 'Done about you' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('disables the toggle while an error holds the card open, since hiding it would do nothing', () => {
    renderSection(SCREENS.about, { 'person.age': 'Age must be between 16 and 100.' }, true);
    expect(screen.getByRole('button', { name: 'Done about you' })).toBeDisabled();
  });

  it('ignores errors of fields that are not on it', () => {
    renderSection(SCREENS.about, { 'hsa.monthly': 'Too much.' }, true);
    expect(screen.queryByRole('textbox', { name: 'Age' })).not.toBeInTheDocument();
  });

  it('offers Restore defaults on an assumption screen only', async () => {
    const user = userEvent.setup();
    const restore = vi.fn();
    renderSection(SCREENS.assumptions, {}, true, restore);
    expect(screen.getByText('3% inflation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore defaults for assumptions' }));
    expect(restore).toHaveBeenCalledTimes(1);
    cleanup();

    renderSection(SCREENS.hsa, {}, false, restore);
    expect(screen.queryByRole('button', { name: /Restore defaults/ })).not.toBeInTheDocument();
  });

  it('keeps both header controls, named, in one row of their own beside a long title', () => {
    // A phone can only fit them by wrapping (checked in a browser; jsdom has
    // no layout). What jsdom can check is the structure the wrapping relies
    // on: neither control is dropped, and both sit in one group of their own
    // that holds nothing else and not the heading, rather than straight in
    // the card header next to the title.
    const long: ScreenSpec = {
      ...SCREENS.assumptions,
      title: 'Market, inflation, healthcare and tax assumptions for the whole plan',
    };
    renderSection(long, {}, true, vi.fn());
    const region = screen.getByRole('region', { name: long.title });
    const heading = within(region).getByRole('heading', { name: long.title });
    const restore = within(region).getByRole('button', { name: `Restore defaults for ${long.title.toLowerCase()}` });
    const toggle = within(region).getByRole('button', { name: `Show ${long.title.toLowerCase()}` });
    expect(restore).toHaveTextContent('Restore defaults');
    expect(toggle).toHaveTextContent('Show');

    const row = within(region).getByRole('group', { name: `Controls for ${long.title.toLowerCase()}` });
    expect(restore.parentElement).toBe(row);
    expect(toggle.parentElement).toBe(row);
    expect([...row.children]).toEqual([restore, toggle]);
    expect(row).not.toContainElement(heading);
  });

  it('passes field writes through', () => {
    const onWrite = renderSection(SCREENS.about);
    fireEvent.change(screen.getByRole('textbox', { name: 'Gross pay' }), { target: { value: '4000' } });
    expect(onWrite).toHaveBeenLastCalledWith([{ path: 'income.gross', value: 4000 }]);
  });
});

function renderSections(props: Partial<FieldSectionsProps> = {}, errors: FieldErrors = {}) {
  const onWrite = writeSpy();
  const view = render(
    <FieldHarness initial={VALUES} onWrite={onWrite}>
      {({ get, onWrite: write }) => (
        <FieldSections form={FORM} get={get} errors={errors} onWrite={write} {...props} />
      )}
    </FieldHarness>
  );
  return { onWrite, view };
}

const expanded = (name: RegExp) => screen.getByRole('button', { name }).getAttribute('aria-expanded') === 'true';

describe('FieldSections', () => {
  it('shows the calculator-surface screens in form order', () => {
    renderSections();
    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
      'About you',
      'Health savings',
      'Assumptions',
    ]);
  });

  it('collapses by tier: core expanded until provided, details expanded, assumptions collapsed', () => {
    renderSections();
    expect(expanded(/about you$/)).toBe(true);
    expect(expanded(/health savings$/)).toBe(true);
    expect(expanded(/assumptions$/)).toBe(false);
  });

  it('collapses a core screen once every visible field on it is provided', () => {
    renderSections({ provided: ['person.age', 'income.gross'] });
    expect(expanded(/about you$/)).toBe(false);
    expect(screen.getByText('age 30, $3,500 per paycheck')).toBeInTheDocument();
    cleanup();

    renderSections({ provided: new Set(['person.age']) });
    expect(expanded(/about you$/)).toBe(true);
  });

  it('follows provided until the visitor acts (the profile hydrates after the first render)', () => {
    const onWrite = writeSpy();
    const ui = (provided: string[]) => (
      <FieldHarness initial={VALUES} onWrite={onWrite}>
        {({ get, onWrite: write }) => (
          <FieldSections form={FORM} get={get} errors={{}} onWrite={write} provided={provided} />
        )}
      </FieldHarness>
    );
    const { rerender } = render(ui([]));
    expect(expanded(/about you$/)).toBe(true);
    rerender(ui(['person.age', 'income.gross']));
    expect(expanded(/about you$/)).toBe(false);
  });

  it('never folds a card shut under someone filling it in', () => {
    const onWrite = writeSpy();
    const ui = (provided: string[]) => (
      <FieldHarness initial={VALUES} onWrite={onWrite}>
        {({ get, onWrite: write }) => (
          <FieldSections form={FORM} get={get} errors={{}} onWrite={write} provided={provided} />
        )}
      </FieldHarness>
    );
    const { rerender } = render(ui(['person.age']));
    const gross = screen.getByRole('textbox', { name: 'Gross pay' });
    gross.focus();
    fireEvent.change(gross, { target: { value: '4000' } });
    rerender(ui(['person.age', 'income.gross']));
    expect(expanded(/about you$/)).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Gross pay' })).toHaveFocus();
    // The other cards keep the state they had at the first edit.
    expect(expanded(/assumptions$/)).toBe(false);
  });

  it('keeps toggles local to each card', async () => {
    const user = userEvent.setup();
    renderSections();
    await user.click(screen.getByRole('button', { name: 'Show assumptions' }));
    expect(screen.getByRole('textbox', { name: 'Inflation' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide health savings' }));
    expect(screen.queryByRole('checkbox', { name: 'I can use an HSA' })).not.toBeInTheDocument();
    expect(screen.getByText('HSA eligible, $200/mo to the HSA')).toBeInTheDocument();
    expect(expanded(/about you$/)).toBe(true);
  });

  it('opens a collapsed card that has an error', () => {
    renderSections({}, { 'assumptions.inflation': 'Inflation must be at most 10%.' });
    expect(expanded(/assumptions$/)).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('Inflation must be at most 10%.');
  });

  it('keeps a card that an error held open open after the first edit, once the error clears', async () => {
    const user = userEvent.setup();
    const ui = (errors: FieldErrors) => (
      <FieldHarness initial={VALUES}>
        {({ get, onWrite: write }) => (
          <FieldSections form={FORM} get={get} errors={errors} onWrite={write} initiallyCollapsed={() => true} />
        )}
      </FieldHarness>
    );
    const { rerender } = render(ui({ 'assumptions.inflation': 'Inflation must be at most 10%.' }));
    expect(expanded(/assumptions$/)).toBe(true);

    // An edit in another card freezes every card as it is shown.
    await user.click(screen.getByRole('button', { name: /about you$/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Gross pay' }), { target: { value: '4000' } });
    rerender(ui({}));

    expect(expanded(/assumptions$/)).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Inflation' })).toBeInTheDocument();
    expect(expanded(/health savings$/)).toBe(false);
  });

  it('uses initiallyCollapsed in place of the tier rule', () => {
    renderSections({ initiallyCollapsed: (s) => s.id === 'hsa' });
    expect(expanded(/about you$/)).toBe(true);
    expect(expanded(/health savings$/)).toBe(false);
    expect(expanded(/assumptions$/)).toBe(true);
  });

  it('passes the screen to onRestoreDefaults', async () => {
    const user = userEvent.setup();
    const restore = vi.fn();
    renderSections({ onRestoreDefaults: restore });
    expect(screen.getAllByRole('button', { name: /Restore defaults/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Restore defaults for assumptions' }));
    expect(restore).toHaveBeenCalledWith(SCREENS.assumptions);
  });
});
