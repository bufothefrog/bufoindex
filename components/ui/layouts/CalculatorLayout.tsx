/**
 * Calculator Layout Template
 * Standardized layout for all BufoIndex calculators
 *
 * Desktop (lg and up): the original two-column grid, unchanged.
 * Below lg (mobileMode 'tabs', the default): an Inputs | Results tab bar that
 * sticks to the top of the viewport and a sticky bottom action bar holding
 * Calculate, Share and an inputs/results toggle. Panel visibility is driven
 * by CSS classes (hidden / lg:block) so server and client render the same
 * markup and nothing reads window.matchMedia during render.
 */

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Calculator, Loader2, Share2 } from 'lucide-react';
import { ResponsiveGrid, InputSection, ResultSection, EmptyStateSection, Container, type FeatureDotColor } from './ResponsiveGrid';
import { BaseCard } from '../cards/BaseCard';

/**
 * Result of a share handler. Returning `copied` shows a transient inline
 * "Link copied" confirmation; `error` surfaces the URL for manual copying.
 * Handlers may also return nothing (e.g. the native share sheet handled it).
 */
export type ShareResult =
  | { status: 'shared' }
  | { status: 'copied' }
  | { status: 'error'; url: string };

export type ShareHandler = () => void | ShareResult | Promise<void | ShareResult>;

/** Which panel the mobile (below lg) view shows. */
export type CalculatorMobileTab = 'inputs' | 'results';

/** How the layout behaves below lg. Desktop is identical in both modes. */
export type CalculatorMobileMode = 'tabs' | 'stacked';

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
  isCalculating?: boolean;
  onCalculate?: () => void;
  onShare?: ShareHandler;
  calculateButtonText?: string;
  calculatingText?: string;
  errors?: Record<string, string>;
  emptyStateConfig?: {
    title?: string;
    description?: string;
    features?: Array<{
      color: FeatureDotColor;
      text: string;
    }>;
  };
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
   * are no errors). The layout already does this on its own when
   * isCalculating goes true -> false, when resultSection first appears, and
   * after the mobile Calculate button runs a synchronous calculation; use
   * this for anything else (e.g. results seeded from query params).
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
  isCalculating = false,
  onCalculate,
  onShare,
  calculateButtonText = "Calculate",
  calculatingText,
  errors = {},
  emptyStateConfig = {
    title: "Ready to Calculate?",
    description: "Fill in your information and click Calculate to see your personalized results.",
    features: []
  },
  disclaimer,
  className,
  testId,
  mobileMode = 'tabs',
  defaultMobileTab = 'inputs',
  showResultsKey,
  mobileCalculateButtonText
}: CalculatorLayoutProps) {
  const hasErrors = Object.keys(errors).length > 0;
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
  if (isCalculating !== prevCalculating) {
    setPrevCalculating(isCalculating);
    if (prevCalculating && !isCalculating) shouldReveal = true;
  }
  if (showResultsKey !== prevShowResultsKey) {
    setPrevShowResultsKey(showResultsKey);
    shouldReveal = true;
  }
  if (hasResults !== prevHasResults) {
    // First results after mount (a share link, or a synchronous calculator).
    setPrevHasResults(hasResults);
    if (hasResults) shouldReveal = true;
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
  const showActionBar = useTabs && (!!onCalculate || !!onShare || hasResults);

  return (
    <div className={cn("calculator-container", className)} data-testid={testId}>
      <Container className="px-0 py-4 sm:p-6">
        {/* Header Section */}
        <CalculatorHeader title={title} description={description} />

        {/* Mobile tab bar (below lg). The scroll anchor and the bar are direct
            children of Container so the bar can stick for the calculator's
            full height. */}
        {useTabs && <div ref={anchorRef} aria-hidden="true" className="lg:hidden" />}
        {useTabs && (
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

              {/* Mobile: errors stay in the flow; the actions live in the bar */}
              {useTabs && hasErrors && (
                <ErrorList errors={errors} className="lg:hidden" />
              )}
            </div>

            {/* Calculate Button (desktop; also mobile in 'stacked' mode) */}
            <CalculateButton
              onClick={onCalculate}
              isLoading={isCalculating}
              buttonText={calculateButtonText}
              loadingText={loadingText}
              errors={errors}
              disabled={!onCalculate || hasErrors}
              onShare={onShare}
              className={useTabs ? 'hidden lg:block' : undefined}
            />
          </InputSection>

          {/* Results Section */}
          {hasResults && (
            <ResultSection
              span={1}
              className={cn(!showResultsOnMobile && 'hidden lg:block')}
            >
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
              title={emptyStateConfig.title!}
              description={emptyStateConfig.description!}
              icon={Calculator}
              features={emptyStateConfig.features}
              className={cn(useTabs && !showResultsOnMobile && 'hidden lg:block')}
            />
          )}
        </ResponsiveGrid>

        {/* Footer */}
        {disclaimer && <DisclaimerFooter text={disclaimer} />}

        {/* Mobile sticky action bar (below lg) */}
        {showActionBar && (
          <MobileActionBar
            onCalculate={onCalculate ? handleMobileCalculate : undefined}
            isLoading={isCalculating}
            buttonText={calculateButtonText}
            compactButtonText={mobileCalculateButtonText ?? firstWord(calculateButtonText)}
            loadingText={loadingText}
            compactLoadingText={`${firstWord(loadingText)}…`}
            disabled={!onCalculate || hasErrors}
            errorCount={Object.keys(errors).length}
            onShare={onShare}
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

export function CalculatorHeader({ title, description, className }: CalculatorHeaderProps) {
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

/**
 * Share handling shared by the desktop card and the mobile bar: runs the
 * handler and keeps the transient "Link copied" / manual-copy feedback.
 */
function useShareFeedback(onShare?: ShareHandler) {
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const share = async () => {
    if (!onShare) return;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    const result = await onShare();

    if (result && result.status === 'copied') {
      setShareFeedback(result);
      clearTimerRef.current = setTimeout(() => setShareFeedback(null), 2500);
    } else if (result && result.status === 'error') {
      setShareFeedback(result);
    } else {
      setShareFeedback(null);
    }
  };

  const dismiss = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setShareFeedback(null);
  };

  return { shareFeedback, share, dismiss };
}

interface ShareFeedbackMessageProps {
  feedback: ShareResult | null;
  className?: string;
}

function ShareFeedbackMessage({ feedback, className }: ShareFeedbackMessageProps) {
  if (feedback?.status === 'copied') {
    return (
      <p className={cn("text-center text-sm text-muted-foreground", className)}>
        Link copied to clipboard
      </p>
    );
  }
  if (feedback?.status === 'error') {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        <p className="mb-1">Couldn&apos;t copy automatically. Copy this link:</p>
        <input
          readOnly
          value={feedback.url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Shareable link"
          className="w-full rounded-md border-input bg-background px-2 py-1 text-xs text-foreground"
        />
      </div>
    );
  }
  return null;
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
 * Calculate Button Component
 */
interface CalculateButtonProps {
  onClick?: () => void;
  isLoading?: boolean;
  buttonText?: string;
  loadingText?: string;
  errors?: Record<string, string>;
  disabled?: boolean;
  onShare?: ShareHandler;
  className?: string;
}

export function CalculateButton({
  onClick,
  isLoading = false,
  buttonText = "Calculate",
  loadingText = "Calculating...",
  errors = {},
  disabled = false,
  onShare,
  className
}: CalculateButtonProps) {
  const hasErrors = Object.keys(errors).length > 0;
  const { shareFeedback, share } = useShareFeedback(onShare);

  return (
    <BaseCard className={className}>
      <Button
        onClick={onClick}
        disabled={disabled || isLoading || !onClick}
        size="lg"
        className="w-full text-lg py-4"
      >
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

      {/* Share Action */}
      {onShare && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={share}
            className="w-full mt-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <div aria-live="polite">
            <ShareFeedbackMessage feedback={shareFeedback} className="mt-2" />
          </div>
        </>
      )}

      {/* Error Display */}
      {hasErrors && <ErrorList errors={errors} className="mt-4" />}
    </BaseCard>
  );
}

/**
 * Mobile Action Bar
 * Sticky bottom bar shown below lg: Calculate, Share, and (once results
 * exist) a See results / Edit inputs toggle. It sits in the page flow at the
 * end of the layout, so scrolling to the bottom never hides the last field.
 */
export interface MobileActionBarProps {
  onCalculate?: () => void;
  isLoading?: boolean;
  buttonText: string;
  compactButtonText: string;
  loadingText: string;
  compactLoadingText: string;
  disabled?: boolean;
  errorCount?: number;
  onShare?: ShareHandler;
  activeTab: CalculatorMobileTab;
  hasResults: boolean;
  onToggleTab: () => void;
  className?: string;
}

export function MobileActionBar({
  onCalculate,
  isLoading = false,
  buttonText,
  compactButtonText,
  loadingText,
  compactLoadingText,
  disabled = false,
  errorCount = 0,
  onShare,
  activeTab,
  hasResults,
  onToggleTab,
  className
}: MobileActionBarProps) {
  const { shareFeedback, share, dismiss } = useShareFeedback(onShare);

  return (
    <div
      className={cn(
        "lg:hidden sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-sm",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "sm:mx-0 sm:rounded-t-lg sm:border-x sm:px-3",
        className
      )}
    >
      <div aria-live="polite">
        {shareFeedback && (
          <div className="mb-2 flex items-start gap-2">
            <ShareFeedbackMessage feedback={shareFeedback} className="flex-1" />
            {shareFeedback.status === 'error' && (
              <Button variant="ghost" size="sm" onClick={dismiss} className="min-h-11 shrink-0">
                Done
              </Button>
            )}
          </div>
        )}
        {errorCount > 0 && (
          <p className="mb-2 text-center text-xs text-destructive dark:text-foreground">
            {errorCount === 1 ? '1 field needs' : `${errorCount} fields need`} attention before calculating.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasResults && (
          <Button
            type="button"
            variant="outline"
            onClick={onToggleTab}
            className="h-11 shrink-0 px-3"
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

        {onShare && (
          <Button
            type="button"
            variant="outline"
            onClick={share}
            aria-label="Share"
            className="h-11 w-11 shrink-0 p-0 sm:w-auto sm:px-3"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span className="ml-2 hidden sm:inline">Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Disclaimer Footer Component
 */
interface DisclaimerFooterProps {
  text?: string;
  className?: string;
}

export function DisclaimerFooter({
  text = "This calculator provides educational information only and should not be considered personalized financial advice. Consider consulting with a qualified financial advisor before making significant financial decisions.",
  className
}: DisclaimerFooterProps) {
  return (
    <div className={cn("mt-8 text-center lg:mt-12", className)}>
      <p className="text-sm text-muted-foreground max-w-4xl mx-auto">
        <strong>Disclaimer:</strong> {text}
      </p>
    </div>
  );
}

/**
 * Pre-configured Calculator Layouts
 */

/**
 * Simple Calculator Layout - For basic calculators
 */
export function SimpleCalculatorLayout(props: Omit<CalculatorLayoutProps, 'emptyStateConfig'>) {
  return (
    <CalculatorLayout
      {...props}
      emptyStateConfig={{
        title: "Ready to Calculate?",
        description: "Enter your information and click Calculate to see your results.",
        features: [
          { color: 'success', text: 'Instant calculations' },
          { color: 'info', text: 'Educational insights' },
          { color: 'warning', text: 'Personalized results' }
        ]
      }}
    />
  );
}

/**
 * Advanced Calculator Layout - For complex calculators with multiple features
 */
export function AdvancedCalculatorLayout(props: Omit<CalculatorLayoutProps, 'emptyStateConfig'>) {
  return (
    <CalculatorLayout
      {...props}
      emptyStateConfig={{
        title: "Ready to Optimize?",
        description: "Complete your financial profile to get mathematically optimized recommendations.",
        features: [
          { color: 'success', text: 'Mathematical optimization' },
          { color: 'info', text: 'Tax efficiency analysis' },
          { color: 'warning', text: 'Opportunity analysis' },
          { color: 'destructive', text: 'Risk assessment' }
        ]
      }}
    />
  );
}

/**
 * Comparison Calculator Layout - For calculators that compare scenarios
 */
export function ComparisonCalculatorLayout(props: Omit<CalculatorLayoutProps, 'emptyStateConfig'>) {
  return (
    <CalculatorLayout
      {...props}
      emptyStateConfig={{
        title: "Ready to Compare?",
        description: "Set up your scenarios to compare different strategies and outcomes.",
        features: [
          { color: 'success', text: 'Scenario comparison' },
          { color: 'info', text: 'Monte Carlo analysis' },
          { color: 'warning', text: 'Probability modeling' },
          { color: 'primary', text: 'Long-term projections' }
        ]
      }}
    />
  );
}

export default CalculatorLayout;
