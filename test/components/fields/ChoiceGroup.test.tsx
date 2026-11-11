import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ChoiceGroup } from '@/components/fields';
import type { FieldOptionValue } from '@/lib/fields/types';
import { FILING_OPTIONS } from './fixtures';

function Controlled(props: { onAdvance?: (v: FieldOptionValue) => void; layout?: 'stack' | 'grid'; initial?: string }) {
  const [value, setValue] = useState<unknown>(props.initial);
  return (
    <ChoiceGroup
      label="Filing status"
      options={FILING_OPTIONS}
      value={value}
      onChange={setValue}
      onChooseAndAdvance={props.onAdvance}
      layout={props.layout}
      hideLabel
    />
  );
}

describe('ChoiceGroup', () => {
  it('uses a roving tab stop on the first option when nothing is selected', () => {
    render(<Controlled />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(screen.getByText('Filing status')).toHaveClass('sr-only');
    expect(screen.getByRole('radio', { name: /Married filing jointly/ })).toHaveTextContent('One return for both');
  });

  it('arrow keys, Home and End move focus and select, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="single" />);
    screen.getByRole('radio', { name: /^Single/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: /Married/ })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Married/ })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: /Head/ })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: /^Single/ })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: /Head/ })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: /^Single/ })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: /Head/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('Enter selects and advances when the caller supports it, otherwise only selects', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    const { unmount } = render(<Controlled onAdvance={onAdvance} />);
    screen.getAllByRole('radio')[2].focus();
    await user.keyboard('{Enter}');
    expect(onAdvance).toHaveBeenCalledWith('headOfHousehold');
    unmount();

    render(<Controlled />);
    screen.getAllByRole('radio')[1].focus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('ignores other keys and supports a grid layout', async () => {
    const user = userEvent.setup();
    render(<Controlled layout="grid" initial="single" />);
    expect(screen.getByRole('radiogroup').className).toContain('sm:grid-cols-2');
    screen.getAllByRole('radio')[0].focus();
    await user.keyboard('a');
    expect(screen.getAllByRole('radio')[0]).toHaveAttribute('aria-checked', 'true');
  });
});
