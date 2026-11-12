/**
 * KeyValueList renders labelled figures as a description list: each label is
 * a term (dt) and each value its definition (dd), in both layouts.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DollarSign } from 'lucide-react';
import { KeyValueList, type KeyValueItem } from '@/components/ui/results';

const items: KeyValueItem[] = [
  { id: 'net', label: 'Net pay', subtitle: 'Per paycheck', value: 2345.6, format: 'currency', icon: DollarSign },
  { id: 'gain', label: 'Monthly gain', value: 120, format: 'currency', prefix: '+', tone: 'positive' },
  { id: 'drag', label: 'Total annual drag', value: '1.25%' },
  { id: 'missing', label: 'Employer match', value: null, format: 'currency' },
];

/** The dd that follows a term, read off the description list. */
function definitionOf(term: HTMLElement): HTMLElement {
  const group = term.closest('dt')?.parentElement;
  const definition = group?.querySelector('dd');
  expect(definition).not.toBeNull();
  return definition as HTMLElement;
}

describe('KeyValueList', () => {
  it('renders a description list with one term and one definition per item', () => {
    const { container } = render(<KeyValueList items={items} />);

    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    expect(screen.getAllByRole('term')).toHaveLength(4);
    expect(screen.getAllByRole('definition')).toHaveLength(4);
    for (const term of screen.getAllByRole('term')) {
      expect(list).toContainElement(term);
    }
  });

  it('formats numbers through formatValue, applies the prefix and keeps text values as given', () => {
    render(<KeyValueList items={items} />);

    expect(definitionOf(screen.getByText('Net pay'))).toHaveTextContent('$2,346');
    expect(definitionOf(screen.getByText('Monthly gain'))).toHaveTextContent('+$120');
    expect(definitionOf(screen.getByText('Total annual drag'))).toHaveTextContent('1.25%');
    expect(definitionOf(screen.getByText('Employer match'))).toHaveTextContent('\u2014');
  });

  it('keeps the subtitle in the term, not in the value', () => {
    render(<KeyValueList items={items} />);

    const term = screen.getByText('Net pay').closest('dt') as HTMLElement;
    expect(term).toHaveTextContent('Net payPer paycheck');
    expect(definitionOf(screen.getByText('Net pay'))).not.toHaveTextContent('Per paycheck');
  });

  it('uses the same dt and dd pairs in the grid layout', () => {
    render(<KeyValueList items={items.slice(0, 2)} layout="grid" />);

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Net pay', 'Monthly gain']);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['$2,346', '+$120']);
  });
});
