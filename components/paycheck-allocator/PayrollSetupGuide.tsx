import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { StatGrid } from '@/components/ui/results';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { paycheckFlow, paycheckHeadline, type PaycheckFlow } from '@/lib/calculators/paycheck/headline';
import { allocationDisplayLabel } from '@/lib/constants/financialSteps';
import { PAY_FREQUENCY_META } from '@/lib/constants/frequency';
import { TONE_BORDER, TONE_SURFACE, TONE_TEXT } from '@/lib/design-system/tone';
import { formatCurrency } from '@/lib/format';
import { AllocationItem, AllocationResult, PaycheckProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Building2,
  Copy,
  CheckCircle,
  Info,
  Zap,
  Settings,
  Target
} from 'lucide-react';

export interface PayrollSetupGuideProps {
  profile: PaycheckProfile;
  result: AllocationResult;
}

type AutomationTier = 'basic' | 'intermediate' | 'advanced';

const TIER_OPTIONS: readonly SegmentedControlOption<AutomationTier>[] = [
  { value: 'basic', label: 'Basic', description: 'Manual transfers', icon: Settings },
  { value: 'intermediate', label: 'Intermediate', description: '2-account split', icon: Target },
  { value: 'advanced', label: 'Advanced', description: 'Multi-account split', icon: Zap },
];

const BULLET = '\u2022';

const IMPLEMENTATION_TIPS = [
  'Contact your HR/Payroll department with the account routing information',
  'Changes typically take 1-2 pay periods to take effect',
  'Keep backup transfers set up during the transition period',
  'Review and adjust quarterly based on income or expense changes',
];

interface SetupInstructions {
  title: string;
  description: string;
  /** One line each; '' is a spacer and a line starting with a bullet is indented. */
  setup: string[];
  pros: string[];
  cons: string[];
}

interface SetupContext {
  flow: PaycheckFlow;
  /** Per-paycheck allocations, in plan order. */
  allocations: AllocationItem[];
  /** Per-paycheck amount no allocation took. */
  remaining: number;
  /** In-sentence pay frequency, e.g. "bi-weekly". */
  phrase: string;
}

function setupInstructions(tier: AutomationTier, { flow, allocations, remaining, phrase }: SetupContext): SetupInstructions {
  switch (tier) {
    case 'basic':
      return {
        title: 'Basic Setup (Manual Transfers)',
        description: 'Everything goes to checking account, you handle transfers manually',
        setup: [
          'Direct deposit: 100% to checking account',
          `Amount per paycheck: ${formatCurrency(flow.takeHome)}`,
          '',
          'Then set up automatic transfers:',
          ...allocations.map((allocation) => `${BULLET} ${allocationDisplayLabel(allocation.account)}: ${formatCurrency(allocation.amount)} ${phrase}`),
          ...(remaining > 0 ? [`${BULLET} Investment account: ${formatCurrency(remaining)} ${phrase}`] : []),
        ],
        pros: ['Simple to set up', 'Works with any employer'],
        cons: ['Requires manual management', 'Delays in transfers'],
      };
    case 'intermediate':
      return {
        title: 'Intermediate Setup (2-Account Split)',
        description: 'Split between checking and one investment account',
        setup: [
          `Account 1 - Checking: ${formatCurrency(flow.spending)}`,
          `Account 2 - Primary Investment/Savings: ${formatCurrency(flow.priority)}`,
          '',
          'Then manually allocate the investment portion:',
          ...allocations.map((allocation) => `${BULLET} ${allocationDisplayLabel(allocation.account)}: ${formatCurrency(allocation.amount)}`),
        ],
        pros: ['Automates savings', 'Keeps spending money separate'],
        cons: ['Still requires some manual allocation'],
      };
    case 'advanced':
      return {
        title: 'Advanced Setup (Multi-Account Split)',
        description: 'Direct deposit splits to multiple accounts automatically',
        setup: [
          `Account 1 - Checking: ${formatCurrency(flow.spending)}`,
          ...allocations
            .slice(0, 3)
            .map((allocation, index) => `Account ${index + 2} - ${allocationDisplayLabel(allocation.account)}: ${formatCurrency(allocation.amount)}`),
          ...(remaining > 0 ? [`Account ${allocations.length + 2} - Investment: ${formatCurrency(remaining)}`] : []),
          '',
          'Note: Most payroll systems support 3-4 account splits maximum',
        ],
        pros: ['Fully automated', 'No manual transfers needed'],
        cons: ['Requires employer support', 'Limited account splits'],
      };
  }
}

export const PayrollSetupGuide = React.memo(function PayrollSetupGuide({ profile, result }: PayrollSetupGuideProps) {
  const [selectedTier, setSelectedTier] = useState<AutomationTier>('intermediate');
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const frequency = PAY_FREQUENCY_META[profile.income.frequency];
  // AllocationItem.amount and remainingAmount are already per paycheck.
  const instructions = setupInstructions(selectedTier, {
    flow: paycheckFlow(result, profile),
    allocations: result.allocations,
    remaining: result.remainingAmount,
    phrase: frequency.phrase,
  });

  const copyInstructions = async () => {
    const text = `${instructions.title}\n\n${instructions.description}\n\n${instructions.setup.join('\n')}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedInstructions(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedInstructions(false), 2000);
    } catch (error) {
      console.error('Failed to copy instructions:', error);
    }
  };

  return (
    <Card className={cn(TONE_BORDER.positive, TONE_SURFACE.positive)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building2 className={cn('w-5 h-5', TONE_TEXT.positive)} aria-hidden="true" />
          <span>Payroll Configuration Guide</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure your {frequency.phrase} payroll to automate your optimized allocation
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paycheck Summary */}
        <div className="p-4 bg-card rounded-lg border border-border">
          <h4 className="font-medium text-foreground mb-3">Your {frequency.label} Paycheck Flow</h4>
          <StatGrid stats={paycheckHeadline(result, profile)} columns={1} className="sm:grid-cols-3" />
        </div>

        {/* Automation Tier Selection */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Choose Your Automation Level</h4>
          <SegmentedControl
            label="Automation level"
            hideLabel
            appearance="cards"
            options={TIER_OPTIONS}
            value={selectedTier}
            onChange={setSelectedTier}
          />
        </div>

        {/* Selected Instructions */}
        <section className="space-y-4" aria-label={`${selectedTier} setup instructions`}>
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">{instructions.title}</h4>
            <Button
              onClick={copyInstructions}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
              aria-label="Copy setup instructions"
            >
              {copiedInstructions ? (
                <>
                  <CheckCircle className={cn('w-4 h-4', TONE_TEXT.positive)} aria-hidden="true" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Copy Instructions</span>
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{instructions.description}</p>

          <div className="p-4 bg-card rounded-lg border border-border">
            <div className="space-y-2">
              {instructions.setup.map((line, index) => (
                <div
                  key={index}
                  className={cn('text-sm', line === '' ? 'py-1' : 'text-foreground', line.startsWith(BULLET) && 'ml-4')}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Pros/Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className={cn('text-sm font-medium', TONE_TEXT.positive)}>Pros:</h5>
              <ul className="space-y-1">
                {instructions.pros.map((pro) => (
                  <li key={pro} className={cn('text-xs flex items-center space-x-2', TONE_TEXT.positive)}>
                    <CheckCircle className="w-3 h-3" aria-hidden="true" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className={cn('text-sm font-medium', TONE_TEXT.caution)}>Cons:</h5>
              <ul className="space-y-1">
                {instructions.cons.map((con) => (
                  <li key={con} className={cn('text-xs flex items-center space-x-2', TONE_TEXT.caution)}>
                    <Info className="w-3 h-3" aria-hidden="true" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Implementation Tips */}
        <StatusAlert tone="info" appearance="tinted" title="Implementation Tips:">
          <ul className="space-y-1 text-xs">
            {IMPLEMENTATION_TIPS.map((tip) => (
              <li key={tip}>{`${BULLET} ${tip}`}</li>
            ))}
          </ul>
        </StatusAlert>
      </CardContent>
    </Card>
  );
});

export default PayrollSetupGuide;
