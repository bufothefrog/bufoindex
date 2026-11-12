/**
 * TickerCombobox driven by a parent that holds real state, as HoldingRow's
 * parent does: a pick relinks the holding to another security, and a new
 * ticker is recorded. Focus is moved for real (input.focus()), so the
 * component's "is the input focused" checks see what a browser would show.
 */

import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TickerCombobox, type TickerOption } from '@/components/ui/inputs/TickerCombobox';

const OPTIONS: TickerOption[] = [
  { id: 'sec1', ticker: 'VTI', price: 250 },
  { id: 'sec2', ticker: 'BND', price: 75 },
  { id: 'sec3', ticker: 'VXUS', price: 60 },
];

interface HarnessProps {
  onSelect: (id: string) => void;
  onCommit: (ticker: string) => void;
}

/** Holds the linked security like the rebalancer does, and reports every callback. */
function Harness({ onSelect, onCommit }: HarnessProps) {
  const [securities, setSecurities] = useState(OPTIONS);
  const [linkedId, setLinkedId] = useState('sec1');
  const linked = securities.find(s => s.id === linkedId);
  return (
    <div>
      <label htmlFor="ticker">Ticker</label>
      <TickerCombobox
        id="ticker"
        value={linked?.ticker ?? ''}
        options={securities}
        currentId={linkedId}
        onSelectExisting={id => {
          onSelect(id);
          setLinkedId(id);
        }}
        onCommitNewTicker={ticker => {
          onCommit(ticker);
          // Mirrors linkHoldingByTicker for a sole reference: rename in place.
          setSecurities(prev => prev.map(s => (s.id === linkedId ? { ...s, ticker } : s)));
        }}
      />
      <button type="button">Elsewhere</button>
      <p data-testid="linked">{linked ? `${linked.id}:${linked.ticker}` : 'none'}</p>
    </div>
  );
}

function setup() {
  const onSelect = vi.fn();
  const onCommit = vi.fn();
  render(<Harness onSelect={onSelect} onCommit={onCommit} />);
  const input = screen.getByRole('combobox', { name: 'Ticker' }) as HTMLInputElement;
  return { input, onSelect, onCommit };
}

/** Blur for real and let the deferred blur commit (120 ms) run. */
function leaveField(input: HTMLInputElement) {
  act(() => {
    input.blur();
  });
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

describe('TickerCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('shows a clicked option at once, and the later blur reports nothing more', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('option', { name: /BND/ }));

    expect(input).toHaveValue('BND');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('sec2');

    leaveField(input);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('BND');
    // The securities themselves are untouched: VTI was not renamed, BND kept its ticker.
    expect(screen.getByTestId('linked')).toHaveTextContent('sec2:BND');
  });

  it('commits the highlighted option on Enter, never the partly typed text', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'bn' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const option = screen.getByRole('option', { name: /BND/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('sec2');
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('BND');
    expect(screen.getByTestId('linked')).toHaveTextContent('sec2:BND');
  });

  it('commits a typed new ticker exactly once on blur', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'voo' } });

    leaveField(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('VOO');
    expect(onSelect).not.toHaveBeenCalled();
    expect(input).toHaveValue('VOO');
  });

  it('commits a typed new ticker once when the visitor clicks elsewhere', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'voo' } });

    // A click outside: mousedown on another element, then the input loses focus.
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }));
    leaveField(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('VOO');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('linked')).toHaveTextContent('sec1:VOO');
  });

  it('commits a typed new ticker once on Enter, with no second commit from the blur', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'voo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('VOO');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reverts an emptied field on blur without reporting anything', () => {
    const { input, onSelect, onCommit } = setup();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });

    leaveField(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(input).toHaveValue('VTI');
  });
});
