'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { DollarSign } from 'lucide-react';
import type { IncomeData } from '@/lib/types';

const PAY_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly' },
  { value: 'semi-monthly', label: 'Semi-Monthly (2x/month)' },
  { value: 'monthly', label: 'Monthly' },
];

const BONUS_FREQUENCY_OPTIONS = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'irregular', label: 'Irregular' },
];

interface IncomeInputCardProps {
  income: IncomeData;
  onUpdate: (income: Partial<IncomeData>) => void;
}

export function IncomeInputCard({ income, onUpdate }: IncomeInputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-sage-600" />
          <span>Paycheck Income</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MoneyInput
            name="grossPaycheck"
            label="Gross Paycheck Amount"
            value={income.grossPaycheck}
            onChange={(value) => onUpdate({ grossPaycheck: value })}
            placeholder="2,500"
            required
          />

          <SelectInput
            name="payFrequency"
            label="Pay Frequency"
            value={income.frequency}
            onChange={(value) => onUpdate({ frequency: value as 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' })}
            options={PAY_FREQUENCY_OPTIONS}
          />
        </div>

        <MoneyInput
          name="netPaycheck"
          label="Take-Home Per Paycheck"
          value={income.netPaycheck}
          onChange={(value) => onUpdate({ netPaycheck: value })}
          placeholder="1,900"
          required
        />

        {/* Bonus Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              id="regularBonus"
              type="checkbox"
              checked={income.regularBonus || false}
              onChange={(e) => onUpdate({ regularBonus: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="regularBonus" className="text-sm font-medium">I receive regular bonuses</label>
          </div>

          {income.regularBonus && (
            <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                name="bonusAmount"
                label="Average Bonus Amount"
                value={income.bonusAmount}
                onChange={(value) => onUpdate({ bonusAmount: value })}
                placeholder="2,000"
              />

              <SelectInput
                name="bonusFrequency"
                label="Bonus Frequency"
                value={income.bonusFrequency}
                onChange={(value) => onUpdate({ bonusFrequency: value as 'quarterly' | 'annual' | 'irregular' })}
                options={BONUS_FREQUENCY_OPTIONS}
              />
            </div>
          )}
          {income.regularBonus && (
            <p className="ml-6 text-xs text-muted-foreground">
              Bonuses are recorded for context and shareable links; the per-paycheck
              allocation math is based on regular paychecks only.
            </p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
