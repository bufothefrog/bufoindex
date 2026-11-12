import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { BaseCard } from '@/components/ui/cards';
import { cn } from '@/lib/utils';

export interface DemoSectionProps {
  title: string;
  intro: string;
  children: React.ReactNode;
}

/** One gallery tab: its heading, a line on what it holds, then its blocks. */
export function DemoSection({ title, intro, children }: DemoSectionProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground">{intro}</p>
      </div>
      {children}
    </div>
  );
}

export interface DemoBlockProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

/**
 * A card that groups the entries for one component family. Below sm its
 * sides are narrower, so a full calculator card nested inside it (a
 * FieldSection with Restore defaults) still fits a 360px screen.
 */
export function DemoBlock({ title, icon, children, className }: DemoBlockProps) {
  return (
    <BaseCard
      title={title}
      icon={icon}
      className={cn('min-w-0', className)}
      headerClassName="px-2 sm:px-6"
      contentClassName="space-y-8 px-2 pb-3 sm:px-6 sm:pb-6"
    >
      {children}
    </BaseCard>
  );
}

export interface DemoEntryProps {
  /** The component or prop being shown, e.g. "StatTile tones". */
  name: string;
  /** Where it is used and what to know before reusing it. */
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** One entry: the component's name, a usage note, then the live sample. */
export function DemoEntry({ name, description, children, className }: DemoEntryProps) {
  return (
    <div className={cn('min-w-0 space-y-3', className)}>
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{name}</h4>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Inline code in a usage note; long names may break anywhere so a phone never scrolls sideways. */
export function Code({ children }: { children: React.ReactNode }) {
  return <code className="break-all font-mono text-xs">{children}</code>;
}

export default DemoSection;
