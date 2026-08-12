/**
 * EnhancedMoneyInput Component Test Suite
 *
 * Covers accessible naming (visible label + ariaLabel fallback), comma-aware
 * parsing, min/max gating (out-of-range values are never committed), the
 * cents-based onChange contract in allowDecimals mode, blur reformatting,
 * keystroke filtering, and error display.
 *
 * The component is controlled: it clears its display when the incoming value
 * stays 0 after an edit, so interaction tests use a stateful harness that
 * feeds onChange back into value the way calculator pages do.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EnhancedMoneyInput } from '@/components/ui/inputs/EnhancedMoneyInput';

type MoneyProps = React.ComponentProps<typeof EnhancedMoneyInput>;

/**
 * Controlled harness. In allowDecimals mode the component emits cents, so a
 * real parent stores dollars and converts — `toValue` mirrors that.
 */
function ControlledMoney({
  initial = 0,
  onChange,
  toValue = (v: number) => v,
  ...rest
}: Omit<MoneyProps, 'value' | 'onChange'> & {
  initial?: number;
  onChange?: (v: number) => void;
  toValue?: (emitted: number) => number;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <EnhancedMoneyInput
      {...rest}
      value={value}
      onChange={(v) => {
        setValue(toValue(v));
        onChange?.(v);
      }}
    />
  );
}

describe('EnhancedMoneyInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('associates the visible label with the input', () => {
    render(
      <EnhancedMoneyInput name="amount" label="Amount" value={0} onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText('Amount');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('exposes ariaLabel as the accessible name when no visible label text exists', () => {
    render(
      <EnhancedMoneyInput
        name="rent"
        label=""
        ariaLabel="Monthly rent"
        value={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Monthly rent' })).toBeInTheDocument();
  });

  it('renders an initial value formatted with thousands separators', () => {
    render(
      <EnhancedMoneyInput name="amount" label="Amount" value={1234} onChange={vi.fn()} />,
    );
    // formatCurrency(1234) = "$1,234" → "$" is rendered as an icon, not text.
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('1,234');
  });

  it('emits the numeric value while typing and formats the display with commas', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledMoney name="amount" label="Amount" onChange={onChange} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.type(input, '1234');

    // Commits per keystroke: 1 → 12 → 123 → 1234.
    expect(onChange).toHaveBeenLastCalledWith(1234);
    expect(input.value).toBe('1,234');
  });

  it("parses pasted '1,234' into the number 1234", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledMoney name="amount" label="Amount" onChange={onChange} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.click(input);
    await user.paste('1,234');

    expect(onChange).toHaveBeenCalledWith(1234);
    expect(input.value).toBe('1,234');
  });

  it('never commits a value above max', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ControlledMoney name="amount" label="Amount" max={100} onChange={onChange} />,
    );
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.type(input, '250');

    // 2 and 25 pass the gate; 250 > 100 is silently dropped, not clamped.
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenLastCalledWith(25);
    expect(onChange).not.toHaveBeenCalledWith(250);
  });

  it('never commits a value below min', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ControlledMoney name="amount" label="Amount" min={500} onChange={onChange} />,
    );

    await user.type(screen.getByLabelText('Amount'), '250');

    // Every prefix (2, 25, 250) is below min=500, so nothing is committed.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits cents in allowDecimals mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ControlledMoney
        name="amount"
        label="Amount"
        allowDecimals
        onChange={onChange}
        toValue={(cents) => cents / 100}
      />,
    );
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.type(input, '12.34');

    // $12.34 → Math.round(12.34 * 100) = 1234 cents.
    expect(onChange).toHaveBeenLastCalledWith(1234);
    expect(input.value).toBe('12.34');
  });

  it('reformats to whole-dollar currency on blur in allowDecimals mode', async () => {
    const user = userEvent.setup();
    render(
      <ControlledMoney
        name="amount"
        label="Amount"
        allowDecimals
        toValue={(cents) => cents / 100}
      />,
    );
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.type(input, '1234.5');
    await user.tab();

    // formatCurrency uses 0 fraction digits: 1234.5 rounds to "1,235".
    expect(input.value).toBe('1,235');
  });

  it('blocks non-numeric keystrokes entirely', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledMoney name="amount" label="Amount" onChange={onChange} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;

    await user.type(input, 'abc');

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('renders the error as an alert and marks the input invalid', () => {
    render(
      <EnhancedMoneyInput
        name="amount"
        label="Amount"
        value={0}
        onChange={vi.fn()}
        error="Amount is required"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Amount is required');
    expect(screen.getByLabelText(/Amount/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows help text when there is no error, and hides it when an error appears', () => {
    const { rerender } = render(
      <EnhancedMoneyInput
        name="amount"
        label="Amount"
        value={0}
        onChange={vi.fn()}
        help="Enter your gross monthly amount"
      />,
    );
    expect(screen.getByText('Enter your gross monthly amount')).toBeInTheDocument();

    rerender(
      <EnhancedMoneyInput
        name="amount"
        label="Amount"
        value={0}
        onChange={vi.fn()}
        help="Enter your gross monthly amount"
        error="Amount is required"
      />,
    );
    expect(screen.queryByText('Enter your gross monthly amount')).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('respects a disabled state', () => {
    render(
      <EnhancedMoneyInput
        name="amount"
        label="Amount"
        value={0}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByLabelText('Amount')).toBeDisabled();
  });
});
