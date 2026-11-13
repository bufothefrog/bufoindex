/**
 * The intake's blank and zero handling in the number primitives (MoneyInput,
 * NumberInput, PercentInput): a null value renders empty, placeholderValue
 * shows the typical value formatted as the field formats its value,
 * showZero shows a committed 0, and onClear replaces onChange(0) when the
 * visitor empties the field. Without these props a 0 still shows empty, as
 * the calculator pages expect.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from '@/components/ui/inputs/MoneyInput';
import { NumberInput } from '@/components/ui/inputs/NumberInput';
import { PercentInput } from '@/components/ui/inputs/PercentInput';

type Props = { value: number | null; showZero?: boolean; placeholderValue?: number; onClear?: () => void };

/** A parent that feeds onChange back into value, and onClear back to null. */
function Controlled({
  Input,
  initial,
  ...rest
}: { Input: typeof MoneyInput | typeof NumberInput | typeof PercentInput; initial: number | null } & Omit<Props, 'value'>) {
  const [value, setValue] = React.useState<number | null>(initial);
  return (
    <Input
      name="x"
      label="Amount"
      value={value}
      onChange={setValue}
      {...rest}
      onClear={rest.onClear ? () => { rest.onClear?.(); setValue(null); } : undefined}
    />
  );
}

const box = () => screen.getByLabelText('Amount');

describe.each([
  ['MoneyInput', MoneyInput, 3500, '3,500', '0'],
  ['NumberInput', NumberInput, 30, '30', '0'],
  ['PercentInput', PercentInput, 0.04, '4.0', '0.0'],
] as const)('%s', (_name, Input, typical, typicalText, zeroText) => {
  it('renders null empty, with the typical value as the formatted placeholder', () => {
    render(<Input name="x" label="Amount" value={null} onChange={() => {}} placeholderValue={typical} />);
    expect(box()).toHaveValue('');
    expect(box()).toHaveAttribute('placeholder', typicalText);
  });

  it('shows a committed 0 as empty by default and as 0 with showZero', () => {
    const { unmount } = render(<Input name="x" label="Amount" value={0} onChange={() => {}} />);
    expect(box()).toHaveValue('');
    unmount();
    render(<Input name="x" label="Amount" value={0} onChange={() => {}} showZero />);
    expect(box()).toHaveValue(zeroText);
  });

  it('keeps a typed 0 as 0 after blur with showZero', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Parent() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <Input
          name="x"
          label="Amount"
          value={value}
          showZero
          onChange={(v: number) => {
            onChange(v);
            setValue(v);
          }}
        />
      );
    }
    render(<Parent />);
    await user.type(box(), '0');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(box()).toHaveValue(zeroText);
  });

  it('calls onClear, not onChange(0), when the visitor empties the field', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Controlled Input={Input} initial={null} showZero placeholderValue={typical} onClear={onClear} />);
    await user.type(box(), '5');
    await user.clear(box());
    await user.tab();
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('');
    expect(box()).toHaveAttribute('placeholder', typicalText);
  });
});
