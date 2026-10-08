'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  PiggyBank,
  Scale,
  Wallet,
} from 'lucide-react';
import { ResultCard, SummaryCard } from '@/components/ui/cards/BaseCard';
import {
  AccountType,
  AccountRebalanceSummary,
  ClassDrift,
  CustomAssetClass,
  HoldingRebalancePlan,
  RebalanceMode,
  RebalanceResultV2,
  getAssetClassLabel,
} from '@/lib/calculations/portfolioRebalancing';
import {
  selectCustomAssetClasses,
  usePortfolioRebalancingStore,
} from '@/lib/store/portfolioRebalancingStore';
import { cn, formatCurrency } from '@/lib/utils';

interface RebalanceResultsProps {
  result: RebalanceResultV2;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  'taxable': 'Taxable',
  'tax-deferred': 'Tax-Deferred',
  'tax-free': 'Tax-Free',
};

function formatShares(n: number, mode: RebalanceMode): string {
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
  const customAssetClasses = usePortfolioRebalancingStore(selectCustomAssetClasses);
  const {
    accounts,
    totalValueBefore,
    totalValueAfter,
    totalDeposit,
    totalSpent,
    cashLeftover,
    totalDriftBefore,
    totalDriftAfter,
    taxEventDollars,
    classDrift,
    mode,
  } = result;

  const driftReduction = totalDriftBefore - totalDriftAfter;
  const driftReductionPct =
    totalDriftBefore > 0 ? (driftReduction / totalDriftBefore) * 100 : 0;

  const portfolioDrift = classDrift.filter(d => d.accountId === null);

  return (
    <div className="space-y-6">
      {taxEventDollars > 0 && (
        <div
          role="alert"
          data-testid="tax-event-warning"
          className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
          <div className="text-foreground">
            This plan sells {formatCurrency(taxEventDollars)} in taxable accounts.
            Review your cost basis to estimate the tax impact.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={Wallet}
          label="Invested"
          value={formatCurrency(totalSpent)}
          secondaryValue={`of ${formatCurrency(totalDeposit)} deposit`}
        />
        <SummaryCard
          icon={PiggyBank}
          label="Cash leftover"
          value={formatCurrency(cashLeftover)}
          secondaryValue={cashLeftover > 0 ? 'Carry to next deposit' : 'Fully invested'}
        />
      </div>

      <div className="space-y-6">
        {accounts.map(account => (
          <AccountPlanBlock
            key={account.accountId}
            account={account}
            mode={mode}
            classDrift={[]}
            showDrift={false}
            customAssetClasses={customAssetClasses}
          />
        ))}
      </div>
      {portfolioDrift.length > 0 && (
        <ClassDriftCard
          title="Portfolio Drift by Class"
          drifts={portfolioDrift}
          customAssetClasses={customAssetClasses}
        />
      )}

      <ResultCard title="Drift Reduction" icon={Scale}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total drift before</div>
              <div className="text-xl font-mono tabular-nums">
                {formatPercentPoints(totalDriftBefore)}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total drift after</div>
              <div className="text-xl font-mono tabular-nums text-sage-600 dark:text-sage-300">
                {formatPercentPoints(totalDriftAfter)}
              </div>
            </div>
          </div>
          {driftReduction > 0.0005 && (
            <div className="text-sm text-muted-foreground">
              This deposit closes{' '}
              <span className="text-foreground font-medium">
                {driftReductionPct.toFixed(0)}%
              </span>{' '}
              of the gap between your portfolio and its target allocation.
            </div>
          )}
        </div>
      </ResultCard>

      <div className="text-xs text-muted-foreground">
        Starting portfolio value:{' '}
        <span className="tabular-nums">{formatCurrency(totalValueBefore)}</span>
        {totalValueAfter !== totalValueBefore && (
          <>
            {' '}
            → After:{' '}
            <span className="tabular-nums">{formatCurrency(totalValueAfter)}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface AccountPlanBlockProps {
  account: AccountRebalanceSummary;
  mode: RebalanceMode;
  classDrift: ClassDrift[];
  showDrift: boolean;
  customAssetClasses: CustomAssetClass[];
}

function AccountPlanBlock({
  account,
  mode,
  classDrift,
  showDrift,
  customAssetClasses,
}: AccountPlanBlockProps) {
  const { accountName, accountType, deposit, depositUsed, depositLeftover, holdings } = account;

  return (
    <ResultCard
      title={`${accountName || 'Account'} — ${ACCOUNT_TYPE_LABELS[accountType]}`}
      icon={ArrowRight}
      status="success"
      testId={`account-plan-${account.accountId}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between p-2 rounded bg-muted/40">
            <span className="text-muted-foreground">Deposit used</span>
            <span className="font-mono tabular-nums">{formatCurrency(depositUsed)}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-muted/40">
            <span className="text-muted-foreground">Leftover</span>
            <span className="font-mono tabular-nums">{formatCurrency(depositLeftover)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-2 font-medium">Holding</th>
                <th className="py-2 px-2 text-right font-medium">Action</th>
                <th className="py-2 px-2 text-right font-medium">Dollars</th>
                <th className="py-2 pl-2 text-right font-medium">Value After</th>
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No holdings in this account.
                  </td>
                </tr>
              ) : (
                holdings.map(holding => (
                  <HoldingPlanRow
                    key={holding.holdingId}
                    holding={holding}
                    mode={mode}
                    customAssetClasses={customAssetClasses}
                  />
                ))
              )}
            </tbody>
            {holdings.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="pt-2 pr-2 text-xs text-muted-foreground">Deposit</td>
                  <td className="pt-2 px-2"></td>
                  <td className="pt-2 px-2 text-right font-mono tabular-nums text-xs text-muted-foreground">
                    {formatCurrency(deposit)}
                  </td>
                  <td className="pt-2 pl-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {showDrift && classDrift.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <div className="text-xs font-medium uppercase text-muted-foreground mb-2">
              Account Drift
            </div>
            <ClassDriftTable
              drifts={classDrift}
              customAssetClasses={customAssetClasses}
            />
          </div>
        )}
      </div>
    </ResultCard>
  );
}

interface HoldingPlanRowProps {
  holding: HoldingRebalancePlan;
  mode: RebalanceMode;
  customAssetClasses: CustomAssetClass[];
}

function HoldingPlanRow({ holding, mode, customAssetClasses }: HoldingPlanRowProps) {
  const { ticker, price, action, sharesToBuy, sharesToSell, dollarsSpent, dollarsReceived, newValue } = holding;
  const isSell = action === 'sell';
  const isBuy = action === 'buy';
  return (
    <tr
      className="border-b border-border/50 last:border-b-0"
      data-testid={`plan-row-${holding.holdingId}`}
    >
      <td className="py-3 pr-2">
        <div className="font-semibold tabular-nums">{ticker || '—'}</div>
        <div className="text-xs text-muted-foreground">
          {formatCurrency(price)}/share · {getAssetClassLabel(holding.assetClass, customAssetClasses)}
        </div>
      </td>
      <td
        className={cn(
          'py-3 px-2 text-right font-mono tabular-nums',
          isBuy && 'text-sage-700 dark:text-sage-300',
          isSell && 'text-warning',
          !isBuy && !isSell && 'text-muted-foreground'
        )}
      >
        {isBuy
          ? `Buy ${formatShares(sharesToBuy, mode)}`
          : isSell
          ? `Sell ${formatShares(sharesToSell, mode)}`
          : '—'}
      </td>
      <td
        className={cn(
          'py-3 px-2 text-right font-mono tabular-nums',
          isSell && 'text-warning'
        )}
      >
        {isSell
          ? `-${formatCurrency(dollarsReceived)}`
          : isBuy
          ? formatCurrency(dollarsSpent)
          : '—'}
      </td>
      <td className="py-3 pl-2 text-right font-mono tabular-nums">
        {formatCurrency(newValue)}
      </td>
    </tr>
  );
}

interface ClassDriftCardProps {
  title: string;
  drifts: ClassDrift[];
  customAssetClasses: CustomAssetClass[];
}

function ClassDriftCard({ title, drifts, customAssetClasses }: ClassDriftCardProps) {
  return (
    <ResultCard title={title} icon={Scale}>
      <ClassDriftTable drifts={drifts} customAssetClasses={customAssetClasses} />
    </ResultCard>
  );
}

interface ClassDriftTableProps {
  drifts: ClassDrift[];
  customAssetClasses: CustomAssetClass[];
}

function ClassDriftTable({ drifts, customAssetClasses }: ClassDriftTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="class-drift-table">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            <th className="py-2 pr-2 font-medium">Class</th>
            <th className="py-2 px-2 text-right font-medium">Target</th>
            <th className="py-2 px-2 text-right font-medium">Current</th>
            <th className="py-2 pl-2 text-right font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {drifts.map(d => (
            <tr
              key={`${d.accountId ?? 'portfolio'}-${d.assetClass}`}
              className="border-b border-border/50 last:border-b-0"
              data-testid={`drift-row-${d.accountId ?? 'portfolio'}-${d.assetClass}`}
            >
              <td className="py-2 pr-2 font-medium">{getAssetClassLabel(d.assetClass, customAssetClasses)}</td>
              <td className="py-2 px-2 text-right font-mono tabular-nums">
                {formatPercentPoints(d.target)}
              </td>
              <td className="py-2 px-2 text-right font-mono tabular-nums">
                {formatPercentPoints(d.currentAllocation)}
                <div
                  className={cn(
                    'text-xs',
                    Math.abs(d.driftBefore) < 0.001
                      ? 'text-sage-600 dark:text-sage-300'
                      : 'text-muted-foreground'
                  )}
                >
                  {Math.abs(d.driftBefore) >= 0.001
                    ? formatPercentPoints(d.driftBefore, true)
                    : 'on target'}
                </div>
              </td>
              <td className="py-2 pl-2 text-right font-mono tabular-nums">
                {formatPercentPoints(d.newAllocation)}
                <div
                  className={cn(
                    'text-xs',
                    Math.abs(d.driftAfter) < 0.001
                      ? 'text-sage-600 dark:text-sage-300'
                      : d.driftAfter > 0
                      ? 'text-warning'
                      : 'text-muted-foreground'
                  )}
                >
                  {Math.abs(d.driftAfter) >= 0.001
                    ? formatPercentPoints(d.driftAfter, true)
                    : 'on target'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
