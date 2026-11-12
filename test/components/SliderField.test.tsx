/**
 * SliderField: a NumberInput (label, help and error from BaseInput) and a
 * slider with the same accessible name, moving one value; the bounds and
 * the current value print under the slider, and steps such as 0.1 are
 * written without binary noise.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SliderField, type SliderFieldProps } from '@/components/ui/inputs';
import { ResizeObserverStub } from './fields/harness';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function Harness({ initial = 1, onChange, ...rest }: Partial<SliderFieldProps> & { initial?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <SliderField
      name="healthcare-multiplier"
      label="Healthcare cost multiplier"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      min={0.5}
      max={3}
      step={0.1}
      formatValue={(n) => `${n}x`}
      {...rest}
    />
  );
}

describe('SliderField', () => {
  it('names the box and the slider by the label, and describes the box by the help', () => {
    render(<Harness help="Times the average cost" />);
    const box = screen.getByRole('textbox', { name: 'Healthcare cost multiplier' });
    expect(box).toHaveValue('1');
    expect(box).toHaveAccessibleDescription('Times the average cost');
    const slider = screen.getByRole('slider', { name: 'Healthcare cost multiplier' });
    expect(slider).toHaveAttribute('aria-valuemin', '0.5');
    expect(slider).toHaveAttribute('aria-valuemax', '3');
    expect(slider).toHaveAttribute('aria-valuenow', '1');
  });

  it('describes the slider by the help, or by the error and marks it invalid', () => {
    const { rerender } = render(<Harness help="Times the average cost" />);
    expect(screen.getByRole('slider', { name: 'Healthcare cost multiplier' })).toHaveAccessibleDescription(
      'Times the average cost'
    );
    rerender(<Harness help="Times the average cost" error="Too high." />);
    const slider = screen.getByRole('slider', { name: 'Healthcare cost multiplier' });
    expect(slider).toHaveAccessibleDescription(expect.stringContaining('Too high.'));
    expect(slider).toHaveAttribute('aria-invalid', 'true');
  });

  it('prints the bounds and the current value', () => {
    render(<Harness initial={1.5} />);
    expect(screen.getByText('0.5x')).toBeInTheDocument();
    expect(screen.getByText('1.5x')).toBeInTheDocument();
    expect(screen.getByText('3x')).toBeInTheDocument();
  });

  it('moves with the arrow keys on the slider, in clean steps', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={1} onChange={onChange} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([1.1, 1.2]);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '1.2');
    expect(screen.getByText('1.2x')).toBeInTheDocument();
  });

  it('takes a typed value, rounded to the step, and moves the slider', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Healthcare cost multiplier' }), { target: { value: '1.1' } });
    expect(onChange).toHaveBeenLastCalledWith(1.1);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '1.1');
  });

  it('announces the error and links it to the box', () => {
    render(<Harness help="Times the average cost" error="Healthcare cost multiplier must be at most 3x." />);
    const box = screen.getByRole('textbox', { name: 'Healthcare cost multiplier' });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription(expect.stringContaining('must be at most 3x.'));
    expect(screen.getByRole('alert')).toHaveTextContent('Healthcare cost multiplier must be at most 3x.');
  });

  it('formats with formatCount by default and shows a unit suffix in the box', () => {
    render(<Harness formatValue={undefined} suffix="x" initial={1.25} step={0.05} min={0.5} max={1000} />);
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('1.25')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
