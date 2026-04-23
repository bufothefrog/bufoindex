'use client';

import React from 'react';
import { AlertTriangle, Coins, Scissors, Settings2 } from 'lucide-react';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { cn } from '@/lib/utils';

/**
 * Global calculator settings — purchase mode, selling toggle, placement
 * advice toggle. Deposits live on AccountSection rows.
 */
export function SettingsCard() {
  const mode = usePortfolioRebalancingStore(s => s.inputs.mode);
  const allowTaxableSelling = usePortfolioRebalancingStore(s => s.inputs.allowTaxableSelling);
  const showPlacementAdvice = usePortfolioRebalancingStore(s => s.inputs.showPlacementAdvice);
  const setMode = usePortfolioRebalancingStore(s => s.setMode);
  const setAllowTaxableSelling = usePortfolioRebalancingStore(s => s.setAllowTaxableSelling);
  const setShowPlacementAdvice = usePortfolioRebalancingStore(s => s.setShowPlacementAdvice);

  return (
    <InputCard title="Settings" icon={Settings2}>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-medium">Purchase mode</div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Purchase mode">
            <ModeButton
              active={mode === 'whole'}
              onClick={() => setMode('whole')}
              icon={<Coins className="w-4 h-4" />}
              title="Whole shares"
              description="Floor to integers; leftover kept as cash."
              testId="mode-whole"
            />
            <ModeButton
              active={mode === 'fractional'}
              onClick={() => setMode('fractional')}
              icon={<Scissors className="w-4 h-4" />}
              title="Fractional"
              description="Exact-to-penny splits. Requires broker support."
              testId="mode-fractional"
            />
          </div>
        </div>

        <div className="space-y-3 pt-1 border-t border-border/60">
          <div className="flex items-start gap-3 pt-3">
            <input
              type="checkbox"
              id="allow-taxable-selling"
              checked={allowTaxableSelling}
              onChange={e => setAllowTaxableSelling(e.target.checked)}
              data-testid="toggle-allow-taxable-selling"
              className="w-4 h-4 mt-1 accent-sage-600"
            />
            <div className="flex-1">
              <label
                htmlFor="allow-taxable-selling"
                className="text-sm font-medium cursor-pointer"
              >
                Allow selling in taxable accounts
              </label>
              {allowTaxableSelling && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-orange-500 dark:text-orange-400" />
                  <span>Selling in taxable may trigger capital gains tax.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="show-placement-advice"
              checked={showPlacementAdvice}
              onChange={e => setShowPlacementAdvice(e.target.checked)}
              data-testid="toggle-placement-advice"
              className="w-4 h-4 mt-1 accent-sage-600"
            />
            <div className="flex-1">
              <label
                htmlFor="show-placement-advice"
                className="text-sm font-medium cursor-pointer"
              >
                Show tax-efficient placement advice
              </label>
              <div className="text-xs text-muted-foreground mt-0.5">
                Suggest which accounts each asset fits best, based on tax drag.
              </div>
            </div>
          </div>
        </div>
      </div>
    </InputCard>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

function ModeButton({ active, onClick, icon, title, description, testId }: ModeButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'text-left p-3 rounded-lg border transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 focus-visible:ring-offset-2',
        active
          ? 'border-sage-400 bg-sage-50 dark:bg-sage-800/50 dark:border-sage-500'
          : 'border-border bg-background hover:border-sage-300 dark:hover:border-sage-600',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 font-medium text-sm',
          active ? 'text-sage-700 dark:text-sage-200' : 'text-foreground',
        )}
      >
        {icon}
        {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  );
}
