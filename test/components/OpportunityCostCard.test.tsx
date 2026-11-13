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
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { OpportunityCostCard } from '@/components/shared/cards/OpportunityCostCard';
import { usePreferencesStore } from '@/lib/store/preferencesStore';
import type { SkippedItem } from '@/lib/types';
import { identifySkippedOptimizations } from '@/lib/calculations/analysis';
import { createPaycheckProfile, createUserPreferences } from '@/test/factories/test-data-factory';

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

// The one site-wide dollar mode starts at its default ('today') in every test.
beforeEach(() => {
  window.localStorage.removeItem('bufo-preferences');
  usePreferencesStore.getState().setDisplayMode('today');
});

describe('OpportunityCostCard', () => {
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

      expect(screen.getByText("cost over 10 years (today's $)")).toBeInTheDocument();
      // 4,200 / 1.03^10 = 3,125.18
      expect(screen.getByText('$3,125')).toBeInTheDocument();
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

      expect(screen.getByText("cost over 20 years (today's $)")).toBeInTheDocument();
      // 12,000 / 1.03^20 = 6,644.27
      expect(screen.getByText('$6,644')).toBeInTheDocument();
      expect(screen.queryByText(/cost over 10 years/)).not.toBeInTheDocument();
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
      alternative: 'Build cash toward your 3-month target ($9,000)',
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
        screen.getByText('Build cash toward your 3-month target ($9,000)')
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

  describe('dollar display mode', () => {
    /** The highlighted figure: the one dollar amount that is not the $25 monthly or $300 annual row. */
    function highlighted(): number {
      const amounts = screen
        .getAllByText(/^\$[\d,]+$/)
        .map((element) => Number((element.textContent ?? '').replace(/[$,]/g, '')))
        .filter((amount) => amount !== 25 && amount !== 300);
      expect(amounts).toHaveLength(1);
      return amounts[0];
    }

    it.each([
      ['10-year', { monthly: 25, annual: 300, tenYear: 4200 }, 4200, 10],
      ['20-year', { monthly: 25, annual: 300, tenYear: 4200, twentyYear: 12000 }, 12000, 20],
    ] as const)('shows the same %s cost deflated by 1.03 per year, or as computed in future dollars', (_, costs, nominal, years) => {
      renderCard(createSkippedItem({ opportunityCost: { ...costs } }));
      const today = highlighted();
      expect(today).toBeCloseTo(nominal / 1.03 ** years, -1);

      act(() => usePreferencesStore.getState().setDisplayMode('nominal'));
      expect(highlighted()).toBe(nominal);
      expect(screen.getByText(`cost over ${years} years (future $)`)).toBeInTheDocument();
      expect(today).not.toBe(nominal);
    });

    it("engine output: the Why This Matters text names no figure; the headline alone follows the mode", () => {
      // A 21,000 fund against a 9,000 target: the 12,000 excess at 4.5% APY
      // costs 12000 * (1.07^10 - 1.045^10) = 4,970.18 over 10 years.
      const item = identifySkippedOptimizations(
        createPaycheckProfile({ preferences: createUserPreferences({ currentEmergencyFund: 21000 }) })
      ).find((skipped) => skipped.id === 'excessive-emergency-fund')!;
      renderCard(item);
      const why = screen.getByText(/the 10-year cost is shown above/);
      expect(why.textContent).not.toContain('$');
      // today's dollars: 4,970.18 / 1.03^10 = 3,698.25
      expect(screen.getByText('$3,698')).toBeInTheDocument();
      expect(screen.queryByText(/4,970/)).not.toBeInTheDocument();
      act(() => usePreferencesStore.getState().setDisplayMode('nominal'));
      expect(screen.getByText('$4,970')).toBeInTheDocument();
      expect(screen.getByText(/the 10-year cost is shown above/).textContent).not.toContain('$');
    });

    it('leaves an annual cost and the monthly and annual rows as computed (current-year money)', () => {
      renderCard(createSkippedItem({ opportunityCost: { monthly: 25, annual: 300 } }));
      expect(screen.getAllByText('$300').length).toBeGreaterThan(0);
      expect(screen.getByText('annual cost')).toBeInTheDocument();
      act(() => usePreferencesStore.getState().setDisplayMode('nominal'));
      expect(screen.getByText('annual cost')).toBeInTheDocument();
      expect(screen.getAllByText('$300').length).toBeGreaterThan(0);
    });
  });
});
