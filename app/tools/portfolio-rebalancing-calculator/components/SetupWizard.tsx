'use client';

import React from 'react';
import { ArrowLeft, User, Users, Layers, SplitSquareHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import { cn } from '@/lib/utils';

/**
 * Two-step onboarding wizard. Shown when `setupMode === null`.
 *
 *   Step 1: "How many accounts?" → single vs multi
 *   Step 2: (multi only) "How should targets work?" → shared vs unique
 *
 * Single-account users skip step 2 entirely.
 */
export function SetupWizard() {
  const wizardStep = usePortfolioRebalancingStore(s => s.wizardStep);
  const setSetupMode = usePortfolioRebalancingStore(s => s.setSetupMode);
  const setWizardStep = usePortfolioRebalancingStore(s => s.setWizardStep);
  const completeWizard = usePortfolioRebalancingStore(s => s.completeWizard);

  const chooseSingle = () => {
    setSetupMode('single');
    completeWizard();
  };

  const goToStep2 = () => {
    setWizardStep('targets-style');
  };

  const chooseMultiShared = () => {
    setSetupMode('multi-shared');
    completeWizard();
  };

  const chooseMultiUnique = () => {
    setSetupMode('multi-unique');
    completeWizard();
  };

  const goBack = () => {
    setWizardStep('mode');
  };

  return (
    <div
      data-testid="setup-wizard"
      className="max-w-3xl mx-auto py-10 px-4"
    >
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Portfolio Rebalancing Calculator
          </h1>
          <p className="text-sm text-muted-foreground">
            A few questions so we can tailor the calculator to your situation.
          </p>
        </div>

        {wizardStep === 'mode' && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-center">How many accounts do you want to rebalance?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WizardOption
                testId="wizard-option-single"
                icon={<User className="w-6 h-6" />}
                title="One account"
                description="You're rebalancing a single brokerage, IRA, or 401(k)."
                onClick={chooseSingle}
              />
              <WizardOption
                testId="wizard-option-multi"
                icon={<Users className="w-6 h-6" />}
                title="Multiple accounts"
                description="You're coordinating across several accounts (e.g. taxable + Roth + 401k)."
                onClick={goToStep2}
              />
            </div>
          </div>
        )}

        {wizardStep === 'targets-style' && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-center">How should targets work?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WizardOption
                testId="wizard-option-multi-shared"
                icon={<Layers className="w-6 h-6" />}
                title="Same split across all accounts"
                description="One portfolio-wide allocation. Cash flows to whichever account holds the most underweight asset class."
                onClick={chooseMultiShared}
              />
              <WizardOption
                testId="wizard-option-multi-unique"
                icon={<SplitSquareHorizontal className="w-6 h-6" />}
                title="Different split per account"
                description="Each account has its own target allocation. No cross-account coordination."
                onClick={chooseMultiUnique}
              />
            </div>
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={goBack}
                data-testid="wizard-back"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface WizardOptionProps {
  testId: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function WizardOption({ testId, icon, title, description, onClick }: WizardOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'text-left p-6 rounded-lg border-2 border-border bg-background',
        'transition-all cursor-pointer',
        'hover:border-sage-300 hover:bg-sage-50/40 dark:hover:border-sage-500 dark:hover:bg-sage-800/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 focus-visible:ring-offset-2'
      )}
    >
      <div className="flex items-center gap-3 mb-2 text-sage-700 dark:text-sage-200">
        {icon}
        <div className="font-semibold text-base">{title}</div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </button>
  );
}
