'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, PiggyBank, Scale, Wallet } from 'lucide-react';
import { ResultCard, SummaryCard } from '@/components/ui/cards/BaseCard';
import { RebalanceResult } from '@/lib/calculations/portfolioRebalancing';
import { cn, formatCurrency } from '@/lib/utils';

interface RebalanceResultsProps {
  result: RebalanceResult;
}

function formatShares(n: number, mode: 'whole' | 'fractional'): string {
  if (mode === 'whole') return Math.round(n).toLocaleString('en-US');
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function formatPercentPoints(decimal: number, signed = false): string {
  const percent = decimal * 100;
  const rounded = Math.abs(percent) < 0.05 ? 0 : percent;
  const str = rounded.toFixed(1);
  if (signed && rounded > 0) return `+${str}%`;
  return `${str}%`;
}

export function RebalanceResults({ result }: RebalanceResultsProps) {
  const { assets, totalValueBefore, totalValueAfter, totalSpent, cashLeftover, totalDriftBefore, totalDriftAfter, taxEventDollars, mode } = result;

  const driftReduction = totalDriftBefore - totalDriftAfter;
  const driftReductionPct = totalDriftBefore > 0 ? (driftReduction / totalDriftBefore) * 100 : 0;

  return (
    <div className="space-y-6">
      {taxEventDollars > 0 && (
        <div
          role="alert"
          data-testid="tax-event-warning"
          className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/30 p-3 text-sm"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600 dark:text-orange-300" />
          <div className="text-orange-800 dark:text-orange-100">
            This plan sells {formatCurrency(taxEventDollars)} in taxable accounts. Review your cost basis to estimate the tax impact.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={Wallet}
          label="Invested"
          value={formatCurrency(totalSpent)}
          secondaryValue={`of ${formatCurrency(result.deposit)} deposit`}
        />
        <SummaryCard
          icon={PiggyBank}
          label="Cash leftover"
          value={formatCurrency(cashLeftover)}
          secondaryValue={
            cashLeftover > 0 ? 'Carry to next deposit' : 'Fully invested'
          }
        />
      </div>

      <ResultCard title="Purchase Plan" icon={ArrowRight} status="success" highlight>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="purchase-plan-table">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-2 font-medium">Asset</th>
                <th className="py-2 px-2 text-right font-medium">Action</th>
                <th className="py-2 px-2 text-right font-medium">Cost</th>
                <th className="py-2 pl-2 text-right font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => {
                const isSell = asset.action === 'sell';
                const isBuy = asset.action === 'buy';
                // Net cost is negative on sells (we receive cash), positive on buys.
                const netCost = isSell ? -asset.dollarsReceived : asset.dollarsSpent;
                return (
                  <tr
                    key={asset.id}
                    className="border-b border-border/50 last:border-b-0"
                    data-testid={`plan-row-${asset.id}`}
                  >
                    <td className="py-3 pr-2">
                      <div className="font-semibold tabular-nums">
                        {asset.ticker || '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(asset.price)}/share
                      </div>
                    </td>
                    <td
                      className={cn(
                        'py-3 px-2 text-right font-mono tabular-nums',
                        isBuy && 'text-sage-700 dark:text-sage-300',
                        isSell && 'text-orange-700 dark:text-orange-300',
                        !isBuy && !isSell && 'text-muted-foreground'
                      )}
                    >
                      {isBuy
                        ? `Buy ${formatShares(asset.sharesToBuy, mode)}`
                        : isSell
                        ? `Sell ${formatShares(asset.sharesToSell, mode)}`
                        : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-3 px-2 text-right font-mono tabular-nums',
                        isSell && 'text-orange-700 dark:text-orange-300'
                      )}
                    >
                      {isSell
                        ? `-${formatCurrency(asset.dollarsReceived)}`
                        : formatCurrency(netCost)}
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <div className="font-mono tabular-nums">
                        {formatPercentPoints(asset.newAllocation)}
                      </div>
                      <div
                        className={cn(
                          'text-xs tabular-nums',
                          Math.abs(asset.driftAfter) < 0.001
                            ? 'text-sage-600 dark:text-sage-300'
                            : asset.driftAfter > 0
                            ? 'text-orange-600 dark:text-orange-300'
                            : 'text-muted-foreground'
                        )}
                      >
                        target {formatPercentPoints(asset.targetAllocation)}
                        {Math.abs(asset.driftAfter) >= 0.001 && (
                          <> ({formatPercentPoints(asset.driftAfter, true)})</>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="pt-3 pr-2 font-semibold">Portfolio</td>
                <td className="pt-3 px-2"></td>
                <td className="pt-3 px-2 text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(totalSpent)}
                </td>
                <td className="pt-3 pl-2 text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(totalValueAfter)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ResultCard>

      <ResultCard title="Drift Reduction" icon={Scale}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total drift before</div>
              <div className="text-xl font-mono tabular-nums">{formatPercentPoints(totalDriftBefore)}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total drift after</div>
              <div className="text-xl font-mono tabular-nums text-sage-600 dark:text-sage-300">
                {formatPercentPoints(totalDriftAfter)}
              </div>
            </div>
          </div>
          {driftReduction > 0.0005 && (
            <div className="text-sm text-muted-foreground">
              This deposit closes <span className="text-foreground font-medium">{driftReductionPct.toFixed(0)}%</span> of the gap
              between your portfolio and its target allocation — without selling.
            </div>
          )}
        </div>
      </ResultCard>

      <div className="text-xs text-muted-foreground">
        Starting portfolio value: <span className="tabular-nums">{formatCurrency(totalValueBefore)}</span>
      </div>
    </div>
  );
}
