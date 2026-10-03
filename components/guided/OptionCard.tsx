import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Large, full-width tap target used by the landing-page intent picker (link
 * mode) and by the intake wizard's choice questions (radio mode).
 *
 * Server-renderable: it has no hooks, so link-mode cards render on the
 * server; radio-mode cards take event handlers and therefore render inside a
 * client parent (the wizard). Radio-mode cards expect a parent with
 * role="radiogroup" that handles arrow-key navigation.
 */

interface OptionCardBaseProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** 'emphasis' tints the card with the brand scale (e.g. "Continue with my profile"). */
  tone?: 'default' | 'emphasis';
  className?: string;
}

export interface OptionCardLinkProps extends OptionCardBaseProps {
  href: Route;
  selected?: never;
  onSelect?: never;
  tabIndex?: never;
}

export interface OptionCardRadioProps extends OptionCardBaseProps {
  href?: never;
  selected: boolean;
  onSelect: () => void;
  /** Roving tabindex, managed by the parent radiogroup. */
  tabIndex?: number;
}

export type OptionCardProps = OptionCardLinkProps | OptionCardRadioProps;

const SURFACE =
  'group flex w-full min-h-[64px] items-center gap-4 rounded-xl border p-4 text-left transition-colors ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const TONE = {
  default: 'border-border bg-card text-card-foreground hover:border-sage-400 dark:hover:border-sage-500',
  emphasis:
    'border-sage-400 bg-sage-50 text-foreground hover:border-sage-500 dark:border-sage-500 dark:bg-sage-800/50 dark:hover:border-sage-400',
  selected: 'border-sage-400 bg-sage-50 text-foreground dark:border-sage-500 dark:bg-sage-800/50',
} as const;

function CardBody({ title, description, icon: Icon, selected }: OptionCardBaseProps & { selected?: boolean }) {
  return (
    <>
      {Icon && (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage-100 dark:bg-sage-700"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5 text-sage-600 dark:text-sage-300" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-semibold leading-snug',
            selected ? 'text-sage-700 dark:text-sage-200' : 'text-foreground'
          )}
        >
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>
    </>
  );
}

export function OptionCard(props: OptionCardProps) {
  const { title, description, icon, tone = 'default', className } = props;

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cn(SURFACE, TONE[tone], className)}>
        <CardBody title={title} description={description} icon={icon} />
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sage-600 dark:group-hover:text-sage-300"
          aria-hidden="true"
        />
      </Link>
    );
  }

  const { selected, onSelect, tabIndex } = props;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onSelect}
      className={cn(SURFACE, selected ? TONE.selected : TONE[tone], className)}
    >
      <CardBody title={title} description={description} icon={icon} selected={selected} />
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? 'border-sage-600 bg-sage-600 text-white dark:border-sage-400 dark:bg-sage-400 dark:text-sage-900'
            : 'border-muted-foreground/40'
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

export default OptionCard;
