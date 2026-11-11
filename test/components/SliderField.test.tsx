import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SliderField } from '@/components/ui/inputs';

function Controlled({ onChange }: { onChange?: (v: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <SliderField
      name="multiplier"
      label="Healthcare multiplier"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      min={0.5}
      max={3}
      step={0.1}
      format={(n) => `${n}x`}
      help="Relative to the average cost"
      testId="slider"
    />
  );
}

describe('SliderField', () => {
  it('names the thumb, shows the readout, bounds and help', () => {
    render(<Controlled />);
    const thumb = screen.getByRole('slider', { name: 'Healthcare multiplier' });
    expect(thumb).toHaveAttribute('aria-valuenow', '1');
    expect(thumb).toHaveAttribute('aria-valuemin', '0.5');
    expect(thumb).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByRole('status')).toHaveTextContent('1x');
    expect(screen.getByText('0.5x')).toBeInTheDocument();
    expect(screen.getByText('3x')).toBeInTheDocument();
    expect(screen.getByText('Relative to the average cost')).toBeInTheDocument();
  });

  it('keyboard steps snap away floating point noise', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(1.2);
    expect(screen.getByRole('status')).toHaveTextContent('1.2x');
  });

  it('clamps an out-of-range or non-finite value for display', () => {
    const { rerender } = render(
      <SliderField name="x" label="X" value={9} onChange={() => {}} min={0} max={5} />
    );
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '5');
    rerender(<SliderField name="x" label="X" value={Number.NaN} onChange={() => {}} min={0} max={5} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows an error as an alert in place of help; supports a hidden label and xl size', () => {
    render(
      <SliderField
        name="x"
        label="Volatility"
        value={1}
        onChange={() => {}}
        min={0}
        max={2}
        help="hidden help"
        error="Too high."
        hideLabel
        size="xl"
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Too high.');
    expect(screen.queryByText('hidden help')).not.toBeInTheDocument();
    expect(screen.getByText('Volatility')).toHaveClass('sr-only');
    expect(screen.getByText('Volatility')).toHaveClass('text-base');
  });
});
