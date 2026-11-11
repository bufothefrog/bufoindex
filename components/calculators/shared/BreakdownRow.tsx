import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneFromLegacy, type Tone } from '@/lib/design-system/tone';
import { KeyValueRow } from '@/components/ui/results/KeyValueList';

/** Deprecated spelling of `tone`; kept until every caller moves (x2 removes it). */
export type BreakdownRowVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BreakdownRowProps {
  icon?: LucideIcon;
  label: string;
  subtitle?: string;
  value: string | number;
  prefix?: '+' | '-' | '';
  /** Colors the value. Default neutral. Wins over `variant`. */
  tone?: Tone;
  /** @deprecated Use `tone` (default -> neutral, success -> positive, warning -> caution, danger -> negative). */
  variant?: BreakdownRowVariant;
  className?: string;
}

/**
 * A single boxed label/value row: KeyValueList's row in a one-row dl, so it
 * stays valid markup wherever it is placed. Prefer KeyValueList for a run of rows.
 */
export function BreakdownRow({
  icon,
  label,
  subtitle,
  value,
  prefix = '',
  tone,
  variant,
  className,
}: BreakdownRowProps) {
  return (
    <dl className={cn('m-0', className)}>
      <KeyValueRow
        appearance="boxed"
        icon={icon}
        label={label}
        subtitle={subtitle}
        value={value}
        prefix={prefix}
        tone={tone ?? toneFromLegacy(variant)}
      />
    </dl>
  );
}

export default BreakdownRow;
