/**
 * The portfolio form's custom renderers, by renderer id (FieldSpec.renderer):
 * the holdings editor (every account's holdings, and the securities they
 * point to), the class-targets editor (the custom mix, and the custom asset
 * classes), this run's new cash per account, and the shared account list
 * (./accounts.tsx). The holdings and class-targets editors edit the
 * profile's portfolio lists through the pure reducers and write back every
 * list a reducer changed, so the relational rules (shared securities,
 * cascading removals) hold on the calculator page and in the wizard alike.
 * The wizard and the calculator page pick them up through RENDERERS in
 * ./index.ts.
 */

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { AccountSection } from '@/app/tools/portfolio-rebalancing-calculator/components/AccountSection';
import { TargetsCard } from '@/app/tools/portfolio-rebalancing-calculator/components/TargetsCard';
import { NullableField } from '@/components/fields/NullableField';
import type { CustomRendererProps, CustomRenderers } from '@/components/fields/types';
import { FieldMessages, fieldMessageIds } from '@/components/ui/FieldMessages';
import { MoneyInput } from '@/components/ui/inputs';
import { setNewCash } from '@/lib/calculators/portfolio/accountWrites';
import { classTargetsFor, engineHoldings, engineSecurities } from '@/lib/calculators/portfolio/bindings';
import { CLASS_TARGETS_RENDERER, HOLDINGS_RENDERER, NEW_CASH_RENDERER } from '@/lib/calculators/portfolio/fields';
import {
  portfolioWrites,
  readPortfolio,
  type Portfolio,
  type PortfolioUpdate,
} from '@/lib/calculators/portfolio/reducers';
import { calculatorHref } from '@/lib/calculators/registry';
import { listRows } from '@/lib/fields/runtime';
import { formatCurrency } from '@/lib/format';
import {
  ACCOUNT_PATHS,
  accountDisplayName,
  accountsInEffect,
  newCashFor,
  normalNewCash,
  rebalanceCandidates,
} from '@/lib/profile/accounts';
import type { FinancialProfile } from '@/lib/profile/types';
import { cn } from '@/lib/utils';
import { ACCOUNTS_RENDERERS } from './accounts';

/**
 * The portfolio lists on display, and an update that applies a reducer to
 * the latest lists (as of the last render, read when the update runs, so a
 * deferred callback such as the ticker's commit on blur never writes back
 * lists from an older render) and writes the lists it changed.
 */
function usePortfolio({ get, onWrite }: Pick<CustomRendererProps, 'get' | 'onWrite'>): [Portfolio, PortfolioUpdate] {
  const latest = useRef({ get, onWrite });
  useEffect(() => {
    latest.current = { get, onWrite };
  });
  const update = useCallback<PortfolioUpdate>((reduce) => {
    const before = readPortfolio(latest.current.get);
    const writes = portfolioWrites(before, reduce(before));
    if (writes.length > 0) latest.current.onWrite(writes);
  }, []);
  return [readPortfolio(get), update];
}

/** The holdings of every account in effect but cash accounts, one group per account, in account order. */
function HoldingsEditor({ spec, get, onWrite, error, size }: CustomRendererProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const { describedBy } = fieldMessageIds(id, undefined, error);
  const [portfolio, update] = usePortfolio({ get, onWrite });
  const classTargets = classTargetsFor(get) ?? portfolio.classTargets;
  const accounts = accountsInEffect(get).rows.filter((account) => account.kind !== 'cash');

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="space-y-3">
      <p id={labelId} className={cn(size === 'lg' ? 'text-base' : 'text-sm', 'font-medium leading-none')}>
        {spec.label}
      </p>
      {accounts.map((account, index) => (
        <AccountSection
          key={account.id}
          account={account}
          index={index}
          holdings={portfolio.holdings}
          securities={portfolio.securities}
          classTargets={classTargets}
          customAssetClasses={portfolio.customAssetClasses}
          update={update}
        />
      ))}
      <FieldMessages id={id} error={error} />
    </div>
  );
}

/**
 * Each asset class's portfolio-wide target, for the custom target mix. The
 * current mix it shows is that of the rebalanced accounts' holdings only.
 */
function ClassTargetsEditor({ spec, get, onWrite, error }: CustomRendererProps) {
  const [portfolio, update] = usePortfolio({ get, onWrite });
  return (
    <TargetsCard
      label={spec.label}
      holdings={engineHoldings(get)}
      securities={engineSecurities(get)}
      classTargets={portfolio.classTargets}
      customAssetClasses={portfolio.customAssetClasses}
      update={update}
      error={error}
    />
  );
}

/**
 * This run's new cash, one row per account the rebalancer can work on:
 * Auto is the account's normal contributions, Custom the visitor's own
 * figure (a portfolio.newCash row, kept until set back to Auto).
 */
function NewCashEditor({ spec, get, onWrite, error, size }: CustomRendererProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const { describedBy } = fieldMessageIds(id, undefined, error);
  const candidates = rebalanceCandidates(get);
  const overridden = new Set(listRows(get(ACCOUNT_PATHS.newCash)).map((row) => row.id));
  const write = (writes: ReturnType<typeof setNewCash>) => {
    if (writes.length > 0) onWrite(writes);
  };

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="space-y-4">
      <p id={labelId} className={cn(size === 'lg' ? 'text-base' : 'text-sm', 'font-medium leading-none')}>
        {spec.label}
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No account can take new cash.</p>
      ) : (
        candidates.map((account) => {
          const name = accountDisplayName(account);
          const normal = normalNewCash(get, account.id);
          return (
            <NullableField
              key={account.id}
              label={name}
              isAuto={!overridden.has(account.id)}
              autoLabel="Normal contributions"
              autoValue={formatCurrency(normal)}
              onAuto={() => write(setNewCash(get, account.id, null))}
              onCustom={() => write(setNewCash(get, account.id, normal))}
              size={size}
            >
              <MoneyInput
                name={`${id}-${account.id}`}
                label={name}
                value={newCashFor(get, account.id)}
                showZero
                onChange={(value) => write(setNewCash(get, account.id, value))}
                min={0}
              />
            </NullableField>
          );
        })
      )}
      <FieldMessages id={id} error={error} />
    </div>
  );
}

export const PORTFOLIO_RENDERERS: CustomRenderers = {
  ...ACCOUNTS_RENDERERS,
  [HOLDINGS_RENDERER]: HoldingsEditor,
  [CLASS_TARGETS_RENDERER]: ClassTargetsEditor,
  [NEW_CASH_RENDERER]: NewCashEditor,
};

/**
 * Where the portfolio intake leads once finished: the rebalancer, which reads
 * the saved profile itself, so the link carries only the handoff marker. The
 * wizard reads it through INTAKE_DESTINATION in ./index.ts.
 */
export const PORTFOLIO_INTAKE_DESTINATION: (profile: FinancialProfile) => string = () =>
  calculatorHref('portfolio', { fromProfile: true });
