/**
 * Calculator Layout Template
 * Standardized layout for all BufoIndex calculators
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, Share2 } from 'lucide-react';
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

type ShareHandler = () => void | ShareResult | Promise<void | ShareResult>;

interface CalculatorLayoutProps {
  title: string;
  description: string;
  inputSections: React.ReactNode;
  resultSection?: React.ReactNode;
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
}

export function CalculatorLayout({
  title,
  description,
  inputSections,
  resultSection,
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
  testId
}: CalculatorLayoutProps) {
  const hasErrors = Object.keys(errors).length > 0;
  const hasResults = !!resultSection;
  
  return (
    <div className={cn("calculator-container", className)} data-testid={testId}>
      <Container>
        {/* Header Section */}
        <CalculatorHeader title={title} description={description} />
        
        {/* Main Grid Layout */}
        <ResponsiveGrid hasResults={hasResults}>
          {/* Input Section */}
          <InputSection span={hasResults ? 1 : 2}>
            {inputSections}
            
            {/* Calculate Button */}
            <CalculateButton
              onClick={onCalculate}
              isLoading={isCalculating}
              buttonText={calculateButtonText}
              loadingText={calculatingText || `${calculateButtonText}...`}
              errors={errors}
              disabled={!onCalculate || hasErrors}
              onShare={onShare}
            />
          </InputSection>
          
          {/* Results Section */}
          {hasResults && (
            <ResultSection span={1}>
              {resultSection}
            </ResultSection>
          )}
          
          {/* Empty State */}
          {!hasResults && !isCalculating && (
            <EmptyStateSection
              title={emptyStateConfig.title!}
              description={emptyStateConfig.description!}
              icon={Calculator}
              features={emptyStateConfig.features}
            />
          )}
        </ResponsiveGrid>
        
        {/* Footer */}
        {disclaimer && <DisclaimerFooter text={disclaimer} />}
      </Container>
    </div>
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
    <div className={cn("mb-8 text-center", className)}>
      <h1 className="text-3xl font-bold text-foreground mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        {description}
      </p>
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
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleShareClick = async () => {
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
            onClick={handleShareClick}
            className="w-full mt-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <div aria-live="polite">
            {shareFeedback?.status === 'copied' && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Link copied to clipboard
              </p>
            )}
            {shareFeedback?.status === 'error' && (
              <div className="mt-2 text-sm text-muted-foreground">
                <p className="mb-1">Couldn&apos;t copy automatically. Copy this link:</p>
                <input
                  readOnly
                  value={shareFeedback.url}
                  onFocus={(event) => event.currentTarget.select()}
                  aria-label="Shareable link"
                  className="w-full rounded-md border-input bg-background px-2 py-1 text-xs text-foreground"
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Error Display */}
      {hasErrors && (
        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="text-sm text-destructive">
            <p className="font-medium mb-2">Please fix the following errors:</p>
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </BaseCard>
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
    <div className={cn("mt-12 text-center", className)}>
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