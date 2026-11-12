import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';

const baseProps = {
  title: 'Test calculator',
  description: 'A layout test.',
  inputSections: <div>Inputs here</div>,
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
    expect(screen.getByText('No results yet')).toBeInTheDocument();
  });
});

describe('CalculatorLayout live results', () => {
  const liveProps = {
    title: 'Live calculator',
    description: 'Results follow the inputs.',
    inputSections: <div>Inputs here</div>,
  };

  it('has no Calculate button; the mobile bar offers See results, then Edit inputs', async () => {
    const user = userEvent.setup();
    render(<CalculatorLayout {...liveProps} resultSection={<div>Results here</div>} />);
    expect(screen.queryByRole('button', { name: /Calculate/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /See results/ }));
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: /Edit inputs/ }));
    expect(screen.getByRole('tab', { name: /Inputs/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('offers See results even before there are results', () => {
    render(<CalculatorLayout {...liveProps} />);
    expect(screen.getByRole('button', { name: /See results/ })).toBeInTheDocument();
  });

  it('shows the live empty state', () => {
    render(<CalculatorLayout {...liveProps} />);
    expect(screen.getByRole('heading', { name: 'No results yet' })).toBeInTheDocument();
    expect(screen.getByText('Results appear here as soon as every field holds a valid value.')).toBeInTheDocument();
  });

  it('stays on Inputs when results arrive or change, and switches on showResultsKey', () => {
    const { rerender } = render(<CalculatorLayout {...liveProps} />);
    rerender(<CalculatorLayout {...liveProps} resultSection={<div>First results</div>} />);
    rerender(<CalculatorLayout {...liveProps} resultSection={<div>Results here</div>} />);
    expect(screen.getByRole('tab', { name: /Inputs/ })).toHaveAttribute('aria-selected', 'true');

    const results = <div>Results here</div>;
    rerender(<CalculatorLayout {...liveProps} resultSection={results} showResultsKey="profile" />);
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('names the results panel as a region, the one the Results tab controls', () => {
    render(
      <CalculatorLayout {...liveProps} resultsLabel="Fake results" resultSection={<div>Results here</div>} />
    );
    const region = screen.getByRole('region', { name: 'Fake results' });
    expect(region).toHaveTextContent('Results here');
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-controls', region.id);
  });

  it('counts the fields that need attention in the mobile bar', () => {
    render(<CalculatorLayout {...liveProps} errors={{ 'person.age': 'Age must be at least 18.' }} />);
    expect(screen.getByText('1 field needs attention before the results update.')).toBeInTheDocument();
  });
});

describe('CalculatorLayout disclaimer', () => {
  it('renders the shared disclaimer line', () => {
    render(<CalculatorLayout {...baseProps} disclaimer="Not advice." />);
    expect(screen.getByText('Not advice.')).toBeInTheDocument();
    expect(screen.getByText('Disclaimer:')).toBeInTheDocument();
  });
});
