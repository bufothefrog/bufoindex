'use client';

import React from 'react';
import { Banknote, Coins, Scissors } from 'lucide-react';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { EnhancedMoneyInput } from '@/components/ui/inputs';
import { RebalanceMode } from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

interface DepositAndModeCardProps {
  deposit: number;
  mode: RebalanceMode;
  onDepositChange: (value: number) => void;
  onModeChange: (mode: RebalanceMode) => void;
}

export function DepositAndModeCard({
  deposit,
  mode,
  onDepositChange,
  onModeChange,
}: DepositAndModeCardProps) {
  return (
    <InputCard title="Deposit & Purchase Mode" icon={Banknote}>
      <div className="space-y-5">
        <EnhancedMoneyInput
          name="deposit"
          label="Deposit amount"
          value={deposit}
          onChange={onDepositChange}
          placeholder="1,000"
          help="New cash to invest this round. We'll direct it to whichever assets are most underweight."
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">Purchase mode</div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Purchase mode">
            <ModeButton
              active={mode === 'whole'}
              onClick={() => onModeChange('whole')}
              icon={<Coins className="w-4 h-4" />}
              title="Whole shares"
              description="Floor to integers; leftover kept as cash."
              testId="mode-whole"
            />
            <ModeButton
              active={mode === 'fractional'}
              onClick={() => onModeChange('fractional')}
              icon={<Scissors className="w-4 h-4" />}
              title="Fractional"
              description="Exact-to-penny splits. Requires broker support."
              testId="mode-fractional"
            />
          </div>
        </div>
      </div>
    </InputCard>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

function ModeButton({ active, onClick, icon, title, description, testId }: ModeButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'text-left p-3 rounded-lg border transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 focus-visible:ring-offset-2',
        active
          ? 'border-sage-400 bg-sage-50 dark:bg-sage-800/50 dark:border-sage-500'
          : 'border-border bg-background hover:border-sage-300 dark:hover:border-sage-600'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 font-medium text-sm',
          active ? 'text-sage-700 dark:text-sage-200' : 'text-foreground'
        )}
      >
        {icon}
        {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  );
}
