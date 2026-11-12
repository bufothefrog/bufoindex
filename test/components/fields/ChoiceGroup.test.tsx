/**
 * ChoiceGroup keeps the intake wizard's keyboard model: Tab enters on the
 * selected option, the arrow keys (and Home / End) move and select, Space
 * selects, and Enter selects and advances through onChooseAndAdvance.
 */

import React, { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChoiceGroup } from '@/components/fields';
import type { ChoiceGroupProps } from '@/components/fields';
import type { FieldOption } from '@/lib/fields/types';

const OPTIONS: readonly FieldOption[] = [
  { value: 'single', label: 'Single' },
  { value: 'marriedJoint', label: 'Married filing jointly', description: 'One return for both' },
  { value: 'headOfHousehold', label: 'Head of household' },
];

function Harness({
  initial,
  onChange,
  ...rest
}: { initial?: FieldOption['value'] } & Partial<Omit<ChoiceGroupProps, 'value'>>) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <ChoiceGroup
      label="Filing status"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...rest}
    />
  );
}

describe('ChoiceGroup', () => {
  it('is a radiogroup named by its label, with one radio per option', () => {
    render(<Harness initial="single" help="As on your last return" />);
    const group = screen.getByRole('radiogroup', { name: 'Filing status' });
    expect(group).toHaveAccessibleDescription('As on your last return');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
    expect(screen.getByText('One return for both')).toBeInTheDocument();
  });

  it('puts only the selected option in the tab order, or the first when none is selected', async () => {
    const user = userEvent.setup();
    render(<Harness initial="marriedJoint" />);
    await user.tab();
    expect(screen.getByRole('radio', { name: /Married filing jointly/ })).toHaveFocus();
    cleanup();

    render(<Harness />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveFocus();
    expect(screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('moves and selects with the arrow keys, wrapping, and with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="single" onChange={onChange} />);
    await user.tab();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Married filing jointly/ })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Married filing jointly/ })).toBeChecked();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Single' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Head of household' })).toBeChecked();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Single' })).toBeChecked();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Head of household' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /Married filing jointly/ })).toBeChecked();

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      'marriedJoint',
      'headOfHousehold',
      'single',
      'headOfHousehold',
      'single',
      'headOfHousehold',
      'marriedJoint',
    ]);
  });

  it('selects the focused option with Space', async () => {
    const user = userEvent.setup();
    render(<Harness initial="single" />);
    screen.getByRole('radio', { name: 'Head of household' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Head of household' })).toBeChecked();
  });

  it('selects and advances in one step with Enter, passing the value along', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onChooseAndAdvance = vi.fn();
    render(<Harness initial="single" onChange={onChange} onChooseAndAdvance={onChooseAndAdvance} />);
    screen.getByRole('radio', { name: /Married filing jointly/ }).focus();
    await user.keyboard('{Enter}');
    expect(onChooseAndAdvance).toHaveBeenCalledTimes(1);
    expect(onChooseAndAdvance).toHaveBeenCalledWith('marriedJoint');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('only selects with Enter when there is nothing to advance to', async () => {
    const user = userEvent.setup();
    render(<Harness initial="single" />);
    screen.getByRole('radio', { name: 'Head of household' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('radio', { name: 'Head of household' })).toBeChecked();
  });

  it('keeps the group name when the label is hidden from sight', () => {
    render(<Harness initial="single" hideLabel layout="grid" />);
    expect(screen.getByRole('radiogroup', { name: 'Filing status' })).toBeInTheDocument();
  });

  it('announces the error and links it to the group in place of the help', () => {
    render(<Harness initial="single" help="As on your last return" error="Pick a filing status." />);
    const group = screen.getByRole('radiogroup', { name: 'Filing status' });
    expect(group).toHaveAccessibleDescription(expect.stringContaining('Pick a filing status.'));
    expect(screen.queryByText('As on your last return')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a filing status.');
  });
});
