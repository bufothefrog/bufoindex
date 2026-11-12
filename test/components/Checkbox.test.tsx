/**
 * Checkbox: a native checkbox named by its label (which also toggles it),
 * described by its help, and with an announced, linked error that replaces
 * the help.
 */

import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Checkbox, { type CheckboxProps } from '@/components/ui/checkbox';

function Harness({ initial = false, onChange, ...rest }: Partial<CheckboxProps> & { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <Checkbox
      name="allow-selling"
      label="Allow selling in taxable accounts"
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onChange?.(next);
      }}
      {...rest}
    />
  );
}

describe('Checkbox', () => {
  it('is a checkbox named by its label and described by its help', () => {
    render(<Harness help="Selling may realize capital gains." />);
    const box = screen.getByRole('checkbox', { name: 'Allow selling in taxable accounts' });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription('Selling may realize capital gains.');
    expect(box).not.toBeInvalid();
  });

  it('toggles from the box and from the label, reporting the new state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByText('Allow selling in taxable accounts'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await user.keyboard(' ');
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([true, false, true]);
  });

  it('announces the error, links it, and drops the help', () => {
    render(<Harness help="Selling may realize capital gains." error="Choose whether selling is allowed." />);
    const box = screen.getByRole('checkbox', { name: 'Allow selling in taxable accounts' });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription('Choose whether selling is allowed.');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose whether selling is allowed.');
    expect(screen.queryByText('Selling may realize capital gains.')).not.toBeInTheDocument();
  });

  it('can be disabled, and carries its test id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness disabled onChange={onChange} testId="toggle-allow-taxable-selling" initial />);
    const box = screen.getByRole('checkbox', { name: 'Allow selling in taxable accounts' });
    expect(box).toBeDisabled();
    await user.click(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('toggle-allow-taxable-selling')).toContainElement(box);
  });
});
