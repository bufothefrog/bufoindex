'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { UserPreferences } from '@/lib/types';

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
            <div className="space-y-2">
              <label className="text-sm font-medium">Risk Tolerance</label>
              <select
                value={preferences.riskTolerance}
                onChange={(e) => onUpdate({
                  riskTolerance: e.target.value as 'conservative' | 'moderate' | 'optimizer'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="conservative">Conservative (traditional advice)</option>
                <option value="moderate">Moderate (balanced approach)</option>
                <option value="optimizer">Optimizer (maximum mathematical efficiency)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Optimization Goal</label>
              <select
                value={preferences.optimizationGoal}
                onChange={(e) => onUpdate({
                  optimizationGoal: e.target.value as 'tax_minimization' | 'wealth_maximization' | 'balanced'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="balanced">Balanced (recommended)</option>
                <option value="tax_minimization">Tax Minimization</option>
                <option value="wealth_maximization">Wealth Maximization</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
