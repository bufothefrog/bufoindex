'use client';

import React from 'react';
import { Settings, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateTDFAllocation,
  calculateTDFReturnForAge,
  calculateTDFVolatilityForAge,
} from '@/lib/calculations/retirement';

export interface RiskProfile {
  type: 'tdf' | 'custom';
  name: string;
  description: string;
  accumulationReturn: number;
  retirementReturn: number;
  volatility: number;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Calculate TDF risk profile based on current age.
 * Allocation, return, and volatility all come from the engine's glide path in
 * lib/calculations/retirement.ts so the UI shows the numbers the simulator uses.
 */
function calculateTDFProfile(age: number): RiskProfile {
  const allocation = calculateTDFAllocation(age);
  // Retirement-phase display figure: glide-path return ~30 years ahead
  const retirementAge = Math.min(100, age + 30);

  return {
    type: 'tdf',
    name: `Target Date Fund`,
    description: `Age-based: ${Math.round(allocation.stocks * 100)}% stocks`,
    accumulationReturn: calculateTDFReturnForAge(age),
    retirementReturn: calculateTDFReturnForAge(retirementAge),
    volatility: calculateTDFVolatilityForAge(age),
    icon: Calendar
  };
}

export const RISK_PROFILES: RiskProfile[] = [
  {
    type: 'custom' as const,
    name: 'Custom',
    description: 'Set your own values',
    accumulationReturn: 0.07, // Default to moderate
    retirementReturn: 0.05,
    volatility: 0.15,
    icon: Settings
  }
];

interface RiskProfileSelectorProps {
  value: 'tdf' | 'custom';
  onChange: (profile: 'tdf' | 'custom') => void;
  onReturnRatesChange?: (accumulationReturn: number, retirementReturn: number, volatility: number) => void;
  currentAge?: number;
  className?: string;
}

export function RiskProfileSelector({
  value,
  onChange,
  onReturnRatesChange,
  currentAge = 25,
  className
}: RiskProfileSelectorProps) {
  
  const handleProfileSelect = (profile: RiskProfile) => {
    onChange(profile.type);
    
    // Auto-populate return rates if callback provided
    if (onReturnRatesChange && profile.type !== 'custom') {
      onReturnRatesChange(
        profile.accumulationReturn,
        profile.retirementReturn,
        profile.volatility
      );
    }
  };

  // Get simplified profiles: only TDF and Custom
  const getSimplifiedProfiles = () => {
    const tdfProfile = calculateTDFProfile(currentAge);
    const customProfile = RISK_PROFILES.find(p => p.type === 'custom')!;
    return [tdfProfile, customProfile];
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">
        Risk Profile
      </label>
      <div className="grid grid-cols-2 gap-2">
        {getSimplifiedProfiles().map((profile) => {
          const Icon = profile.icon;
          const isSelected = value === profile.type;
          
          return (
            <button
              key={profile.type}
              type="button"
              onClick={() => handleProfileSelect(profile)}
              className={cn(
                "relative p-3 border rounded-lg text-left transition-all",
                "hover:bg-sage-50 dark:hover:bg-sage-800/50 focus:outline-hidden focus:ring-2 focus:ring-sage-500",
                isSelected 
                  ? "border-sage-500 bg-sage-50 dark:bg-sage-800/50 text-sage-900 dark:text-sage-100" 
                  : "border-border bg-card text-foreground"
              )}
            >
              <div className="flex items-center space-x-2">
                <Icon className={cn(
                  "w-4 h-4",
                  isSelected ? "text-sage-600 dark:text-sage-300" : "text-muted-foreground"
                )} />
                <span className="text-xs font-medium">{profile.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {profile.description}
              </div>
              {profile.type !== 'custom' && (
                <div className="mt-2 text-xs text-muted-foreground font-mono">
                  {(profile.accumulationReturn * 100).toFixed(0)}% / {(profile.retirementReturn * 100).toFixed(0)}%
                </div>
              )}
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-sage-500 dark:bg-sage-300 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Target Date Fund adjusts allocation automatically based on your age. Custom lets you set return and volatility yourself.
      </p>
    </div>
  );
}