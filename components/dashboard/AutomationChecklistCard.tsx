'use client';

import React, { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { formatCurrency, formatPercent } from '@/lib/calculations/core';
import type { FinancialProfile } from '@/lib/profile/types';
import type { AllocationResult } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DASHBOARD_CARD_LAYOUT } from './cardLayout';
import { buildChecklistRows } from './derive';

export interface AutomationChecklistCardProps {
  profile: FinancialProfile;
  allocation: AllocationResult | null;
}

/**
 * One row per recurring transfer to set up. The checkmarks are local
 * component state only; nothing is persisted yet.
 */
export function AutomationChecklistCard({ profile, allocation }: AutomationChecklistCardProps) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const rows = buildChecklistRows(profile, allocation?.allocations ?? []);
  const completed = rows.filter((row) => done[row.id]).length;

  const toggle = (id: string) => setDone((current) => ({ ...current, [id]: !current[id] }));

  return (
    <BaseCard title="Automation checklist" icon={ListChecks} {...DASHBOARD_CARD_LAYOUT} testId="overview-automation">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Recurring transfers that would carry out this paycheck&apos;s plan without a monthly decision.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring transfers come out of the current plan.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => {
              const checked = Boolean(done[row.id]);
              const inputId = `automation-${row.id}`;
              return (
                <li key={row.id}>
                  <label
                    htmlFor={inputId}
                    className="flex min-h-11 cursor-pointer items-start gap-3 p-3 hover:bg-muted/40"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(row.id)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border accent-sage-600 dark:accent-sage-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            'min-w-0 font-medium text-foreground',
                            checked && 'text-muted-foreground line-through'
                          )}
                        >
                          {row.account}
                        </span>
                        <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(row.perPaycheck)}
                          {row.percentOfGross !== undefined && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {row.percentIsIncrease ? '+' : ''}
                              {formatPercent(row.percentOfGross)} of gross
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{row.implementation}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">
            {completed} of {rows.length}
          </span>{' '}
          set up. Amounts are per paycheck. Checkmarks are not saved yet.
        </p>
      </div>
    </BaseCard>
  );
}

export default AutomationChecklistCard;
