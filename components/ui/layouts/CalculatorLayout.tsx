/**
 * Calculator Layout Template
 * Standardized layout for all BufoIndex calculators
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import { ResponsiveGrid, InputSection, ResultSection, EmptyStateSection, Container } from './ResponsiveGrid';
import { BaseCard } from '../cards/BaseCard';

interface CalculatorLayoutProps {
  title: string;
  description: string;
  inputSections: React.ReactNode;
  resultSection?: React.ReactNode;
  isCalculating?: boolean;
  onCalculate?: () => void;
  calculateButtonText?: string;
  calculatingText?: string;
  errors?: Record<string, string>;
  emptyStateConfig?: {
    title?: string;
    description?: string;
    features?: Array<{
      color: string;
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
      <h2 className="text-3xl font-bold text-foreground mb-2">
        {title}
      </h2>
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
  className?: string;
}

export function CalculateButton({
  onClick,
  isLoading = false,
  buttonText = "Calculate",
  loadingText = "Calculating...",
  errors = {},
  disabled = false,
  className
}: CalculateButtonProps) {
  const hasErrors = Object.keys(errors).length > 0;
  
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
          { color: '#10B981', text: 'Instant calculations' },
          { color: '#3B82F6', text: 'Educational insights' },
          { color: '#F59E0B', text: 'Personalized results' }
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
          { color: '#10B981', text: 'Mathematical optimization' },
          { color: '#3B82F6', text: 'Tax efficiency analysis' },
          { color: '#F59E0B', text: 'Contrarian insights' },
          { color: '#EF4444', text: 'Risk assessment' }
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
          { color: '#10B981', text: 'Scenario comparison' },
          { color: '#3B82F6', text: 'Monte Carlo analysis' },
          { color: '#F59E0B', text: 'Probability modeling' },
          { color: '#8B5CF6', text: 'Long-term projections' }
        ]
      }}
    />
  );
}