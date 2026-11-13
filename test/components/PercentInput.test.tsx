/**
 * PercentInput Component Test Suite
 *
 * The component's contract: `value` is a decimal fraction (0.075 = 7.5%),
 * the display is the percentage form, and onChange emits decimals. Covers
 * parsing/precision, min/max gating of typed values, negative handling,
 * arrow-key stepping, the % suffix and slider mode (showSlider).
 *
 * Interaction tests use a stateful harness that feeds onChange back into
 * value, matching how calculator pages use the component.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { PercentInput } from '@/components/ui/inputs/PercentInput';

// Radix Slider (used in showSlider mode) measures its thumb with
// ResizeObserver, which jsdom does not provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

type PercentProps = React.ComponentProps<typeof PercentInput>;

function ControlledPercent({
  initial = 0,
  onChange,
  ...rest
}: Omit<PercentProps, 'value' | 'onChange'> & {
  initial?: number;
  onChange?: (v: number) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <PercentInput
      {...rest}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('PercentInput', () => {
  it('associates the label with the input and renders the % suffix', () => {
    render(
      <PercentInput name="rate" label="Return rate" value={0.07} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Return rate')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('exposes ariaLabel as the accessible name when no visible label text exists', () => {
    render(
      <PercentInput
        name="target-us-stock"
        label=""
        ariaLabel="US Stock target"
        value={0.6}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'US Stock target' }),
    ).toBeInTheDocument();
  });

  it('requests a numeric keyboard on mobile', () => {
    render(
      <PercentInput name="rate" label="Return rate" value={0.07} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Return rate')).toHaveAttribute(
      'inputmode',
      'decimal',
    );
  });

  it('displays a decimal value as a percentage at the default precision', () => {
    render(
      <PercentInput name="rate" label="Return rate" value={0.075} onChange={vi.fn()} />,
    );
    // 0.075 → 7.5% → "7.5" at precision 1 (default)
    expect((screen.getByLabelText('Return rate') as HTMLInputElement).value).toBe('7.5');
  });

  it('honors the precision prop in the initial display', () => {
    render(
      <PercentInput
        name="rate"
        label="Return rate"
        value={0.075}
        precision={2}
        onChange={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Return rate') as HTMLInputElement).value).toBe('7.50');
  });

  it("typing '7.5' emits the decimal 0.075", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledPercent name="rate" label="Return rate" onChange={onChange} />);
    const input = screen.getByLabelText('Return rate') as HTMLInputElement;

    await user.type(input, '7.5');

    // Keystroke commits: "7" → 0.07, "7." → 0.07, "7.5" → 0.075
    expect(onChange).toHaveBeenLastCalledWith(0.075);
    expect(input.value).toBe('7.5');
  });

  it('never commits a typed value above max', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ControlledPercent
        name="rate"
        label="Return rate"
        max={0.1}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Return rate') as HTMLInputElement;

    await user.type(input, '50');

    // "5" → 0.05 passes; "50" → 0.5 exceeds max 0.1 and is dropped.
    expect(onChange).toHaveBeenLastCalledWith(0.05);
    expect(onChange).not.toHaveBeenCalledWith(0.5);
    // The raw text remains what was typed, but the committed value is 5%.
    expect(input.value).toBe('50');
  });

  it('accepts negative percentages when min is negative', () => {
    const onChange = vi.fn();
    render(
      <ControlledPercent
        name="rate"
        label="Return rate"
        min={-1}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Return rate') as HTMLInputElement;

    // Entered as one change (paste-like); per-keystroke entry of a bare "-"
    // commits an intermediate 0 that resets the display.
    fireEvent.change(input, { target: { value: '-25' } });

    // "-25" → -25% → -0.25
    expect(onChange).toHaveBeenLastCalledWith(-0.25);
    expect(input.value).toBe('-25');
  });

  it('blocks the minus key when min is non-negative', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledPercent name="rate" label="Return rate" onChange={onChange} />);
    const input = screen.getByLabelText('Return rate') as HTMLInputElement;

    await user.type(input, '-5');

    // "-" is swallowed by keydown; only "5" lands → 0.05.
    expect(input.value).toBe('5');
    expect(onChange).toHaveBeenLastCalledWith(0.05);
    expect(onChange).not.toHaveBeenCalledWith(-0.05);
  });

  it('rounds the display to the configured precision on blur', async () => {
    const user = userEvent.setup();
    render(<ControlledPercent name="rate" label="Return rate" />);
    const input = screen.getByLabelText('Return rate') as HTMLInputElement;

    await user.type(input, '7.256');
    await user.tab();

    // (7.256).toFixed(1) = "7.3"
    expect(input.value).toBe('7.3');
  });

  it('steps by the step prop on arrow keys and clamps at the bounds', () => {
    const onChange = vi.fn();
    render(
      <PercentInput
        name="rate"
        label="Return rate"
        value={0.05}
        step={0.01}
        max={0.06}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Return rate');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.06, 10));

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.04, 10));

    // Already at max: ArrowUp clamps to max instead of exceeding it.
    cleanup();
    const clamped = vi.fn();
    render(
      <PercentInput
        name="rate"
        label="Return rate"
        value={0.06}
        step={0.01}
        max={0.06}
        onChange={clamped}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('Return rate'), { key: 'ArrowUp' });
    expect(clamped).toHaveBeenLastCalledWith(expect.closeTo(0.06, 10));
  });

  it('renders no slider by default', () => {
    render(
      <PercentInput name="rate" label="Return rate" value={0.6} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('showSlider renders a slider reflecting the value with min/current/max labels', () => {
    render(
      <PercentInput
        name="stocks"
        label="Stock allocation"
        value={0.6}
        min={0}
        max={1}
        showSlider
        onChange={vi.fn()}
      />,
    );
    // The name has to land on the element that carries role="slider" (the
    // Radix thumb), not on the wrapper the props are spread onto.
    const slider = screen.getByRole('slider', { name: 'Stock allocation' });
    // 0.6 decimal → slider operates in percent units (60 of 0–100).
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('puts the slider and readout of a blank field (null) at the typical value, never at 0', () => {
    const { unmount } = render(
      <PercentInput
        name="inflation"
        label="Inflation rate"
        value={null}
        placeholderValue={0.03}
        min={0.01}
        max={0.05}
        showSlider
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Inflation rate', { selector: 'input' })).toHaveValue('');
    expect(screen.getByRole('slider', { name: 'Inflation rate' })).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3.0%')).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).toBeNull();
    unmount();
    // Without a typical value the slider rests at the minimum, not below it.
    render(
      <PercentInput name="inflation" label="Inflation rate" value={null} min={0.01} max={0.05} showSlider onChange={vi.fn()} />,
    );
    expect(screen.getByRole('slider', { name: 'Inflation rate' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByText('0.0%')).toBeNull();
  });

  it('falls back to ariaLabel for the slider name when the label is empty', () => {
    render(
      <PercentInput
        name="stocks"
        label=""
        ariaLabel="Stock allocation"
        value={0.6}
        showSlider
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('slider', { name: 'Stock allocation' }),
    ).toBeInTheDocument();
  });
});
