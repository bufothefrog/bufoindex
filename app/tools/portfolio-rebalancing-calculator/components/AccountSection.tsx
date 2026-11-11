'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Account,
  ClassTarget,
  CustomAssetClass,
  Holding,
  Security,
} from '@/lib/calculations/portfolioRebalancing';
import { accountLabel } from '@/lib/calculators/portfolio/fields';
import {
  addHolding,
  linkHoldingByTicker,
  linkHoldingToSecurity,
  removeHolding,
  updateHolding,
  updateSecurity,
  type PortfolioUpdate,
} from '@/lib/calculators/portfolio/reducers';
import { cn } from '@/lib/utils';
import { HoldingRow } from './HoldingRow';

export interface AccountSectionProps {
  account: Account;
  /** The account's place in the accounts list (its label and test ids). */
  index: number;
  /** Every holding of the portfolio; the section shows the account's own. */
  holdings: Holding[];
  securities: Security[];
  classTargets: ClassTarget[];
  customAssetClasses: CustomAssetClass[];
  /** Applies one reducer to the portfolio lists. */
  update: PortfolioUpdate;
  className?: string;
}

/** One account's holdings, each a HoldingRow, with Add holding. */
export function AccountSection({
  account,
  index,
  holdings: allHoldings,
  securities,
  classTargets,
  customAssetClasses,
  update,
  className,
}: AccountSectionProps) {
  const holdings = allHoldings.filter(h => h.accountId === account.id);
  const title = accountLabel(account, index);

  return (
    <section
      aria-label={`${title} holdings`}
      className={cn(
        'rounded-lg border border-border bg-background p-4 space-y-3',
        className,
      )}
      data-testid={`account-section-${index}`}
    >
      <div className="text-sm font-medium text-foreground">{title}</div>

      {holdings.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No holdings yet. Add one below.
        </div>
      ) : (
        <div className="space-y-2">
          {holdings.map(holding => {
            const security = securities.find(s => s.id === holding.securityId) ?? null;
            const globalIndex = allHoldings.findIndex(h => h.id === holding.id);
            return (
              <HoldingRow
                key={holding.id}
                holding={holding}
                security={security}
                securities={securities}
                index={globalIndex}
                canRemove
                classTargets={classTargets}
                customAssetClasses={customAssetClasses}
                onChangeHolding={patch => update(p => updateHolding(p, holding.id, patch))}
                onChangeSecurity={patch => {
                  if (holding.securityId) update(p => updateSecurity(p, holding.securityId, patch));
                }}
                onSelectSecurity={securityId =>
                  update(p => linkHoldingToSecurity(p, holding.id, securityId))
                }
                onCommitTicker={ticker => update(p => linkHoldingByTicker(p, holding.id, ticker))}
                onRemove={() => {
                  const label = security?.ticker || `holding ${globalIndex + 1}`;
                  if (window.confirm(`Delete ${label}?`)) {
                    update(p => removeHolding(p, holding.id));
                  }
                }}
              />
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => update(p => addHolding(p, account.id))}
        className="gap-2"
        data-testid={`add-holding-${index}`}
      >
        <Plus className="w-4 h-4" />
        Add holding
      </Button>
    </section>
  );
}
