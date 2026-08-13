'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { UserPreferences } from '@/lib/types';

const RISK_TOLERANCE_OPTIONS = [
  { value: 'conservative', label: 'Conservative (traditional ordering)' },
  { value: 'moderate', label: 'Moderate (balanced ordering)' },
  { value: 'optimizer', label: 'Optimizer (highest after-tax return first)' },
];

const OPTIMIZATION_GOAL_OPTIONS = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'tax_minimization', label: 'Tax Minimization' },
  { value: 'wealth_maximization', label: 'Wealth Maximization' },
];

interface AdvancedSettingsCardProps {
  preferences: UserPreferences;
  showAdvanced: boolean;
  onToggle: () => void;
  onUpdate: (preferences: Partial<UserPreferences>) => void;
}

export function AdvancedSettingsCard({ preferences, showAdvanced, onToggle, onUpdate }: AdvancedSettingsCardProps) {
  return (
    <>
      <Card>
        <CardContent className="p-4">
          <Button
            variant="ghost"
            onClick={onToggle}
            className="w-full flex items-center justify-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Settings</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Advanced Settings (shown when toggled) */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SelectInput
              name="riskTolerance"
              label="Risk Tolerance"
              value={preferences.riskTolerance}
              onChange={(value) => onUpdate({
                riskTolerance: value as 'conservative' | 'moderate' | 'optimizer'
              })}
              options={RISK_TOLERANCE_OPTIONS}
            />

            <SelectInput
              name="optimizationGoal"
              label="Optimization Goal"
              value={preferences.optimizationGoal}
              onChange={(value) => onUpdate({
                optimizationGoal: value as 'tax_minimization' | 'wealth_maximization' | 'balanced'
              })}
              options={OPTIMIZATION_GOAL_OPTIONS}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
