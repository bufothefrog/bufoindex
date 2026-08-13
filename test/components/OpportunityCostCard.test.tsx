/**
 * OpportunityCostCard Component Test Suite
 *
 * The card summarizes an optimization the allocator deprioritized. Three
 * things have to hold for the summary to be honest and readable:
 *   1. a zero opportunity cost never renders as a dollar claim,
 *   2. the horizon subtext is grammatical for every horizon analysis.ts emits
 *      (annual, ten-year, twenty-year),
 *   3. the risk level reads as copy rather than as a raw enum value.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpportunityCostCard } from '@/components/shared/cards/OpportunityCostCard';
import type { SkippedItem } from '@/lib/types';

function createSkippedItem(overrides: Partial<SkippedItem> = {}): SkippedItem {
  return {
    id: 'skipped-item',
    item: 'Extra Mortgage Payment',
    reason: '3% effective rate vs 7% expected market return',
    opportunityCost: {
      monthly: 25,
      annual: 300,
    },
    alternative: 'Pay the minimum and invest the extra $500/month',
    riskLevel: 'low',
    ...overrides,
  };
}

/** Renders the card expanded so the detail rows are in the DOM. */
function renderCard(skippedItem: SkippedItem) {
  return render(
    <OpportunityCostCard
      skippedItem={skippedItem}
      showDetails
      onToggleDetails={vi.fn()}
    />
  );
}

describe('OpportunityCostCard', () => {
  afterEach(() => {
    cleanup();
  });

  describe('horizon phrasing', () => {
    it('labels an annual-only cost as "annual cost", not "cost over annually"', () => {
      renderCard(
        createSkippedItem({ opportunityCost: { monthly: 25, annual: 300 } })
      );

      expect(screen.getByText('annual cost')).toBeInTheDocument();
      expect(screen.queryByText(/cost over annually/i)).not.toBeInTheDocument();
    });

    it('labels a ten-year cost as "cost over 10 years"', () => {
      renderCard(
        createSkippedItem({
          opportunityCost: { monthly: 25, annual: 300, tenYear: 4200 },
        })
      );

      expect(screen.getByText('cost over 10 years')).toBeInTheDocument();
      expect(screen.getByText('$4,200')).toBeInTheDocument();
    });

    it('labels a twenty-year cost as "cost over 20 years" and prefers it over shorter horizons', () => {
      renderCard(
        createSkippedItem({
          opportunityCost: {
            monthly: 25,
            annual: 300,
            tenYear: 4200,
            twentyYear: 12000,
          },
        })
      );

      expect(screen.getByText('cost over 20 years')).toBeInTheDocument();
      expect(screen.getByText('$12,000')).toBeInTheDocument();
      expect(screen.queryByText('cost over 10 years')).not.toBeInTheDocument();
    });
  });

  describe('zero opportunity cost', () => {
    // analysis.ts emits the "Insufficient Emergency Fund" note with a zero
    // opportunity cost: the note is about risk, not forgone dollars.
    const zeroCostItem = createSkippedItem({
      id: 'no-emergency-fund',
      item: 'Insufficient Emergency Fund',
      reason: 'Less than 1 month of expenses saved increases financial risk',
      opportunityCost: { monthly: 0, annual: 0 },
      alternative: 'Build 1-month emergency fund first',
      riskLevel: 'high',
    });

    it('renders no dollar figure or horizon subtext', () => {
      renderCard(zeroCostItem);

      expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/cost over/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/annual cost/i)).not.toBeInTheDocument();
    });

    it('drops the Monthly/Annual rows in favor of an explicit note', () => {
      renderCard(zeroCostItem);

      expect(screen.queryByText(/Monthly:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Annual:/)).not.toBeInTheDocument();
      expect(
        screen.getByText('No dollar opportunity cost is modeled for this item.')
      ).toBeInTheDocument();
    });

    it('keeps the "Why skip this" / "Do this instead" structure', () => {
      renderCard(zeroCostItem);

      expect(screen.getByText('Why skip this')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Less than 1 month of expenses saved increases financial risk'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Do this instead')).toBeInTheDocument();
      expect(
        screen.getByText('Build 1-month emergency fund first')
      ).toBeInTheDocument();
    });

    it('hides only the zero row when one of the two has a value', () => {
      renderCard(
        createSkippedItem({ opportunityCost: { monthly: 0, annual: 300 } })
      );

      expect(screen.queryByText(/Monthly:/)).not.toBeInTheDocument();
      expect(screen.getByText(/Annual:/).textContent).toContain('$300');
    });
  });

  describe('risk level', () => {
    it.each([
      ['low', 'Risk level: Low'],
      ['medium', 'Risk level: Medium'],
      ['high', 'Risk level: High'],
    ] as const)('renders %s risk as readable copy', (riskLevel, expected) => {
      renderCard(createSkippedItem({ riskLevel }));

      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.queryByText(/risk optimization/i)).not.toBeInTheDocument();
    });
  });
});
