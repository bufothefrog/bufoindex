'use client';

import React, { useMemo, useState } from 'react';
import { Landmark, Wallet } from 'lucide-react';
import { FieldSection } from '@/components/fields';
import { PORTFOLIO_RENDERERS } from '@/components/calculators/renderers/portfolio';
import AccountsCard from '@/components/dashboard/AccountsCard';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { addAccountRow, setAccountField, setHoldsEmergencyFund } from '@/lib/calculators/portfolio/accountWrites';
import { PORTFOLIO_FORM } from '@/lib/calculators/portfolio/form';
import { makeGet } from '@/lib/fields/paths';
import { ACCOUNTS_SCREEN } from '@/lib/fields/shared';
import type { Get, ScreenSpec, Write } from '@/lib/fields/types';
import { applyProfileWrites, getDefaultFinancialProfile } from '@/lib/profile/defaults';
import { withDerivedValues } from '@/lib/profile/derived';
import type { FinancialProfile } from '@/lib/profile/types';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

export type AccountsSampleKey = 'example' | 'emergency-fund';

const SAMPLE_OPTIONS: readonly SegmentedControlOption<AccountsSampleKey>[] = [
  { value: 'example', label: 'Example profile' },
  { value: 'emergency-fund', label: 'Emergency fund account' },
];

/** The name of the synthetic emergency fund account in the second sample. */
export const SAMPLE_EMERGENCY_FUND_NAME = 'Savings brokerage';

/**
 * Applies writes to a sample profile and marks the accepted paths answered,
 * as the profile store does, so the account list leaves its example filter
 * after the first edit. Nothing here touches the visitor's saved profile.
 */
function applySampleWrites(profile: FinancialProfile, writes: readonly Write[]): FinancialProfile {
  const { profile: next, accepted } = applyProfileWrites(profile, writes);
  return { ...next, provided: [...new Set([...next.provided, ...accepted])] };
}

/** One account action on the derived view of a sample, as a calculator page runs it. */
function step(profile: FinancialProfile, writes: (get: Get) => readonly Write[]): FinancialProfile {
  return applySampleWrites(profile, writes(makeGet(withDerivedValues(profile))));
}

/**
 * The synthetic samples: the default profile (an example 401(k) with a typed
 * balance and an example brokerage with three holdings), and the same
 * profile with an added empty brokerage ticked "Holds my emergency fund",
 * which copies the emergency fund answer into its balance.
 */
export function accountsSample(key: AccountsSampleKey): FinancialProfile {
  const base = getDefaultFinancialProfile();
  if (key === 'example') return base;
  let id = '';
  let profile = step(base, (get) => {
    const added = addAccountRow(get, 'brokerage');
    id = added.id;
    return added.writes;
  });
  profile = step(profile, (get) => setAccountField(get, id, { name: SAMPLE_EMERGENCY_FUND_NAME }));
  return step(profile, (get) => setHoldsEmergencyFund(get, id, true));
}

function screenById(id: string): ScreenSpec {
  const screen = PORTFOLIO_FORM.screens.find((each) => each.id === id);
  if (!screen) throw new Error(`The portfolio form has no '${id}' screen.`);
  return screen;
}

const NEW_CASH_SCREEN = screenById('new-cash');

/**
 * The account list, the rebalancer's new-cash card and the overview Accounts
 * card on a synthetic sample profile held in this tab's own state.
 */
export default function AccountsSection() {
  const [sample, setSample] = useState<AccountsSampleKey>('example');
  const [profile, setProfile] = useState<FinancialProfile>(() => accountsSample('example'));
  const [accountsCollapsed, setAccountsCollapsed] = useState(false);
  const [newCashCollapsed, setNewCashCollapsed] = useState(false);
  const get = useMemo(() => makeGet(withDerivedValues(profile)), [profile]);
  const onWrite = (writes: Write[]) => setProfile((current) => applySampleWrites(current, writes));

  const chooseSample = (key: AccountsSampleKey) => {
    setSample(key);
    setProfile(accountsSample(key));
  };

  return (
    <DemoSection
      title="Accounts"
      intro="One account list is the record of what a visitor owns; balances, the emergency fund and new cash are read from it."
    >
      <SegmentedControl label="Sample profile" options={SAMPLE_OPTIONS} value={sample} onChange={chooseSample} />

      <DemoBlock title="Account list" icon={Landmark}>
        <DemoEntry
          name="Accounts screen (renderer 'accounts')"
          description={
            <>
              The shared <Code>ACCOUNTS</Code> field: one line per account with the kind, the name and the value. The value
              is an inline balance while the holdings are worth $0, otherwise read-only. Edit shows the kind, the name, the
              emergency fund tick (brokerage only) and the switch between one balance and holdings. Collapsed, the card
              reads <Code>accountsSummary</Code>.
            </>
          }
        >
          <FieldSection
            form={PORTFOLIO_FORM}
            screen={ACCOUNTS_SCREEN}
            get={get}
            errors={{}}
            onWrite={onWrite}
            renderers={PORTFOLIO_RENDERERS}
            collapsed={accountsCollapsed}
            onToggle={() => setAccountsCollapsed((c) => !c)}
          />
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="New cash and the overview" icon={Wallet}>
        <DemoEntry
          name="New cash this month (renderer 'portfolio-new-cash')"
          description={
            <>
              Calculator-only. One row per account the rebalancer can work on: Auto is the account&apos;s normal
              contributions (<Code>normalNewCash</Code>), Custom stores a <Code>portfolio.newCash</Code> row. The note
              lists the accounts left out and why.
            </>
          }
        >
          <FieldSection
            form={PORTFOLIO_FORM}
            screen={NEW_CASH_SCREEN}
            get={get}
            errors={{}}
            onWrite={onWrite}
            renderers={PORTFOLIO_RENDERERS}
            collapsed={newCashCollapsed}
            onToggle={() => setNewCashCollapsed((c) => !c)}
          />
        </DemoEntry>
        <DemoEntry
          name="AccountsCard"
          description={
            <>
              The overview card: <Code>accountLines</Code>, the invested total, and the emergency fund when accounts hold
              it, all from <Code>summarizeAccounts</Code>.
            </>
          }
        >
          <AccountsCard profile={profile} />
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}
