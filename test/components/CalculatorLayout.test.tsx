import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CalculatorLayout,
  DisclaimerFooter,
  LIVE_EMPTY_STATE,
  SimpleCalculatorLayout,
} from '@/components/ui/layouts/CalculatorLayout';

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

describe('CalculatorLayout empty state', () => {
  it('keeps the Calculate copy for calculators with a Calculate button', () => {
    render(<CalculatorLayout {...baseProps} />);
    expect(screen.getByText('Ready to Calculate?')).toBeInTheDocument();
  });

  it('uses the live copy with liveResults', () => {
    render(<CalculatorLayout {...baseProps} liveResults />);
    expect(screen.getByText(LIVE_EMPTY_STATE.title!)).toBeInTheDocument();
    expect(screen.getByText(LIVE_EMPTY_STATE.description!)).toBeInTheDocument();
    expect(screen.queryByText('Ready to Calculate?')).not.toBeInTheDocument();
  });

  it('renders the notice between the header and the grid', () => {
    render(<CalculatorLayout {...baseProps} notice={<p data-testid="notice">Heads up</p>} />);
    const heading = screen.getByRole('heading', { level: 1 });
    const notice = screen.getByTestId('notice');
    expect(heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(screen.getByText('Inputs here')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('CalculatorLayout liveResults', () => {
  const results = <div data-testid="results">Results here</div>;

  it('hides the desktop Calculate card; the mobile bar toggles inputs and results', async () => {
    const user = userEvent.setup();
    render(<CalculatorLayout {...baseProps} liveResults resultSection={results} />);
    expect(screen.queryByRole('button', { name: /Calculate/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /See results/ }));
    const resultsTab = screen.getByRole('tab', { name: /Results/ });
    expect(resultsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('results').parentElement).toHaveAttribute('id', resultsTab.getAttribute('aria-controls'));
    await user.click(screen.getByRole('button', { name: /Edit inputs/ }));
    expect(screen.getByRole('tab', { name: 'Inputs' })).toHaveAttribute('aria-selected', 'true');
  });

  it('does not switch tabs on its own while recalculating; showResultsKey does', () => {
    const { rerender } = render(<CalculatorLayout {...baseProps} liveResults isCalculating />);
    rerender(<CalculatorLayout {...baseProps} liveResults resultSection={results} />);
    rerender(<CalculatorLayout {...baseProps} liveResults resultSection={results} isCalculating />);
    rerender(<CalculatorLayout {...baseProps} liveResults resultSection={results} />);
    expect(screen.getByRole('tab', { name: 'Inputs' })).toHaveAttribute('aria-selected', 'true');

    rerender(<CalculatorLayout {...baseProps} liveResults resultSection={results} showResultsKey="arrived" />);
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists errors in the flow and counts them in the mobile bar', () => {
    render(
      <CalculatorLayout
        {...baseProps}
        liveResults
        resultSection={results}
        errors={{ a: 'First problem', b: 'Second problem' }}
      />
    );
    expect(screen.getByText('First problem')).toBeInTheDocument();
    expect(screen.getByText('2 fields need attention.')).toBeInTheDocument();
  });
});

describe('CalculatorLayout without liveResults', () => {
  it('reveals results on the first result and never renders a Share button', () => {
    const onShare = vi.fn();
    const { rerender } = render(<CalculatorLayout {...baseProps} onShare={onShare} />);
    expect(screen.getAllByRole('button', { name: /Calculate/ }).length).toBeGreaterThan(0);
    rerender(<CalculatorLayout {...baseProps} onShare={onShare} resultSection={<div>Results here</div>} />);
    expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    expect(onShare).not.toHaveBeenCalled();
  });

  it('runs onCalculate from the mobile bar and reports errors before calculating', async () => {
    const user = userEvent.setup();
    const onCalculate = vi.fn();
    const { rerender } = render(
      <CalculatorLayout {...baseProps} onCalculate={onCalculate} calculateButtonText="Run the numbers" />
    );
    const buttons = screen.getAllByRole('button', { name: /Run/ });
    await user.click(buttons[buttons.length - 1]);
    expect(onCalculate).toHaveBeenCalled();
    rerender(<CalculatorLayout {...baseProps} onCalculate={onCalculate} errors={{ a: 'Bad' }} />);
    expect(screen.getByText('1 field needs attention before calculating.')).toBeInTheDocument();
  });

  it('DisclaimerFooter is the shared Disclaimer', () => {
    render(<DisclaimerFooter text="Custom text." />);
    expect(screen.getByRole('note', { name: 'Disclaimer' })).toHaveTextContent('Disclaimer: Custom text.');
  });
});
