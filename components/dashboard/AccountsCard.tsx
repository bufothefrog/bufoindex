import React from 'react';
import type { Route } from 'next';
import { Landmark } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { reviewTopicEditHref } from '@/lib/calculators/profileReview';
import { summarizeAccounts } from '@/lib/dashboard/derive';
import { ACCOUNTS_SCREEN } from '@/lib/fields/shared';
import { formatCurrency } from '@/lib/format';
import type { FinancialProfile } from '@/lib/profile/types';
import { CardLinkButton } from './CardLinkButton';

export interface AccountsCardProps {
  profile: FinancialProfile;
}

/**
 * The account list at a glance: one line per account (kind or name, value,
 * holdings), the invested total, and the emergency fund when accounts hold
 * it. Every figure comes from summarizeAccounts (lib/dashboard/derive.ts).
 */
export function AccountsCard({ profile }: AccountsCardProps) {
  const { lines, invested, emergencyFund } = summarizeAccounts(profile);

  return (
    <BaseCard title="Accounts" icon={Landmark} className="h-full" {...DENSE_CARD_CLASSES} testId="overview-accounts">
      <div className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts</p>
        ) : (
          <ul className="space-y-1 text-sm text-foreground">
            {lines.map((line, index) => (
              <li key={index} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 text-sm">
          <p className="text-foreground">
            Invested <span className="font-semibold tabular-nums">{formatCurrency(invested)}</span>
          </p>
          {emergencyFund.heldIn.length > 0 && (
            <p className="text-muted-foreground">
              Emergency fund: {emergencyFund.heldIn.join(', ')}{' '}
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(emergencyFund.balance)}</span>
            </p>
          )}
        </div>
        <CardLinkButton href={reviewTopicEditHref(ACCOUNTS_SCREEN.id) as Route}>Edit accounts</CardLinkButton>
      </div>
    </BaseCard>
  );
}

export default AccountsCard;
