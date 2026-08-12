'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/inputs';
import { Input } from '@/components/ui/input';
import { Heart } from 'lucide-react';
import type { UserPreferences } from '@/lib/types';

interface ExpensesInputCardProps {
  preferences: UserPreferences;
  onUpdate: (preferences: Partial<UserPreferences>) => void;
}

export function ExpensesInputCard({ preferences, onUpdate }: ExpensesInputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Heart className="w-5 h-5 text-sage-600" />
          <span>Essential Expenses</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Necessary Expenses and Age */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MoneyInput
            name="necessaryExpenses"
            label="Necessary Monthly Expenses"
            value={preferences.necessaryExpenses}
            onChange={(value) => onUpdate({ necessaryExpenses: value })}
            placeholder="2,500"
            help="Rent, utilities, groceries, minimum debt payments, insurance, etc."
            required
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Age</label>
            <Input
              type="number"
              min="1"
              max="100"
              value={preferences.age}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 100) {
                  onUpdate({ age: value });
                }
              }}
              placeholder="30"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Used for catch-up contribution eligibility</p>
          </div>
        </div>

        {/* Fun Money Range */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Extra Money You Want Available</h4>
          <p className="text-sm text-muted-foreground">Range for dining out, entertainment, shopping, and discretionary spending</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MoneyInput
              name="funMoneyMin"
              label="Minimum"
              value={preferences.funMoney.min}
              onChange={(value) => onUpdate({
                funMoney: { ...preferences.funMoney, min: value }
              })}
              placeholder="500"
            />

            <MoneyInput
              name="funMoneyMax"
              label="Maximum"
              value={preferences.funMoney.max}
              onChange={(value) => onUpdate({
                funMoney: { ...preferences.funMoney, max: value }
              })}
              placeholder="1,000"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
