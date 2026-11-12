/**
 * Calculator Layout Template
 * Standardized layout for all BufoIndex calculators
 *
 * Results follow the inputs on their own (O8): there is no Calculate button.
 * Desktop (lg and up): a two-column grid, inputs and results. Below lg: an
 * Inputs | Results tab bar that sticks to the top of the viewport and a
 * sticky bottom action bar whose one action is "See results" / "Edit
 * inputs". The mobile view switches to Results only when asked (the bar, the
 * tab bar or showResultsKey), never because a run finished. Panel visibility
 * is driven by CSS classes (hidden / lg:block) so server and client render
 * the same markup and nothing reads window.matchMedia during render.
 */

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Disclaimer } from '@/components/ui/results';
import { ArrowLeft, ArrowRight, Calculator } from 'lucide-react';
import { ResponsiveGrid, InputSection, ResultSection, EmptyStateSection, Container } from './ResponsiveGrid';

/** Which panel the mobile (below lg) view shows. */
type CalculatorMobileTab = 'inputs' | 'results';

/** The empty state: results are missing only while a field is invalid. */
const LIVE_EMPTY_STATE = {
  title: 'No results yet',
  description: 'Results appear here as soon as every field holds a valid value.',
} as const;

export interface CalculatorLayoutProps {
  title: string;
  description: string;
  inputSections: React.ReactNode;
  resultSection?: React.ReactNode;
  /**
   * Rendered immediately after resultSection inside the results area (the
   * mobile Results tab and the desktop results column), and only while
   * resultSection is present. Used for the post-results "What next?" card.
   */
  resultFooter?: React.ReactNode;
  errors?: Record<string, string>;
  /** Accessible name of the results panel, which then becomes a region. */
  resultsLabel?: string;
  disclaimer?: string;
  className?: string;
  testId?: string;
  /**
   * Changing this value after mount switches the mobile view to Results and
   * scrolls the tab bar into view (when resultSection is present and there
   * are no errors), e.g. after the `?from=profile` handoff from the intake.
   */
  showResultsKey?: string | number;
}

export function CalculatorLayout({
  title,
  description,
  inputSections,
  resultSection,
  resultFooter,
  errors = {},
  resultsLabel,
  disclaimer,
  className,
  testId,
  showResultsKey,
}: CalculatorLayoutProps) {
  const hasErrors = Object.keys(errors).length > 0;
  const hasResults = !!resultSection;

  const [mobileTab, setMobileTab] = useState<CalculatorMobileTab>('inputs');
  // Bumped whenever the mobile view should scroll back to the tab bar.
  const [scrollRequest, setScrollRequest] = useState(0);
  const [prevShowResultsKey, setPrevShowResultsKey] = useState(showResultsKey);

  // Derive the tab switch from the prop transition during render (no effect,
  // no extra paint): https://react.dev/learn/you-might-not-need-an-effect
  if (showResultsKey !== prevShowResultsKey) {
    setPrevShowResultsKey(showResultsKey);
    if (hasResults && !hasErrors) {
      if (mobileTab !== 'results') setMobileTab('results');
      setScrollRequest((n) => n + 1);
    }
  }

  const anchorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRequest === 0) return;
    const anchor = anchorRef.current;
    // The anchor is lg:hidden, so on desktop it has no layout box and desktop
    // scrolling is never touched.
    if (!anchor || anchor.getClientRects().length === 0) return;
    if (anchor.getBoundingClientRect().top >= 0) return; // already in view
    if (typeof anchor.scrollIntoView !== 'function') return;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    anchor.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [scrollRequest]);

  const selectTab = (tab: CalculatorMobileTab) => {
    setMobileTab(tab);
    setScrollRequest((n) => n + 1);
  };

  const tabIds = useId();
  const inputsPanelId = `${tabIds}-inputs`;
  const resultsPanelId = `${tabIds}-results`;

  const showInputsOnMobile = mobileTab === 'inputs';
  const showResultsOnMobile = mobileTab === 'results';

  return (
    <div className={cn("calculator-container", className)} data-testid={testId}>
      <Container className="px-0 py-4 sm:p-6">
        {/* Header Section */}
        <CalculatorHeader title={title} description={description} />

        {/* Mobile tab bar (below lg). The scroll anchor and the bar are direct
            children of Container so the bar can stick for the calculator's
            full height. */}
        <div ref={anchorRef} aria-hidden="true" className="lg:hidden" />
        <div className="lg:hidden sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-2">
          <div
            role="tablist"
            aria-label="Calculator view"
            className="flex gap-1 rounded-lg bg-muted p-1"
          >
            <MobileTabButton
              label="Inputs"
              isActive={mobileTab === 'inputs'}
              controls={inputsPanelId}
              onSelect={() => selectTab('inputs')}
            />
            <MobileTabButton
              label="Results"
              isActive={mobileTab === 'results'}
              controls={resultsPanelId}
              onSelect={() => selectTab('results')}
              indicator={hasResults}
            />
          </div>
        </div>

        {/* Main Grid Layout */}
        <ResponsiveGrid hasResults={hasResults}>
          {/* Input Section */}
          <InputSection
            span={hasResults ? 1 : 2}
            className={cn(
              !showInputsOnMobile && 'hidden lg:block',
              // Keep focused fields clear of the sticky bottom bar on mobile.
              'max-lg:pb-4 max-lg:[&_input]:scroll-mb-32 max-lg:[&_select]:scroll-mb-32 max-lg:[&_button]:scroll-mb-32'
            )}
          >
            <div id={inputsPanelId} className="space-y-6">
              {inputSections}

              {/* Mobile: errors stay in the flow; the actions live in the bar */}
              {hasErrors && (
                <ErrorList errors={errors} className="lg:hidden" />
              )}
            </div>
          </InputSection>

          {/* Results Section */}
          {hasResults ? (
            <ResultSection
              span={1}
              className={cn(!showResultsOnMobile && 'hidden lg:block')}
            >
              <div
                id={resultsPanelId}
                role={resultsLabel ? 'region' : undefined}
                aria-label={resultsLabel}
                className="space-y-6"
              >
                {resultSection}
                {resultFooter}
              </div>
            </ResultSection>
          ) : (
            /* Empty State: desktop right column; on mobile, the Results tab */
            <EmptyStateSection
              id={resultsPanelId}
              title={LIVE_EMPTY_STATE.title}
              description={LIVE_EMPTY_STATE.description}
              icon={Calculator}
              className={cn(!showResultsOnMobile && 'hidden lg:block')}
            />
          )}
        </ResponsiveGrid>

        {/* Footer */}
        {disclaimer && <Disclaimer text={disclaimer} />}

        {/* Mobile sticky action bar (below lg) */}
        <MobileActionBar
          errorCount={Object.keys(errors).length}
          activeTab={mobileTab}
          onToggleTab={() => selectTab(mobileTab === 'inputs' ? 'results' : 'inputs')}
        />
      </Container>
    </div>
  );
}

/**
 * Mobile tab button (44px tap target)
 */
interface MobileTabButtonProps {
  label: string;
  isActive: boolean;
  controls: string;
  onSelect: () => void;
  indicator?: boolean;
}

function MobileTabButton({ label, isActive, controls, onSelect, indicator = false }: MobileTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={controls}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {indicator && (
        <span className="h-1.5 w-1.5 rounded-full bg-sage-500 dark:bg-sage-400" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Calculator Header Component
 */
interface CalculatorHeaderProps {
  title: string;
  description: string;
  className?: string;
}

function CalculatorHeader({ title, description, className }: CalculatorHeaderProps) {
  return (
    <div className={cn("mb-4 text-center sm:mb-8", className)}>
      <h1 className="text-2xl font-bold text-foreground mb-2 sm:text-3xl">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground max-w-2xl mx-auto sm:text-base">
        {description}
      </p>
    </div>
  );
}

interface ErrorListProps {
  errors: Record<string, string>;
  className?: string;
}

function ErrorList({ errors, className }: ErrorListProps) {
  return (
    <div className={cn("p-4 bg-destructive/10 border border-destructive/20 rounded-md", className)}>
      <div className="text-sm text-destructive">
        <p className="font-medium mb-2">Please fix the following errors:</p>
        <ul className="list-disc list-inside space-y-1">
          {Object.entries(errors).map(([field, error]) => (
            <li key={field}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Mobile Action Bar
 * Sticky bottom bar shown below lg: the See results / Edit inputs toggle and
 * a count of the fields that need attention. It sits in the page flow at the
 * end of the layout, so scrolling to the bottom never hides the last field.
 */
interface MobileActionBarProps {
  errorCount: number;
  activeTab: CalculatorMobileTab;
  onToggleTab: () => void;
}

function MobileActionBar({ errorCount, activeTab, onToggleTab }: MobileActionBarProps) {
  const fieldsNeed = errorCount === 1 ? '1 field needs' : `${errorCount} fields need`;

  return (
    <div
      className={cn(
        "lg:hidden sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:mx-0 sm:rounded-t-lg sm:border-x sm:px-3"
      )}
    >
      <div aria-live="polite">
        {errorCount > 0 && (
          <p className="mb-2 text-center text-xs text-destructive dark:text-foreground">
            {fieldsNeed} attention before the results update.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="default"
          onClick={onToggleTab}
          className={cn("h-11 px-3", "min-w-0 flex-1")}
        >
          {activeTab === 'inputs' ? (
            <>
              See results
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </>
          ) : (
            <>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Edit inputs
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CalculatorLayout;
