'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { DollarSign } from 'lucide-react';
import type { IncomeData } from '@/lib/types';

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
            placeholder="$2,500"
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Pay Frequency</label>
            <select
              value={income.frequency}
              onChange={(e) => onUpdate({ frequency: e.target.value as 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 dark:focus-visible:ring-sage-600 focus-visible:ring-offset-2 hover:border-sage-300 dark:hover:border-sage-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="semi-monthly">Semi-Monthly (2x/month)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <MoneyInput
          name="netPaycheck"
          label="Take-Home Per Paycheck"
          value={income.netPaycheck}
          onChange={(value) => onUpdate({ netPaycheck: value })}
          placeholder="$1,900"
          required
        />

        {/* Bonus Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={income.regularBonus || false}
              onChange={(e) => onUpdate({ regularBonus: e.target.checked })}
              className="rounded"
            />
            <label className="text-sm font-medium">I receive regular bonuses</label>
          </div>

          {income.regularBonus && (
            <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                name="bonusAmount"
                label="Average Bonus Amount"
                value={income.bonusAmount}
                onChange={(value) => onUpdate({ bonusAmount: value })}
                placeholder="$2,000"
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Bonus Frequency</label>
                <select
                  value={income.bonusFrequency}
                  onChange={(e) => onUpdate({ bonusFrequency: e.target.value as 'quarterly' | 'annual' | 'irregular' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 dark:focus-visible:ring-sage-600 focus-visible:ring-offset-2 hover:border-sage-300 dark:hover:border-sage-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="irregular">Irregular</option>
                </select>
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
