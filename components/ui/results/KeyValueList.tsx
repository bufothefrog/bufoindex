import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormatKind } from '@/lib/format';
import { formatStatValue } from '@/lib/design-system/stat';
import { TONE_TEXT, type Tone } from '@/lib/design-system/tone';

export type KeyValuePrefix = '+' | '-' | '';

interface KeyValueItemBase {
  /** Stable key, unique within the list. */
  id: string;
  label: string;
  /** A wrapping line under the label (rows layout only). */
  subtitle?: string;
  /** Printed before the value, e.g. '+' on a gain. */
  prefix?: KeyValuePrefix;
  tone?: Tone;
  /** Shown beside the label (rows layout only). */
  icon?: LucideIcon;
}

/** A row's value: a number with its format, or text that is already formatted. */
export type KeyValueItem = KeyValueItemBase &
  ({ value: number | null; format: FormatKind } | { value: string; format?: never });

export type KeyValueListLayout = 'rows' | 'grid';

export interface KeyValueListProps {
  items: readonly KeyValueItem[];
  /**
   * rows: one bordered row per item, label left and value right.
   * grid: two columns of label-over-value pairs, for detail panels.
   */
  layout?: KeyValueListLayout;
  className?: string;
}

export interface KeyValueRowProps {
  label: string;
  subtitle?: string;
  value: React.ReactNode;
  prefix?: KeyValuePrefix;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}

/**
 * One bordered label and value row. Inside a KeyValueList it is a dt and dd
 * pair; the label column wraps and the value column never shrinks.
 */
export function KeyValueRow({
  label,
  subtitle,
  value,
  prefix = '',
  tone = 'neutral',
  icon: Icon,
  className,
}: KeyValueRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg border border-border',
        className
      )}
    >
      <dt className="flex items-center space-x-2 min-w-0">
        {Icon && (
          <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </dt>
      <dd
        className={cn(
          'text-base font-semibold font-mono tabular-nums shrink-0',
          TONE_TEXT[tone]
        )}
      >
        {prefix}{value}
      </dd>
    </div>
  );
}

function displayValue(item: KeyValueItem): string {
  return item.format === undefined ? item.value : formatStatValue(item.value, item.format);
}

/** A description list of labelled figures (dl, dt, dd). */
export function KeyValueList({ items, layout = 'rows', className }: KeyValueListProps) {
  if (layout === 'grid') {
    return (
      <dl className={cn('grid grid-cols-2 gap-4 text-sm', className)}>
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className={cn('font-semibold tabular-nums', TONE_TEXT[item.tone ?? 'neutral'])}>
              {item.prefix}
              {displayValue(item)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn('space-y-2', className)}>
      {items.map((item) => (
        <KeyValueRow
          key={item.id}
          label={item.label}
          subtitle={item.subtitle}
          value={displayValue(item)}
          prefix={item.prefix}
          tone={item.tone}
          icon={item.icon}
        />
      ))}
    </dl>
  );
}

export default KeyValueList;
