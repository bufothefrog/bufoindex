import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CalculatorLinks } from '@/components/shared/CalculatorLinks';

describe('CalculatorLinks', () => {
  it('lists every calculator under its label, in registry order, by bare path', () => {
    render(<CalculatorLinks label="Or open a calculator directly" />);
    expect(screen.getByText('Or open a calculator directly')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Or open a calculator directly' });
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/tools/paycheck-allocator',
      '/tools/retirement-calculator',
      '/tools/portfolio-rebalancing-calculator',
      '/tools/leverage-comparison',
    ]);
    const paycheck = within(list).getByRole('link', { name: /^Paycheck Allocator/ });
    expect(paycheck).toHaveTextContent(
      'A per-paycheck split across bills, savings, and investing that you can set up in your payroll portal.'
    );
  });

  it('leaves out the excluded calculators', () => {
    render(<CalculatorLinks label="Try another calculator" exclude={['leverage']} />);
    const list = screen.getByRole('list', { name: 'Try another calculator' });
    expect(within(list).getAllByRole('link')).toHaveLength(3);
    expect(within(list).queryByRole('link', { name: /^Leverage Comparison/ })).not.toBeInTheDocument();
  });
});
