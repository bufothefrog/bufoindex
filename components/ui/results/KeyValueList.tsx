import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_TEXT, type Tone } from '@/lib/design-system/tone';

/** boxed: each row is its own bordered box; divided: rules between rows; plain: no chrome. */
export type KeyValueAppearance = 'boxed' | 'divided' | 'plain';

export interface KeyValueItem {
  /** React key; defaults to the label when it is a string. */
  id?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** A second, muted line under the label. */
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Shown before the value, e.g. '+' or '-'. */
  prefix?: string;
  /** Colors the value. Default neutral. */
  tone?: Tone;
}

export interface KeyValueRowProps extends Omit<KeyValueItem, 'id'> {
  appearance?: KeyValueAppearance;
  className?: string;
}

const ROW_APPEARANCE: Record<KeyValueAppearance, string> = {
  boxed: 'rounded-lg border border-border p-2',
  divided: 'border-b border-border py-2 last:border-b-0',
  plain: 'py-1',
};

/**
 * One term/value pair. It renders a dt and a dd inside a div, so it must sit
 * inside a dl (KeyValueList, or BreakdownRow's own one-row list).
 */
export function KeyValueRow({
  label,
  value,
  subtitle,
  icon: Icon,
  prefix = '',
  tone = 'neutral',
  appearance = 'boxed',
  className,
}: KeyValueRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', ROW_APPEARANCE[appearance], className)}>
      <dt className="flex min-w-0 items-center gap-2">
        {Icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      </dt>
      <dd className={cn('m-0 shrink-0 text-base font-semibold tabular-nums font-mono', TONE_TEXT[tone])}>
        {prefix}
        {value}
      </dd>
    </div>
  );
}

export interface KeyValueListProps {
  items: readonly KeyValueItem[];
  appearance?: KeyValueAppearance;
  /** Accessible name for the list. */
  label?: string;
  className?: string;
  testId?: string;
}

/** A description list of labelled figures (dl / dt / dd). */
export function KeyValueList({ items, appearance = 'boxed', label, className, testId }: KeyValueListProps) {
  return (
    <dl
      aria-label={label}
      data-testid={testId}
      className={cn('m-0', appearance === 'boxed' && 'space-y-2', className)}
    >
      {items.map(({ id, ...item }, index) => (
        <KeyValueRow
          key={id ?? (typeof item.label === 'string' ? item.label : index)}
          appearance={appearance}
          {...item}
        />
      ))}
    </dl>
  );
}

export default KeyValueList;
