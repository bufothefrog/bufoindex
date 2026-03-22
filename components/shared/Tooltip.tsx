'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground" />}
      </div>
      
      {isVisible && (
        <div className="absolute z-50 px-3 py-2 text-sm text-popover-foreground bg-popover border border-border rounded-md shadow-lg -top-2 left-6 min-w-[200px] max-w-[300px]">
          {content}
          <div className="absolute w-2 h-2 bg-popover border-l border-b border-border rotate-45 -left-1 top-3"></div>
        </div>
      )}
    </div>
  );
}

// Pre-defined tooltips for common help content
export const HELP_TOOLTIPS = {
  riskTolerance: "Conservative follows traditional financial advice prioritizing safety. Moderate balances safety with optimization. Optimizer maximizes mathematical efficiency and rejects financial industry myths like large emergency funds.",
  
  optimizationGoal: "Balanced optimizes for both tax savings and long-term wealth (recommended). Tax Minimization prioritizes reducing your current year tax bill. Wealth Maximization focuses on long-term growth potential.",
  
  employerMatch: "The percentage your employer contributes for each dollar you put in. For example, 50% means they give 50¢ for every $1 you contribute, up to the match limit.",
  
  matchLimit: "The maximum percentage of your salary your employer will match. Common limits are 3-6% of your annual salary.",
  
  necessaryExpenses: "Fixed monthly costs you can't easily reduce: rent/mortgage, utilities, groceries, minimum debt payments, insurance premiums, transportation costs.",
  
  funMoney: "Money for discretionary spending like dining out, entertainment, shopping, hobbies. Setting a range helps balance enjoying life today with optimizing for tomorrow.",
  
  hsaTripleAdvantage: "HSA contributions are tax-deductible (like Traditional 401k), grow tax-free (like Roth), and withdrawals for medical expenses are tax-free. It's the only account with three tax advantages."
};