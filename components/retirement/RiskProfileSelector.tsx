'use client';

import React from 'react';
import { TrendingUp, Shield, Zap, Settings, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 * Calculate Target Date Fund asset allocation based on age
 */
function calculateTDFAllocation(age: number) {
  const clampedAge = Math.max(18, Math.min(100, age));
  
  let stockAllocation: number;
  if (clampedAge <= 25) {
    stockAllocation = 0.90;
  } else if (clampedAge <= 65) {
    // Linear decrease from 90% to 40% between ages 25-65
    stockAllocation = 0.90 - ((clampedAge - 25) / 40) * 0.50;
  } else {
    // Slower decrease from 40% to 30% between ages 65-85
    const ageAfter65 = Math.min(20, clampedAge - 65);
    stockAllocation = 0.40 - (ageAfter65 / 20) * 0.10;
  }
  
  const bondAllocation = 1 - stockAllocation;
  
  return {
    stocks: stockAllocation,
    bonds: bondAllocation,
    age: clampedAge
  };
}

/**
 * Calculate TDF risk profile based on current age
 */
function calculateTDFProfile(age: number): RiskProfile {
  const allocation = calculateTDFAllocation(age);
  
  // Expected returns: Stocks ~10%, Bonds ~4%
  const stockReturn = 0.10;
  const bondReturn = 0.04;
  
  // Volatility: Stocks ~18%, Bonds ~6%
  const stockVolatility = 0.18;
  const bondVolatility = 0.06;
  
  // Calculate blended returns and volatility
  const blendedReturn = (allocation.stocks * stockReturn) + (allocation.bonds * bondReturn);
  const blendedVolatility = Math.sqrt(
    Math.pow(allocation.stocks * stockVolatility, 2) + 
    Math.pow(allocation.bonds * bondVolatility, 2)
  );
  
  // For retirement phase, use slightly more conservative allocation
  const retirementAge = Math.min(100, age + 30); // Project 30 years ahead
  const retirementAllocation = calculateTDFAllocation(retirementAge);
  const retirementReturn = (retirementAllocation.stocks * stockReturn) + (retirementAllocation.bonds * bondReturn);
  
  return {
    type: 'tdf',
    name: `Target Date Fund`,
    description: `Age-based: ${Math.round(allocation.stocks * 100)}% stocks`,
    accumulationReturn: blendedReturn,
    retirementReturn: retirementReturn,
    volatility: blendedVolatility,
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
                "hover:bg-sage-50 dark:hover:bg-sage-800/50 focus:outline-none focus:ring-2 focus:ring-sage-500",
                isSelected 
                  ? "border-sage-500 bg-sage-50 dark:bg-sage-800/50 text-sage-900 dark:text-sage-100" 
                  : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              )}
            >
              <div className="flex items-center space-x-2">
                <Icon className={cn(
                  "w-4 h-4",
                  isSelected ? "text-sage-600 dark:text-sage-300" : "text-gray-400 dark:text-gray-400"
                )} />
                <span className="text-xs font-medium">{profile.name}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                {profile.description}
              </div>
              {profile.type !== 'custom' && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 font-mono">
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
      <p className="text-xs text-gray-500 dark:text-gray-300">
        Target Date Fund automatically adjusts allocation based on your age. Select another profile for fixed allocations, or Custom to set your own values.
      </p>
    </div>
  );
}