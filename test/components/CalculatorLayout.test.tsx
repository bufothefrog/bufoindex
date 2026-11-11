import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalculatorLayout, SimpleCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';

const baseProps = {
  title: 'Test calculator',
  description: 'A layout test.',
  inputSections: <div>Inputs here</div>,
  onCalculate: () => {},
};

describe('CalculatorLayout resultFooter', () => {
  it('renders the footer after the results, inside the results panel', () => {
    render(
      <CalculatorLayout
        {...baseProps}
        resultSection={<div data-testid="results">Results here</div>}
        resultFooter={<div data-testid="footer">What next?</div>}
      />
    );

    const results = screen.getByTestId('results');
    const footer = screen.getByTestId('footer');
    // Same container (the results panel), footer immediately after the results.
    expect(footer.parentElement).toBe(results.parentElement);
    expect(results.nextElementSibling).toBe(footer);

    // The results panel is the one the mobile Results tab controls.
    const resultsTab = screen.getByRole('tab', { name: /Results/ });
    expect(footer.parentElement).toHaveAttribute('id', resultsTab.getAttribute('aria-controls'));
  });

  it('does not render the footer without a resultSection', () => {
    render(<CalculatorLayout {...baseProps} resultFooter={<div data-testid="footer">What next?</div>} />);
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    // The empty state still shows in its place.
    expect(screen.getByText('Ready to Calculate?')).toBeInTheDocument();
  });

  it('passes the footer through SimpleCalculatorLayout', () => {
    const { rerender } = render(
      <SimpleCalculatorLayout
        {...baseProps}
        resultSection={<div data-testid="results">Results here</div>}
        resultFooter={<div data-testid="footer">What next?</div>}
      />
    );
    expect(screen.getByTestId('results').nextElementSibling).toBe(screen.getByTestId('footer'));

    rerender(
      <SimpleCalculatorLayout {...baseProps} resultFooter={<div data-testid="footer">What next?</div>} />
    );
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
  });
});
