/**
 * StateSelector Component Test Suite
 *
 * Covers the ARIA plumbing a keyboard/screen-reader user depends on: the
 * visible label names the combobox input, options carry role="option" with
 * stable ids, and aria-activedescendant tracks the highlighted option while
 * DOM focus stays in the text field.
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StateSelector } from '@/components/shared/inputs/StateSelector';

describe('StateSelector', () => {
  afterEach(() => {
    cleanup();
  });

  it('associates the visible label with the combobox input', () => {
    render(<StateSelector label="State" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'State' })).toBeInTheDocument();
  });

  it('points aria-activedescendant at the highlighted option while arrowing', () => {
    render(<StateSelector label="State" value="" onChange={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'State' });

    // Closed: no option is active.
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // First ArrowDown opens the list and highlights the first state.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Alabama');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[1].id,
    );
  });

  it('selects the highlighted state on Enter and closes the list', () => {
    const onChange = vi.fn();
    render(<StateSelector label="State" value="" onChange={onChange} />);
    const input = screen.getByRole('combobox', { name: 'State' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('AL');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
