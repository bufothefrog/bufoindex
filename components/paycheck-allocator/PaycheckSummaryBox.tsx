import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyValueList, type KeyValueItem } from '@/components/ui/results';
import { paycheckSummary, type PaycheckSummary } from '@/lib/calculations/paycheckSummary';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { formatCurrency, formatPercent } from '@/lib/format';
import { PaycheckProfile } from '@/lib/types';
import { ChevronDown, ChevronUp, DollarSign, Building2, Calculator } from 'lucide-react';

export interface PaycheckSummaryBoxProps {
  profile: PaycheckProfile;
}

const MATCH_NOTE =
  'Pre-tax employer contribution, not from your paycheck \u2014 matching dollars go into the traditional 401k bucket even when your own deferral is Roth';

/** "6.0% contribution (pre-tax)" */
function deferralNote(rate: number, treatment: string): string {
  return `${formatPercent(rate, { digits: 1 })} contribution (${treatment})`;
}

/**
 * The gross-to-take-home rows of one paycheck. The taxes line is the residual
 * of the gross and take-home pay the visitor typed (paycheckSummary), so the
 * rows always sum to take-home.
 */
function breakdownItems(profile: PaycheckProfile, summary: PaycheckSummary): KeyValueItem[] {
  const { grossPaycheck, netPaycheck } = profile.income;
  const plan = profile.benefits.employer401k;
  const items: KeyValueItem[] = [
    { id: 'gross', icon: DollarSign, label: 'Gross Paycheck', value: grossPaycheck, format: 'currency', tone: 'info' },
  ];
  if (summary.traditional > 0) {
    items.push({
      id: 'traditional',
      icon: Building2,
      label: 'Traditional 401k',
      subtitle: deferralNote(plan.traditionalContribution, 'pre-tax'),
      value: summary.traditional,
      format: 'currency',
      prefix: '-',
      tone: 'positive',
    });
  }
  items.push({
    id: 'taxes',
    icon: Calculator,
    label: 'Taxes & Deductions',
    subtitle: 'Federal, State, FICA, Benefits',
    value: summary.residualTaxes,
    format: 'currency',
    prefix: '-',
    tone: 'negative',
  });
  if (summary.roth > 0) {
    items.push({
      id: 'roth',
      icon: Building2,
      label: 'Roth 401k',
      subtitle: deferralNote(plan.rothContribution, 'after-tax'),
      value: summary.roth,
      format: 'currency',
      prefix: '-',
      tone: 'info',
    });
  }
  items.push({ id: 'take-home', icon: DollarSign, label: 'Take-Home Pay', value: netPaycheck, format: 'currency' });
  if (summary.match > 0) {
    items.push({
      id: 'match',
      icon: Building2,
      label: 'Employer 401k Match',
      subtitle: MATCH_NOTE,
      value: summary.match,
      format: 'currency',
      prefix: '+',
      tone: 'positive',
    });
  }
  return items;
}

export const PaycheckSummaryBox = React.memo(function PaycheckSummaryBox({ profile }: PaycheckSummaryBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { grossPaycheck, netPaycheck, monthlyGross, monthlyNet, frequency } = profile.income;
  const summary = paycheckSummary(profile);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer py-2 px-3"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span>{PAY_FREQUENCY_META[frequency].label} Paycheck Breakdown</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              {`${formatCurrency(grossPaycheck)} \u2192 ${formatCurrency(netPaycheck)}`}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3 space-y-2">
          <KeyValueList items={breakdownItems(profile, summary)} />
          <KeyValueList
            layout="grid"
            className="mt-2 p-2 border border-border bg-muted/50 rounded-lg text-xs"
            items={[
              {
                id: 'monthly',
                label: 'Monthly equivalent',
                value: `Gross: ${formatCurrency(monthlyGross)} | Net: ${formatCurrency(monthlyNet)}`,
              },
              {
                id: 'effective-rate',
                label: 'Effective tax rate',
                value: formatPercent(summary.effectiveRate, { digits: 1 }),
              },
            ]}
          />
        </CardContent>
      )}
    </Card>
  );
});

export default PaycheckSummaryBox;
