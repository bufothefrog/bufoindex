/**
 * StateSelector Component Test Suite
 *
 * Covers the ARIA plumbing a keyboard/screen-reader user depends on: the
 * visible label names the combobox input, options carry role="option" with
 * stable ids, and aria-activedescendant tracks the highlighted option while
 * DOM focus stays in the text field.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StateSelector } from '@/components/shared/inputs/StateSelector';

describe('StateSelector', () => {
  it('associates the visible label with the combobox input', () => {
    render(<StateSelector label="State" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'State' })).toBeInTheDocument();
  });

  it('is a 40px combobox with a text-sm label by default, and 56px with a text-base label at xl', () => {
    const { rerender } = render(<StateSelector label="State" value="TX" onChange={vi.fn()} />);
    let box = screen.getByRole('combobox', { name: 'State' });
    expect(box).toHaveClass('h-10', 'text-sm');
    expect(screen.getByText('State').closest('label')).toHaveClass('text-sm', 'leading-none');
    rerender(<StateSelector label="State" value="TX" onChange={vi.fn()} size="xl" />);
    box = screen.getByRole('combobox', { name: 'State' });
    expect(box).toHaveClass('h-14', 'text-lg');
    expect(box).not.toHaveClass('h-10');
    expect(screen.getByText('State').closest('label')).toHaveClass('text-base', 'leading-none');
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
