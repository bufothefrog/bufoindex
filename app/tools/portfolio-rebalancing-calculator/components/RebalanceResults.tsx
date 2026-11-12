'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, Scale } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { ResultCard } from '@/components/ui/cards/BaseCard';
import { DataTable, KeyValueList, StatGrid, type DataTableColumn } from '@/components/ui/results';
import {
  AccountRebalanceSummary,
  ClassDrift,
  CustomAssetClass,
  HoldingRebalancePlan,
  RebalanceMode,
  RebalanceResultV2,
  getAssetClassLabel,
} from '@/lib/calculations/portfolioRebalancing';
import { PORTFOLIO_CASH_STAT_IDS, portfolioHeadline } from '@/lib/calculators/portfolio/headline';
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants/labels';
import { MISSING_VALUE } from '@/lib/design-system/stat';
import { TONE_TEXT } from '@/lib/design-system/tone';
import { formatCurrency, formatPercent, formatShares } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface RebalanceResultsProps {
  result: RebalanceResultV2;
  /** The custom classes of the inputs that produced `result`, for class labels. */
  customAssetClasses?: CustomAssetClass[];
}

/** A class within a tenth of a point of its target reads "on target". */
const ON_TARGET = 0.001;

/** Allocations and drift print with exactly one decimal ("60.0%"). */
function percentPoints(fraction: number): string {
  return formatPercent(fraction, { digits: 1 });
}

function planColumns(
  mode: RebalanceMode,
  customAssetClasses: CustomAssetClass[] | undefined,
  deposit: number
): DataTableColumn<HoldingRebalancePlan>[] {
  const shares = (n: number) => formatShares(n, { whole: mode === 'whole' });
  return [
    {
      id: 'holding',
      header: 'Holding',
      rowHeader: true,
      cell: (holding) => (
        <>
          <div className="font-semibold">{holding.ticker || MISSING_VALUE}</div>
          <div className="text-xs font-normal text-muted-foreground">
            {formatCurrency(holding.price)}/share {'\u00b7'} {getAssetClassLabel(holding.assetClass, customAssetClasses)}
          </div>
        </>
      ),
      footer: <span className="text-xs font-normal text-muted-foreground">Deposit</span>,
    },
    {
      id: 'action',
      header: 'Action',
      numeric: true,
      tone: (holding) => (holding.action === 'buy' ? 'brand' : holding.action === 'sell' ? 'caution' : undefined),
      cell: (holding) =>
        holding.action === 'buy' ? (
          `Buy ${shares(holding.sharesToBuy)}`
        ) : holding.action === 'sell' ? (
          `Sell ${shares(holding.sharesToSell)}`
        ) : (
          <span className="text-muted-foreground">{MISSING_VALUE}</span>
        ),
    },
    {
      id: 'dollars',
      header: 'Dollars',
      numeric: true,
      tone: (holding) => (holding.action === 'sell' ? 'caution' : undefined),
      cell: (holding) =>
        holding.action === 'sell'
          ? `-${formatCurrency(holding.dollarsReceived)}`
          : holding.action === 'buy'
            ? formatCurrency(holding.dollarsSpent)
            : MISSING_VALUE,
      footer: <span className="text-xs font-normal text-muted-foreground">{formatCurrency(deposit)}</span>,
    },
    { id: 'after', header: 'Value After', numeric: true, value: (holding) => holding.newValue, format: 'currency' },
  ];
}

interface DriftFigureProps {
  allocation: number;
  drift: number;
  /** Colors a drift above target in the caution tone (the after column). */
  flagOver?: boolean;
}

/** An allocation with its drift from target, or "on target", underneath. */
function DriftFigure({ allocation, drift, flagOver = false }: DriftFigureProps) {
  const onTarget = Math.abs(drift) < ON_TARGET;
  return (
    <>
      {percentPoints(allocation)}
      <div
        className={cn(
          'text-xs',
          onTarget
            ? TONE_TEXT.brand
            : flagOver && drift > 0
              ? TONE_TEXT.caution
              : 'text-muted-foreground'
        )}
      >
        {onTarget ? 'on target' : formatPercent(drift, { digits: 1, signed: drift > 0 })}
      </div>
    </>
  );
}

function driftColumns(customAssetClasses: CustomAssetClass[] | undefined): DataTableColumn<ClassDrift>[] {
  return [
    {
      id: 'class',
      header: 'Class',
      rowHeader: true,
      cell: (drift) => getAssetClassLabel(drift.assetClass, customAssetClasses),
    },
    { id: 'target', header: 'Target', numeric: true, cell: (drift) => percentPoints(drift.target) },
    {
      id: 'current',
      header: 'Current',
      numeric: true,
      cell: (drift) => <DriftFigure allocation={drift.currentAllocation} drift={drift.driftBefore} />,
    },
    {
      id: 'after',
      header: 'After',
      numeric: true,
      cell: (drift) => <DriftFigure allocation={drift.newAllocation} drift={drift.driftAfter} flagOver />,
    },
  ];
}

export function RebalanceResults({ result, customAssetClasses }: RebalanceResultsProps) {
  const { accounts, totalValueBefore, totalValueAfter, totalDriftBefore, totalDriftAfter, taxEventDollars, classDrift, mode } =
    result;

  const headline = portfolioHeadline(result);
  const cashStats = headline.filter((stat) => PORTFOLIO_CASH_STAT_IDS.includes(stat.id));
  const driftStats = headline.filter((stat) => !PORTFOLIO_CASH_STAT_IDS.includes(stat.id));

  const driftReduction = totalDriftBefore - totalDriftAfter;
  const driftReductionShare = totalDriftBefore > 0 ? driftReduction / totalDriftBefore : 0;

  const portfolioDrift = classDrift.filter((drift) => drift.accountId === null);

  return (
    <div className="space-y-6">
      {taxEventDollars > 0 && (
        <StatusAlert tone="caution" appearance="tinted" role="alert" icon={AlertTriangle} testId="tax-event-warning">
          This plan sells {formatCurrency(taxEventDollars)} in taxable accounts.
          Review your cost basis to estimate the tax impact.
        </StatusAlert>
      )}

      <StatGrid stats={cashStats} size="lg" align="center" />

      <div className="space-y-6">
        {accounts.map((account) => (
          <AccountPlan
            key={account.accountId}
            account={account}
            mode={mode}
            customAssetClasses={customAssetClasses}
          />
        ))}
      </div>

      {portfolioDrift.length > 0 && (
        <ResultCard title="Portfolio Drift by Class" icon={Scale}>
          <DataTable
            caption="Portfolio allocation by asset class: target, current and after this plan"
            columns={driftColumns(customAssetClasses)}
            rows={portfolioDrift}
            rowKey={(drift) => drift.assetClass}
            rowTestId={(drift) => `drift-row-portfolio-${drift.assetClass}`}
            testId="class-drift-table"
          />
        </ResultCard>
      )}

      <ResultCard title="Drift Reduction" icon={Scale}>
        <div className="space-y-3">
          <StatGrid stats={driftStats} />
          {driftReduction > 0.0005 && (
            <div className="text-sm text-muted-foreground">
              This deposit closes{' '}
              <span className="text-foreground font-medium">
                {formatPercent(driftReductionShare, { digits: 0 })}
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
            {'\u2192'} After:{' '}
            <span className="tabular-nums">{formatCurrency(totalValueAfter)}</span>
          </>
        )}
      </div>
    </div>
  );
}

interface AccountPlanProps {
  account: AccountRebalanceSummary;
  mode: RebalanceMode;
  customAssetClasses?: CustomAssetClass[];
}

function AccountPlan({ account, mode, customAssetClasses }: AccountPlanProps) {
  const { accountId, accountName, accountType, deposit, depositUsed, depositLeftover, holdings } = account;
  const title = `${accountName || 'Account'} \u2014 ${ACCOUNT_TYPE_LABELS[accountType]}`;

  return (
    <ResultCard title={title} icon={ArrowRight} tone="positive" testId={`account-plan-${accountId}`}>
      <div className="space-y-4">
        <KeyValueList
          className="grid grid-cols-2 gap-3 space-y-0"
          items={[
            { id: 'deposit-used', label: 'Deposit used', value: depositUsed, format: 'currency' },
            { id: 'leftover', label: 'Leftover', value: depositLeftover, format: 'currency' },
          ]}
        />
        <DataTable
          caption={`Trades in ${title}`}
          columns={planColumns(mode, customAssetClasses, deposit)}
          rows={holdings}
          rowKey={(holding) => holding.holdingId}
          rowTestId={(holding) => `plan-row-${holding.holdingId}`}
          empty="No holdings in this account."
        />
      </div>
    </ResultCard>
  );
}

export default RebalanceResults;
