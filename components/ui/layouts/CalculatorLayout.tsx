/**
 * Calculator Layout Template
 * Standardized layout for all BufoIndex calculators
 *
 * Desktop (lg and up): a two-column grid (inputs | results).
 * Below lg (mobileMode 'tabs', the default): an Inputs | Results tab bar that
 * sticks to the top of the viewport and a sticky bottom action bar. Panel
 * visibility is driven by CSS classes (hidden / lg:block) so server and
 * client render the same markup and nothing reads window.matchMedia during
 * render.
 *
 * `liveResults` (every calculator on CalculatorPage, O8): results follow the
 * inputs, so there is no desktop Calculate card, and the mobile action bar's
 * primary action is "See results" / "Edit inputs". In live mode the mobile
 * view switches to Results only when `showResultsKey` changes, never on its
 * own while the person types.
 *
 * Sharing was removed (O6); `onShare` stays in the props type, ignored,
 * until x2 so the older shells compile.
 */

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Disclaimer } from '@/components/ui/results/Disclaimer';
import { ArrowLeft, ArrowRight, Calculator, Loader2 } from 'lucide-react';
import { ResponsiveGrid, InputSection, ResultSection, EmptyStateSection, Container, type FeatureDotColor } from './ResponsiveGrid';
import { BaseCard } from '../cards/BaseCard';

/**
 * @deprecated Sharing was removed (O6). Kept so the older shells compile until x1/x2.
 */
export type ShareResult =
  | { status: 'shared' }
  | { status: 'copied' }
  | { status: 'error'; url: string };

/** @deprecated Sharing was removed (O6). */
export type ShareHandler = () => void | ShareResult | Promise<void | ShareResult>;

/** Which panel the mobile (below lg) view shows. */
export type CalculatorMobileTab = 'inputs' | 'results';

/** How the layout behaves below lg. Desktop is identical in both modes. */
export type CalculatorMobileMode = 'tabs' | 'stacked';

export interface CalculatorEmptyStateConfig {
  title?: string;
  description?: string;
  features?: Array<{
    color: FeatureDotColor;
    text: string;
  }>;
}

/** Empty state for calculators with a Calculate button. */
export const CALCULATE_EMPTY_STATE: CalculatorEmptyStateConfig = {
  title: 'Ready to Calculate?',
  description: 'Fill in your information and click Calculate to see your personalized results.',
  features: [],
};

/** Empty state for live calculators: results follow the inputs once they are valid. */
export const LIVE_EMPTY_STATE: CalculatorEmptyStateConfig = {
  title: 'Results appear here',
  description: 'Results update as you edit the inputs. Fields that need attention are marked.',
  features: [],
};

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
  /** Rendered between the header and the grid (a page-level notice). */
  notice?: React.ReactNode;
  /**
   * Results follow the inputs: no Calculate button anywhere, and the mobile
   * action bar toggles between inputs and results.
   */
  liveResults?: boolean;
  isCalculating?: boolean;
  onCalculate?: () => void;
  /** @deprecated Ignored: sharing was removed (O6). Removed in x2. */
  onShare?: ShareHandler;
  calculateButtonText?: string;
  calculatingText?: string;
  errors?: Record<string, string>;
  /** Defaults to CALCULATE_EMPTY_STATE, or LIVE_EMPTY_STATE with liveResults. */
  emptyStateConfig?: CalculatorEmptyStateConfig;
  disclaimer?: string;
  className?: string;
  testId?: string;
  /**
   * Below lg: 'tabs' (default) shows an Inputs | Results tab bar and a sticky
   * bottom action bar; 'stacked' keeps the original single-column stack with
   * the in-flow Calculate card.
   */
  mobileMode?: CalculatorMobileMode;
  /**
   * Initial mobile tab. Must be deterministic (no window reads) so the server
   * render and hydration agree. Defaults to 'inputs'.
   */
  defaultMobileTab?: CalculatorMobileTab;
  /**
   * Changing this value after mount switches the mobile view to Results and
   * scrolls the tab bar into view (when resultSection is present and there
   * are no errors). Without liveResults the layout also does this on its own
   * when isCalculating goes true -> false, when resultSection first appears,
   * and after the mobile Calculate button runs a synchronous calculation.
   */
  showResultsKey?: string | number;
  /**
   * Shorter Calculate label for the mobile action bar on narrow phones (below
   * sm). Defaults to the first word of calculateButtonText ("Calculate").
   */
  mobileCalculateButtonText?: string;
}

/** First word of a button label, minus trailing dots ("Running Monte Carlo..." -> "Running"). */
function firstWord(text: string): string {
  const word = text.trim().split(/\s+/)[0] ?? text;
  return word.replace(/(\.|…)+$/, '');
}

export function CalculatorLayout({
  title,
  description,
  inputSections,
  resultSection,
  resultFooter,
  notice,
  liveResults = false,
  isCalculating = false,
  onCalculate,
  calculateButtonText = 'Calculate',
  calculatingText,
  errors = {},
  emptyStateConfig,
  disclaimer,
  className,
  testId,
  mobileMode = 'tabs',
  defaultMobileTab = 'inputs',
  showResultsKey,
  mobileCalculateButtonText,
}: CalculatorLayoutProps) {
  const emptyState = emptyStateConfig ?? (liveResults ? LIVE_EMPTY_STATE : CALCULATE_EMPTY_STATE);
  const errorCount = Object.keys(errors).length;
  const hasErrors = errorCount > 0;
  const hasResults = !!resultSection;
  const useTabs = mobileMode === 'tabs';
  const loadingText = calculatingText || `${calculateButtonText}...`;

  const [mobileTab, setMobileTab] = useState<CalculatorMobileTab>(defaultMobileTab);
  // Bumped whenever the mobile view should scroll back to the tab bar.
  const [scrollRequest, setScrollRequest] = useState(0);
  // Set by the mobile Calculate button; resolved once a calculation settles.
  const [pendingReveal, setPendingReveal] = useState(false);
  const [prevCalculating, setPrevCalculating] = useState(isCalculating);
  const [prevShowResultsKey, setPrevShowResultsKey] = useState(showResultsKey);
  const [prevHasResults, setPrevHasResults] = useState(hasResults);

  // Derive tab switches from prop transitions during render (no effect, no
  // extra paint): https://react.dev/learn/you-might-not-need-an-effect
  let shouldReveal = false;
  if (showResultsKey !== prevShowResultsKey) {
    setPrevShowResultsKey(showResultsKey);
    shouldReveal = true;
  }
  if (isCalculating !== prevCalculating) {
    setPrevCalculating(isCalculating);
    if (!liveResults && prevCalculating && !isCalculating) shouldReveal = true;
  }
  if (hasResults !== prevHasResults) {
    // First results after mount (a synchronous calculator).
    setPrevHasResults(hasResults);
    if (!liveResults && hasResults) shouldReveal = true;
  }
  if (pendingReveal && !isCalculating) {
    // Covers synchronous calculators and memoized (instant) recalculations.
    setPendingReveal(false);
    shouldReveal = true;
  }
  if (useTabs && shouldReveal && hasResults && !hasErrors) {
    if (mobileTab !== 'results') setMobileTab('results');
    setScrollRequest((n) => n + 1);
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

  const handleMobileCalculate = () => {
    if (!onCalculate) return;
    setPendingReveal(true);
    onCalculate();
  };

  const tabIds = useId();
  const inputsPanelId = `${tabIds}-inputs`;
  const resultsPanelId = `${tabIds}-results`;

  const showInputsOnMobile = !useTabs || mobileTab === 'inputs';
  const showResultsOnMobile = !useTabs || mobileTab === 'results';
  const showActionBar = useTabs && (liveResults || !!onCalculate || hasResults);
  // Live mode has no Calculate card, so its error list shows at every width.
  const showInlineErrors = hasErrors && (liveResults || useTabs);

  return (
    <div className={cn('calculator-container', className)} data-testid={testId}>
      <Container className="px-0 py-4 sm:p-6">
        {/* Header Section */}
        <CalculatorHeader title={title} description={description} />

        {notice}

        {/* Mobile tab bar (below lg). The scroll anchor and the bar are direct
            children of Container so the bar can stick for the calculator's
            full height. */}
        {useTabs && <div ref={anchorRef} aria-hidden="true" className="lg:hidden" />}
        {useTabs && (
          <div className="lg:hidden sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm sm:mx-0 sm:rounded-lg sm:border sm:px-2">
            <div role="tablist" aria-label="Calculator view" className="flex gap-1 rounded-lg bg-muted p-1">
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
        )}

        {/* Main Grid Layout */}
        <ResponsiveGrid hasResults={hasResults}>
          {/* Input Section */}
          <InputSection
            span={hasResults ? 1 : 2}
            className={cn(
              !showInputsOnMobile && 'hidden lg:block',
              // Keep focused fields clear of the sticky bottom bar on mobile.
              useTabs && 'max-lg:pb-4 max-lg:[&_input]:scroll-mb-32 max-lg:[&_select]:scroll-mb-32 max-lg:[&_button]:scroll-mb-32'
            )}
          >
            <div id={inputsPanelId} className="space-y-6">
              {inputSections}

              {/* Errors stay in the flow; the Calculate card (if any) is desktop-only */}
              {showInlineErrors && <ErrorList errors={errors} className={liveResults ? undefined : 'lg:hidden'} />}
            </div>

            {/* Calculate Button (desktop; also mobile in 'stacked' mode) */}
            {!liveResults && (
              <CalculateButton
                onClick={onCalculate}
                isLoading={isCalculating}
                buttonText={calculateButtonText}
                loadingText={loadingText}
                errors={errors}
                disabled={!onCalculate || hasErrors}
                className={useTabs ? 'hidden lg:block' : undefined}
              />
            )}
          </InputSection>

          {/* Results Section */}
          {hasResults && (
            <ResultSection span={1} className={cn(!showResultsOnMobile && 'hidden lg:block')}>
              <div id={resultsPanelId} className="space-y-6">
                {resultSection}
                {resultFooter}
              </div>
            </ResultSection>
          )}

          {/* Mobile results tab while the first run is in flight */}
          {useTabs && !hasResults && isCalculating && mobileTab === 'results' && (
            <div id={resultsPanelId} className="lg:hidden">
              <BaseCard>
                <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>{loadingText}</span>
                </div>
              </BaseCard>
            </div>
          )}

          {/* Empty State: desktop right column; on mobile, the Results tab */}
          {!hasResults && !isCalculating && (
            <EmptyStateSection
              id={resultsPanelId}
              title={emptyState.title ?? ''}
              description={emptyState.description ?? ''}
              icon={Calculator}
              features={emptyState.features}
              className={cn(useTabs && !showResultsOnMobile && 'hidden lg:block')}
            />
          )}
        </ResponsiveGrid>

        {/* Footer */}
        {disclaimer && <DisclaimerFooter text={disclaimer} />}

        {/* Mobile sticky action bar (below lg) */}
        {showActionBar && (
          <MobileActionBar
            liveResults={liveResults}
            onCalculate={onCalculate ? handleMobileCalculate : undefined}
            isLoading={isCalculating}
            buttonText={calculateButtonText}
            compactButtonText={mobileCalculateButtonText ?? firstWord(calculateButtonText)}
            loadingText={loadingText}
            compactLoadingText={`${firstWord(loadingText)}…`}
            disabled={!onCalculate || hasErrors}
            errorCount={errorCount}
            activeTab={mobileTab}
            hasResults={hasResults}
            onToggleTab={() => selectTab(mobileTab === 'inputs' ? 'results' : 'inputs')}
          />
        )}
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
        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {indicator && <span className="h-1.5 w-1.5 rounded-full bg-sage-500 dark:bg-sage-400" aria-hidden="true" />}
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

export function CalculatorHeader({ title, description, className }: CalculatorHeaderProps) {
  return (
    <div className={cn('mb-4 text-center sm:mb-8', className)}>
      <h1 className="text-2xl font-bold text-foreground mb-2 sm:text-3xl">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-2xl mx-auto sm:text-base">{description}</p>
    </div>
  );
}

interface ErrorListProps {
  errors: Record<string, string>;
  className?: string;
}

function ErrorList({ errors, className }: ErrorListProps) {
  return (
    <div className={cn('p-4 bg-destructive/10 border border-destructive/20 rounded-md', className)}>
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
 * Calculate Button Component
 */
interface CalculateButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  buttonText?: string;
  loadingText?: string;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

export function CalculateButton({
  onClick,
  isLoading = false,
  buttonText = 'Calculate',
  loadingText = 'Calculating...',
  errors = {},
  disabled = false,
  className,
}: CalculateButtonProps) {
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <BaseCard className={className}>
      <Button onClick={onClick} disabled={disabled || isLoading || !onClick} size="lg" className="w-full text-lg py-4">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            <Calculator className="mr-2 h-5 w-5" />
            {buttonText}
          </>
        )}
      </Button>

      {/* Error Display */}
      {hasErrors && <ErrorList errors={errors} className="mt-4" />}
    </BaseCard>
  );
}

/**
 * Mobile Action Bar
 * Sticky bottom bar shown below lg. With liveResults its one action toggles
 * See results / Edit inputs; otherwise it holds Calculate plus (once results
 * exist) that toggle. It sits in the page flow at the end of the layout, so
 * scrolling to the bottom never hides the last field.
 */
export interface MobileActionBarProps {
  liveResults?: boolean;
  onCalculate?: () => void;
  isLoading?: boolean;
  buttonText: string;
  compactButtonText: string;
  loadingText: string;
  compactLoadingText: string;
  disabled?: boolean;
  errorCount?: number;
  activeTab: CalculatorMobileTab;
  hasResults: boolean;
  onToggleTab: () => void;
  className?: string;
}

export function MobileActionBar({
  liveResults = false,
  onCalculate,
  isLoading = false,
  buttonText,
  compactButtonText,
  loadingText,
  compactLoadingText,
  disabled = false,
  errorCount = 0,
  activeTab,
  hasResults,
  onToggleTab,
  className,
}: MobileActionBarProps) {
  const toggleLabel =
    activeTab === 'inputs' ? (
      <>
        See results
        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </>
    ) : (
      <>
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Edit inputs
      </>
    );

  return (
    <div
      className={cn(
        'lg:hidden sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        'sm:mx-0 sm:rounded-t-lg sm:border-x sm:px-3',
        className
      )}
    >
      <div aria-live="polite">
        {errorCount > 0 && (
          <p className="mb-2 text-center text-xs text-destructive dark:text-foreground">
            {errorCount === 1 ? '1 field needs' : `${errorCount} fields need`} attention
            {liveResults ? '.' : ' before calculating.'}
          </p>
        )}
      </div>

      {liveResults ? (
        <Button type="button" onClick={onToggleTab} className="h-11 w-full px-3">
          {toggleLabel}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          {hasResults && (
            <Button type="button" variant="outline" onClick={onToggleTab} className="h-11 shrink-0 px-3">
              {toggleLabel}
            </Button>
          )}

          <Button
            type="button"
            onClick={onCalculate}
            disabled={disabled || isLoading || !onCalculate}
            className="h-11 min-w-0 flex-1 px-3"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Calculator className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate sm:hidden">{isLoading ? compactLoadingText : compactButtonText}</span>
            <span className="hidden truncate sm:inline">{isLoading ? loadingText : buttonText}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Disclaimer Footer: the shared Disclaimer (components/ui/results).
 * Kept under this name for existing imports.
 */
export const DisclaimerFooter = Disclaimer;

/**
 * Pre-configured Calculator Layouts
 */

/**
 * Simple Calculator Layout - For basic calculators
 *
 * @deprecated Use CalculatorPage (components/calculators/shared). Kept for /demo until x2.
 */
export function SimpleCalculatorLayout(props: Omit<CalculatorLayoutProps, 'emptyStateConfig'>) {
  return (
    <CalculatorLayout
      {...props}
      emptyStateConfig={{
        title: 'Ready to Calculate?',
        description: 'Enter your information and click Calculate to see your results.',
        features: [
          { color: 'success', text: 'Instant calculations' },
          { color: 'info', text: 'Educational insights' },
          { color: 'warning', text: 'Personalized results' },
        ],
      }}
    />
  );
}

/**
 * Advanced Calculator Layout - For complex calculators with multiple features
 *
 * @deprecated Use CalculatorPage (components/calculators/shared). Kept for /demo until x2.
 */
export function AdvancedCalculatorLayout(props: Omit<CalculatorLayoutProps, 'emptyStateConfig'>) {
  return (
    <CalculatorLayout
      {...props}
      emptyStateConfig={{
        title: 'Ready to Optimize?',
        description: 'Complete your financial profile to get mathematically optimized recommendations.',
        features: [
          { color: 'success', text: 'Mathematical optimization' },
          { color: 'info', text: 'Tax efficiency analysis' },
          { color: 'warning', text: 'Opportunity analysis' },
          { color: 'destructive', text: 'Risk assessment' },
        ],
      }}
    />
  );
}

export default CalculatorLayout;
