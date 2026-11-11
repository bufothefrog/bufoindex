import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FieldSection, FieldSections, defaultCollapsed } from '@/components/fields';
import { makeGet } from '@/lib/fields/paths';
import type { FieldSpec, FormSpec, ScreenSpec } from '@/lib/fields/types';
import { Harness } from './fixtures';

const FIELDS: readonly FieldSpec[] = [
  { path: 'person.age', kind: 'number', label: 'Age', tier: 'core', min: 16, max: 100 },
  { path: 'person.retirementAge', kind: 'number', label: 'Retirement age', tier: 'core' },
  { path: 'cash.balance', kind: 'money', label: 'Emergency fund', tier: 'details' },
  {
    path: 'cash.months',
    kind: 'number',
    label: 'Target months',
    tier: 'details',
    visibleWhen: (get) => Number(get('cash.balance')) > 0,
  },
  { path: 'assumptions.inflation', kind: 'percent', label: 'Inflation', tier: 'assumption' },
  { path: 'intake.only', kind: 'text', label: 'Intake only', tier: 'details' },
];

const SCREENS: readonly ScreenSpec[] = [
  { id: 'about', title: 'About you', tier: 'core', fields: ['person.age', 'person.retirementAge'] },
  {
    id: 'cash',
    title: 'Cash buffer',
    description: 'Money set aside for surprises.',
    tier: 'details',
    fields: ['cash.balance', 'cash.months'],
    notes: [
      { text: 'A buffer of zero means no cushion.', visibleWhen: (get) => get('cash.balance') === 0, tone: 'caution' },
      { text: (get) => `Months shown: ${String(get('cash.months'))}` },
    ],
  },
  { id: 'assumptions', title: 'Assumptions', tier: 'assumption', fields: ['assumptions.inflation'] },
  { id: 'intake', title: 'Intake screen', tier: 'details', surface: 'intake', fields: ['intake.only'] },
];

const FORM: FormSpec = { id: 'demo', fields: FIELDS, screens: SCREENS };

const VALUES = {
  person: { age: 30, retirementAge: 60 },
  cash: { balance: 5000, months: 3 },
  assumptions: { inflation: 0.025 },
  intake: { only: 'x' },
};

const screenById = (id: string) => SCREENS.find((s) => s.id === id) as ScreenSpec;

describe('FieldSection', () => {
  it('renders the title, description, visible fields and notes', () => {
    render(<FieldSection form={FORM} screen={screenById('cash')} get={makeGet(VALUES)} errors={{}} onWrite={() => {}} />);
    const section = screen.getByTestId('field-section-cash');
    expect(within(section).getByText('Cash buffer')).toBeInTheDocument();
    expect(within(section).getByText('Money set aside for surprises.')).toBeInTheDocument();
    expect(within(section).getByRole('textbox', { name: /Target months/ })).toBeInTheDocument();
    expect(within(section).queryByText('A buffer of zero means no cushion.')).not.toBeInTheDocument();
    expect(within(section).getByText('Months shown: 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore defaults/ })).not.toBeInTheDocument();
  });

  it('hides fields and notes by visibleWhen as values change', async () => {
    const user = userEvent.setup();
    render(
      <Harness initial={VALUES}>
        {({ get, onWrite }) => (
          <FieldSection form={FORM} screen={screenById('cash')} get={get} errors={{}} onWrite={onWrite} />
        )}
      </Harness>
    );
    await user.clear(screen.getByRole('textbox', { name: /Emergency fund/ }));
    expect(screen.queryByRole('textbox', { name: /Target months/ })).not.toBeInTheDocument();
    expect(screen.getByText('A buffer of zero means no cushion.')).toBeInTheDocument();
  });

  it('collapsed shows the summary and the Edit toggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <FieldSection
        form={FORM}
        screen={screenById('about')}
        get={makeGet(VALUES)}
        errors={{}}
        onWrite={() => {}}
        collapsed
        onToggle={onToggle}
      />
    );
    expect(screen.getByText('Age: 30 · Retirement age: 60')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Edit about you' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls') as string)).toBeInTheDocument();
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is forced open while a field on it has an error', () => {
    render(
      <FieldSection
        form={FORM}
        screen={screenById('about')}
        get={makeGet(VALUES)}
        errors={{ 'person.age': 'Enter a value between 16 and 100.', 'cash.balance': 'elsewhere' }}
        onWrite={() => {}}
        collapsed
        onToggle={() => {}}
      />
    );
    expect(screen.getByRole('textbox', { name: /^Age/ })).toHaveAccessibleDescription(
      expect.stringContaining('Enter a value between 16 and 100.')
    );
    expect(screen.getByRole('button', { name: 'Done about you' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('elsewhere')).not.toBeInTheDocument();
  });

  it('offers Restore defaults on assumption screens only', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const { unmount } = render(
      <FieldSection
        form={FORM}
        screen={screenById('assumptions')}
        get={makeGet(VALUES)}
        errors={{}}
        onWrite={() => {}}
        onRestoreDefaults={onRestore}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    unmount();
    render(
      <FieldSection form={FORM} screen={screenById('cash')} get={makeGet(VALUES)} errors={{}} onWrite={() => {}} onRestoreDefaults={onRestore} />
    );
    expect(screen.queryByRole('button', { name: 'Restore defaults' })).not.toBeInTheDocument();
  });

  it('size lg passes through to the fields', () => {
    render(<FieldSection form={FORM} screen={screenById('about')} get={makeGet(VALUES)} errors={{}} onWrite={() => {}} size="lg" />);
    expect(screen.getByRole('textbox', { name: /^Age/ }).className).toContain('h-14');
  });
});

describe('FieldSections', () => {
  it('renders every screen as one long form; assumptions start collapsed', async () => {
    const user = userEvent.setup();
    render(<FieldSections form={FORM} get={makeGet(VALUES)} errors={{}} onWrite={() => {}} />);
    expect(screen.getByTestId('field-section-about')).toBeInTheDocument();
    expect(screen.getByTestId('field-section-intake')).toBeInTheDocument();
    expect(screen.getByText('Inflation: 2.5%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit assumptions' }));
    expect(screen.getByRole('textbox', { name: /Inflation/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done assumptions' }));
    expect(screen.queryByRole('textbox', { name: /Inflation/ })).not.toBeInTheDocument();
  });

  it('filters by surface and honours initiallyCollapsed', () => {
    render(
      <FieldSections
        form={FORM}
        get={makeGet(VALUES)}
        errors={{}}
        onWrite={() => {}}
        surface="calculator"
        initiallyCollapsed={(s) => s.tier === 'core'}
      />
    );
    expect(screen.queryByTestId('field-section-intake')).not.toBeInTheDocument();
    expect(screen.getByText('Age: 30 · Retirement age: 60')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Inflation/ })).toBeInTheDocument();
  });

  it('follows initiallyCollapsed until the person toggles', async () => {
    const user = userEvent.setup();
    const props = { form: FORM, get: makeGet(VALUES), errors: {}, onWrite: () => {} };
    const { rerender } = render(<FieldSections {...props} initiallyCollapsed={() => false} />);
    expect(screen.getByRole('textbox', { name: /^Age/ })).toBeInTheDocument();
    rerender(<FieldSections {...props} initiallyCollapsed={(s) => s.tier === 'core'} />);
    expect(screen.queryByRole('textbox', { name: /^Age/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit about you' }));
    rerender(<FieldSections {...props} initiallyCollapsed={() => true} />);
    expect(screen.getByRole('textbox', { name: /^Age/ })).toBeInTheDocument();
  });

  it('collapsible false opens everything with no toggles; restore defaults is per screen', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <FieldSections form={FORM} get={makeGet(VALUES)} errors={{}} onWrite={() => {}} collapsible={false} onRestoreDefaults={onRestore} />
    );
    expect(screen.queryByRole('button', { name: /^(Edit|Done)/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Inflation/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(onRestore).toHaveBeenCalledWith(screenById('assumptions'));
  });

  it('the default collapse rule collapses assumption screens only', () => {
    expect(defaultCollapsed(screenById('assumptions'))).toBe(true);
    expect(defaultCollapsed(screenById('about'))).toBe(false);
  });
});
