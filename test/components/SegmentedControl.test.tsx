import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SegmentedControl, { type SegmentedControlOption } from '@/components/ui/segmented-control';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import type { DollarDisplayMode } from '@/lib/utils/displayDollars';

type Mix = 'a' | 'b' | 'c' | 'd';
const OPTIONS: SegmentedControlOption<Mix>[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', description: 'The second' },
  { value: 'c', label: 'Gamma', disabled: true },
  { value: 'd', label: 'Delta' },
];

function Harness({ onChange = () => {} }: { onChange?: (v: Mix) => void }) {
  const [value, setValue] = useState<Mix>('a');
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      options={OPTIONS}
      ariaLabel="Mix"
      fullWidth
    />
  );
}

describe('SegmentedControl', () => {
  it('is a radiogroup of radios with one checked and one tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Mix' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('title', 'The second');
  });

  it('selects on click and does not re-emit the current value', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Delta' }));
    expect(onChange).toHaveBeenCalledWith('d');
    expect(screen.getByRole('radio', { name: 'Delta' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves with arrow keys, skips disabled options, and wraps', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole('radio', { name: 'Alpha' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Delta' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Delta' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Delta' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    await userEvent.keyboard('x');
    expect(onChange).not.toHaveBeenCalledWith('c');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeDisabled();
  });

  it('can be labelled by another element', () => {
    render(
      <>
        <span id="lbl">Strategy</span>
        <SegmentedControl value="a" onChange={() => {}} options={OPTIONS.slice(0, 2)} ariaLabelledBy="lbl" size="sm" />
      </>
    );
    expect(screen.getByRole('radiogroup', { name: 'Strategy' })).toBeInTheDocument();
  });
});

describe('DollarModeToggle', () => {
  it('keeps its props and accessible names', async () => {
    const onChange = vi.fn<(mode: DollarDisplayMode) => void>();
    render(<DollarModeToggle value="today" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Dollar display mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: "Today's dollars" })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Future dollars' }));
    expect(onChange).toHaveBeenCalledWith('nominal');
  });
});
