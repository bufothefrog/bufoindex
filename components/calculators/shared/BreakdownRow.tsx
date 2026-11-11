import React from 'react';
import { LucideIcon } from 'lucide-react';
import { KeyValueRow, type KeyValuePrefix } from '@/components/ui/results/KeyValueList';
import { toneFromLegacy, type Tone } from '@/lib/design-system/tone';

type RowVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BreakdownRowProps {
  icon?: LucideIcon;
  label: string;
  subtitle?: string;
  value: string | number;
  prefix?: KeyValuePrefix;
  tone?: Tone;
  /** @deprecated Use `tone`; it maps through toneFromLegacy (danger is negative). */
  variant?: RowVariant;
  className?: string;
}

/**
 * A standalone KeyValueRow (div elements, not dt and dd). Inside a list of
 * figures prefer KeyValueList, which gives the rows description-list
 * semantics.
 */
export function BreakdownRow({ tone, variant = 'default', ...row }: BreakdownRowProps) {
  return <KeyValueRow {...row} tone={tone ?? toneFromLegacy(variant)} standalone />;
}

export default BreakdownRow;
