'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { IncomeInputCard } from './inputs/IncomeInputCard';
import { ExpensesInputCard } from './inputs/ExpensesInputCard';
import { SavingsInputCard } from './inputs/SavingsInputCard';
import { TaxInputCard } from './inputs/TaxInputCard';
import { BenefitsInputCard } from './inputs/BenefitsInputCard';
import { DebtsInputCard } from './inputs/DebtsInputCard';
import { AdvancedSettingsCard } from './inputs/AdvancedSettingsCard';

export function InputSection() {
  const {
    profile,
    updateIncome,
    updateTaxes,
    updateBenefits,
    updatePreferences,
    addDebt,
    updateDebt,
    removeDebt,
    showAdvanced,
    setShowAdvanced,
  } = useCalculatorStore();

  return (
    <div className="space-y-6">
      <IncomeInputCard income={profile.income} onUpdate={updateIncome} />
      <ExpensesInputCard preferences={profile.preferences} onUpdate={updatePreferences} />
      <SavingsInputCard
        preferences={profile.preferences}
        benefits={profile.benefits}
        onUpdatePreferences={updatePreferences}
        onUpdateBenefits={updateBenefits}
      />
      <TaxInputCard taxes={profile.taxes} onUpdate={updateTaxes} />
      <BenefitsInputCard
        benefits={profile.benefits}
        onUpdate={updateBenefits}
      />
      <DebtsInputCard
        debts={profile.debts}
        onAdd={addDebt}
        onUpdate={updateDebt}
        onRemove={removeDebt}
      />
      <AdvancedSettingsCard
        preferences={profile.preferences}
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onUpdate={updatePreferences}
      />
    </div>
  );
}
