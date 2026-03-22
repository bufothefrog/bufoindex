'use client';

import React from 'react';
import { TrendingUp, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WealthGoalSelectorProps {
  value: 'maximize' | 'balanced' | 'zero';
  onChange: (goal: 'maximize' | 'balanced' | 'zero') => void;
  className?: string;
}

const WEALTH_GOALS = [
  {
    type: 'maximize' as const,
    name: 'Maximize Wealth',
    description: 'Build largest estate value',
    details: 'Conservative spending, maximum inheritance',
    icon: TrendingUp
  },
  {
    type: 'balanced' as const,
    name: 'Balanced Preservation',
    description: 'Maintain purchasing power',
    details: '4% rule, balanced approach',
    icon: Shield
  },
  {
    type: 'zero' as const,
    name: 'Die with Zero',
    description: 'Optimize lifetime spending',
    details: 'Spend more, leave less behind',
    icon: Zap
  }
];

export function WealthGoalSelector({ value, onChange, className }: WealthGoalSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">
        Wealth Goal
      </label>
      <div className="grid grid-cols-3 gap-2">
        {WEALTH_GOALS.map((goal) => {
          const Icon = goal.icon;
          const isSelected = value === goal.type;
          
          return (
            <button
              key={goal.type}
              type="button"
              onClick={() => onChange(goal.type)}
              className={cn(
                "relative p-3 border rounded-lg text-left transition-all text-xs",
                "hover:bg-sage-50 dark:hover:bg-sage-900/50 focus:outline-none focus:ring-2 focus:ring-sage-500",
                isSelected 
                  ? "border-sage-500 bg-sage-50 dark:bg-sage-900/50 text-sage-900 dark:text-sage-100" 
                  : "border-border bg-card text-foreground"
              )}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Icon className={cn(
                  "w-4 h-4",
                  isSelected ? "text-sage-600 dark:text-sage-400" : "text-muted-foreground"
                )} />
                <span className="font-medium text-xs">{goal.name}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                {goal.description}
              </div>
              <div className="text-xs text-muted-foreground">
                {goal.details}
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-sage-500 dark:bg-sage-400 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Your wealth goal affects withdrawal rates and scenario recommendations.
      </p>
    </div>
  );
}