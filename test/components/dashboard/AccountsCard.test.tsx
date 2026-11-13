/**
 * The overview Accounts card: one line per account, the invested total, and
 * the emergency fund line only while accounts hold the fund.
 */

import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountsCard } from '@/components/dashboard/AccountsCard';
import { reviewTopicEditHref } from '@/lib/calculators/profileReview';
import { getDefaultFinancialProfile, normalizeProfile } from '@/lib/profile/defaults';
import { withDerivedValues } from '@/lib/profile/derived';
import { ownerRaw } from '@/test/factories/accountsFixtures';

afterEach(cleanup);

const card = () => screen.getByTestId('overview-accounts');

describe('AccountsCard', () => {
  it('shows the example accounts and $25,000 invested, with no emergency fund line', () => {
    render(<AccountsCard profile={withDerivedValues(getDefaultFinancialProfile())} />);
    expect(within(card()).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '401(k) or similar $16,225',
      'Brokerage (taxable) $8,775 (3 holdings)',
    ]);
    expect(card()).toHaveTextContent('Invested $25,000');
    expect(card()).not.toHaveTextContent('Emergency fund:');
    expect(within(card()).getByRole('link', { name: 'Edit accounts' })).toHaveAttribute('href', reviewTopicEditHref('accounts'));
  });

  it('shows the owner accounts, $105,800 invested and the fund Robinhood holds', () => {
    render(<AccountsCard profile={withDerivedValues(normalizeProfile(ownerRaw()))} />);
    expect(within(card()).getAllByRole('listitem')).toHaveLength(5);
    expect(card()).toHaveTextContent('Robinhood $10,350 (1 holding) (emergency fund)');
    expect(card()).toHaveTextContent('Invested $105,800');
    expect(card()).toHaveTextContent('Emergency fund: Robinhood $10,350');
  });

  it('says No accounts for an empty answered list', () => {
    const profile = getDefaultFinancialProfile();
    profile.portfolio.accounts = [];
    profile.portfolio.holdings = [];
    profile.portfolio.securities = [];
    profile.provided = ['portfolio.accounts', 'portfolio.holdings', 'portfolio.securities'];
    render(<AccountsCard profile={withDerivedValues(profile)} />);
    expect(card()).toHaveTextContent('No accounts');
    expect(card()).toHaveTextContent('Invested $0');
  });
});
