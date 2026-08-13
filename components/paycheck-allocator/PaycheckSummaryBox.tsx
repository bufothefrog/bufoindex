import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaycheckProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronUp, DollarSign, Building2, Calculator } from 'lucide-react';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';

interface PaycheckSummaryBoxProps {
  profile: PaycheckProfile;
}

export const PaycheckSummaryBox = React.memo(function PaycheckSummaryBox({ profile }: PaycheckSummaryBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate employee contributions that are deducted from paycheck
  const traditionalEmployeeContribution = profile.benefits.employer401k.available
    ? (profile.income.grossPaycheck * profile.benefits.employer401k.traditionalContribution)
    : 0;

  // Calculate employer match (NOT deducted from paycheck - it's additional)
  const employerMatch = profile.benefits.employer401k.available
    ? Math.min(
        profile.income.grossPaycheck * (profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution),
        profile.income.grossPaycheck * profile.benefits.employer401k.matchLimit
      ) * profile.benefits.employer401k.matchPercent
    : 0;

  // Only employee traditional contributions reduce taxable income from paycheck
  const pretaxDeductionsFromPaycheck = traditionalEmployeeContribution;

  // Calculate Roth contributions (after-tax)
  const rothContribution = profile.benefits.employer401k.available
    ? (profile.income.grossPaycheck * profile.benefits.employer401k.rothContribution)
    : 0;

  // Taxes and other deductions as a residual. The take-home the user typed
  // already has EVERY employee 401k deferral withheld by payroll — the pre-tax
  // traditional deferral AND the after-tax Roth deferral — so both must come
  // out of the residual, or the Roth line double-counts and the rows stop
  // summing to take-home (and the "tax rate" silently absorbs the deferral).
  const totalTaxAndDeductions = Math.max(
    0,
    profile.income.grossPaycheck -
      pretaxDeductionsFromPaycheck -
      rothContribution -
      profile.income.netPaycheck
  );

  // Calculate effective tax rate (tax/taxable income, where taxable = gross - employee pre-tax deductions)
  const taxableIncome = profile.income.grossPaycheck - pretaxDeductionsFromPaycheck;
  const effectiveTaxRate = taxableIncome > 0
    ? (totalTaxAndDeductions / taxableIncome) * 100
    : 0;

  const getFrequencyText = () => {
    switch (profile.income.frequency) {
      case 'weekly': return 'Weekly';
      case 'bi-weekly': return 'Bi-Weekly';
      case 'semi-monthly': return 'Semi-Monthly';
      case 'monthly': return 'Monthly';
    }
  };

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
            <span>{getFrequencyText()} Paycheck Breakdown</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              {formatCurrency(profile.income.grossPaycheck)} → {formatCurrency(profile.income.netPaycheck)}
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
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Gross Paycheck */}
            <BreakdownRow
              icon={DollarSign}
              label="Gross Paycheck"
              value={formatCurrency(profile.income.grossPaycheck)}
              variant="info"
            />

            {traditionalEmployeeContribution > 0 && (
              <BreakdownRow
                icon={Building2}
                label="Traditional 401k"
                subtitle={`${(profile.benefits.employer401k.traditionalContribution * 100).toFixed(1)}% contribution (pre-tax)`}
                value={formatCurrency(traditionalEmployeeContribution)}
                prefix="-"
                variant="success"
              />
            )}

            <BreakdownRow
              icon={Calculator}
              label="Taxes & Deductions"
              subtitle="Federal, State, FICA, Benefits"
              value={formatCurrency(totalTaxAndDeductions)}
              prefix="-"
              variant="danger"
            />

            {rothContribution > 0 && (
              <BreakdownRow
                icon={Building2}
                label="Roth 401k"
                subtitle={`${(profile.benefits.employer401k.rothContribution * 100).toFixed(1)}% contribution (after-tax)`}
                value={formatCurrency(rothContribution)}
                prefix="-"
                variant="info"
              />
            )}

            {/* Take-Home Pay */}
            <BreakdownRow
              icon={DollarSign}
              label="Take-Home Pay"
              value={formatCurrency(profile.income.netPaycheck)}
              variant="default"
            />

            {employerMatch > 0 && (
              <BreakdownRow
                icon={Building2}
                label="Employer 401k Match"
                subtitle="Pre-tax employer contribution, not from your paycheck — matching dollars go into the traditional 401k bucket even when your own deferral is Roth"
                value={formatCurrency(employerMatch)}
                prefix="+"
                variant="success"
              />
            )}

            {/* Summary Info */}
            <div className="mt-2 p-2 border border-border bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Monthly equivalent:</span>
                  <span className="font-mono tabular-nums">Gross: {formatCurrency(profile.income.monthlyGross)} | Net: {formatCurrency(profile.income.monthlyNet)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Effective tax rate:</span>
                  <span className="font-mono tabular-nums">{effectiveTaxRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
});
