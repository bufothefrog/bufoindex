'use client';

import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Compass, LayoutTemplate, Moon, Palette, Rows3, Sliders, Sun, Table2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import ChartsSection from './sections/ChartsSection';
import ColorsSection from './sections/ColorsSection';
import ControlsSection from './sections/ControlsSection';
import FieldsSection from './sections/FieldsSection';
import GuidedSection from './sections/GuidedSection';
import LayoutsSection from './sections/LayoutsSection';
import ResultsSection from './sections/ResultsSection';
import TypographySection from './sections/TypographySection';

type SectionKey = 'fields' | 'controls' | 'results' | 'charts' | 'guided' | 'layouts' | 'colors' | 'typography';

const SECTIONS: readonly { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: 'fields', label: 'Fields', icon: Rows3 },
  { key: 'controls', label: 'Controls', icon: Sliders },
  { key: 'results', label: 'Results', icon: Table2 },
  { key: 'charts', label: 'Charts', icon: BarChart3 },
  { key: 'guided', label: 'Guided flow', icon: Compass },
  { key: 'layouts', label: 'Layouts', icon: LayoutTemplate },
  { key: 'colors', label: 'Colors', icon: Palette },
  { key: 'typography', label: 'Typography', icon: Type },
];

/** The active tab; idPrefix keeps control ids unique when it renders once per theme. */
function Section({ section, idPrefix }: { section: SectionKey; idPrefix: string }) {
  switch (section) {
    case 'fields':
      return <FieldsSection idPrefix={idPrefix} />;
    case 'controls':
      return <ControlsSection idPrefix={idPrefix} />;
    case 'results':
      return <ResultsSection />;
    case 'charts':
      return <ChartsSection />;
    case 'guided':
      return <GuidedSection />;
    case 'layouts':
      return <LayoutsSection idPrefix={idPrefix} />;
    case 'colors':
      return <ColorsSection />;
    case 'typography':
      return <TypographySection />;
  }
}

/** One theme's copy of the active tab, forced light or dark whatever the site theme is. */
function ThemePanel({ theme, section }: { theme: 'light' | 'dark'; section: SectionKey }) {
  const Icon = theme === 'light' ? Sun : Moon;
  return (
    <div className={cn(theme, 'min-w-0')} style={{ colorScheme: theme }}>
      <div className="rounded-lg border border-border bg-background text-foreground">
        <p className="flex items-center gap-2 border-b border-border px-4 py-3 text-lg font-semibold">
          <Icon className="h-5 w-5" aria-hidden="true" />
          {theme === 'light' ? 'Light theme' : 'Dark theme'}
        </p>
        <div className="p-3 sm:p-4 lg:p-6">
          <Section section={section} idPrefix={theme} />
        </div>
      </div>
    </div>
  );
}

/**
 * The public component gallery: what the site is built from, one tab per
 * family, shown in the light and dark theme side by side or once in the
 * site's theme.
 */
export function DemoClient() {
  const { resolvedTheme } = useTheme();
  const [sideBySide, setSideBySide] = useState(true);
  const [section, setSection] = useState<SectionKey>('fields');

  return (
    <div className="min-h-screen px-4 py-4 lg:p-6 xl:p-8">
      <div className={cn('mx-auto', sideBySide ? 'max-w-[1800px]' : 'max-w-5xl')}>
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">BufoIndex component gallery</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            The reusable UI every calculator, the intake and the overview are built from.
          </p>

          <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Theme:</span>
              <ThemeToggle />
              <span className="text-xs text-muted-foreground">{resolvedTheme}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View:</span>
              <Button variant={sideBySide ? 'default' : 'outline'} size="sm" onClick={() => setSideBySide(!sideBySide)}>
                {sideBySide ? 'Side by side' : 'Single view'}
              </Button>
            </div>
          </div>

          <nav aria-label="Gallery sections" className="flex flex-wrap justify-center gap-2">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={section === key ? 'default' : 'outline'}
                size="sm"
                aria-pressed={section === key}
                onClick={() => setSection(key)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Button>
            ))}
          </nav>
        </div>

        {sideBySide ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 xl:gap-8">
            <ThemePanel theme="light" section={section} />
            <ThemePanel theme="dark" section={section} />
          </div>
        ) : (
          <Section section={section} idPrefix="single" />
        )}
      </div>
    </div>
  );
}
