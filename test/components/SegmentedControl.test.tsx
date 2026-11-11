/**
 * SegmentedControl is a radio group: one radio per option, only the selected
 * one in the tab order, and the arrow keys, Home and End moving the selection
 * and the focus together. DollarModeToggle is built on it and keeps its
 * accessible name, its two radios and their tooltips.
 */

import React, { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Coins, Scissors } from 'lucide-react';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';

afterEach(() => {
  cleanup();
});

type Strategy = 'standard' | 'cashflow' | 'growth';

const OPTIONS: readonly SegmentedControlOption<Strategy>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'cashflow', label: 'Cash-flow investor' },
  { value: 'growth', label: 'Growth' },
];

/** A controlled control, as every caller uses it. */
function Harness({ initial = 'standard', onChange }: { initial?: Strategy; onChange?: (value: Strategy) => void }) {
  const [value, setValue] = useState<Strategy>(initial);
  return (
    <SegmentedControl
      label="Strategy"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a radio group named by its visible label', () => {
    render(<Harness />);

    const group = screen.getByRole('radiogroup', { name: 'Strategy' });
    expect(group).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeVisible();
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Standard',
      'Cash-flow investor',
      'Growth',
    ]);
  });

  it('marks only the selected option as checked', () => {
    render(<Harness initial="cashflow" />);

    expect(screen.getByRole('radio', { name: 'Cash-flow investor' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Standard' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Growth' })).not.toBeChecked();
  });

  it('selects an option on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Growth' }));

    expect(onChange).toHaveBeenCalledWith('growth');
    expect(screen.getByRole('radio', { name: 'Growth' })).toBeChecked();
  });

  it('puts only the selected radio in the tab order', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Harness initial="cashflow" />
        <button type="button">After</button>
      </>
    );

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Cash-flow investor' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves the selection and the focus with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Standard' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Cash-flow investor' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Cash-flow investor' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Growth' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Standard' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Growth' })).toBeChecked();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Cash-flow investor' })).toBeChecked();

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      'cashflow',
      'growth',
      'standard',
      'growth',
      'cashflow',
    ]);
  });

  it('jumps to the first and last option with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness initial="cashflow" />);

    await user.tab();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Growth' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Growth' })).toHaveFocus();

    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Standard' })).toHaveFocus();
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    await user.keyboard('a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the first option tabbable when the value matches no option', () => {
    render(
      <SegmentedControl
        label="Strategy"
        options={OPTIONS}
        value={'unknown' as Strategy}
        onChange={() => {}}
      />
    );

    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual([
      screen.getByRole('radio', { name: 'Standard' }),
    ]);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  it('names card options by their label and describes them by their description', () => {
    render(
      <SegmentedControl
        label="Purchase mode"
        hideLabel
        appearance="cards"
        options={[
          { value: 'whole', label: 'Whole shares', description: 'Floor to integers; leftover kept as cash.', icon: Coins, testId: 'mode-whole' },
          { value: 'fractional', label: 'Fractional', description: 'Exact-to-penny splits. Requires broker support.', icon: Scissors },
        ]}
        value="fractional"
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('radiogroup', { name: 'Purchase mode' })).toBeInTheDocument();
    expect(screen.queryByText('Purchase mode')).not.toBeInTheDocument();
    const whole = screen.getByRole('radio', { name: 'Whole shares' });
    expect(whole).toHaveAccessibleDescription('Floor to integers; leftover kept as cash.');
    expect(whole).toBe(screen.getByTestId('mode-whole'));
    expect(screen.getByRole('radio', { name: 'Fractional' })).toBeChecked();
  });
});

describe('DollarModeToggle', () => {
  function Toggle({ onChange }: { onChange?: (mode: DollarDisplayMode) => void }) {
    const [mode, setMode] = useState<DollarDisplayMode>('today');
    return (
      <DollarModeToggle
        value={mode}
        onChange={(next) => {
          setMode(next);
          onChange?.(next);
        }}
      />
    );
  }

  it('keeps its accessible name, radios and tooltips', () => {
    render(<Toggle />);

    expect(screen.getByRole('radiogroup', { name: 'Dollar display mode' })).toBeInTheDocument();
    const today = screen.getByRole('radio', { name: "Today's dollars" });
    const future = screen.getByRole('radio', { name: 'Future dollars' });
    expect(today).toBeChecked();
    expect(future).not.toBeChecked();
    expect(today).toHaveAttribute('title', 'Amounts adjusted for inflation to current purchasing power');
    expect(future).toHaveAttribute('title', 'Raw amounts in the year they occur, before inflation adjustment');
  });

  it('switches modes by click and by arrow key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Future dollars' }));
    expect(screen.getByRole('radio', { name: 'Future dollars' })).toBeChecked();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: "Today's dollars" })).toBeChecked();
    expect(onChange.mock.calls.map(([mode]) => mode)).toEqual(['nominal', 'today']);
  });
});
