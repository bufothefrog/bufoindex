'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2, Share2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalculatorLayoutProps {
  title: string;
  description?: string;
  inputSection: React.ReactNode;
  resultsSection?: React.ReactNode;
  isCalculating?: boolean;
  hasResults?: boolean;
  onCalculate?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  calculateButtonText?: string;
  calculatingText?: string;
  errors?: Record<string, string>;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl';
  layout?: 'responsive' | 'side-by-side' | 'stacked';
}

export function CalculatorLayout({
  title,
  description,
  inputSection,
  resultsSection,
  isCalculating = false,
  hasResults = false,
  onCalculate,
  onShare,
  onExport,
  calculateButtonText = 'Calculate',
  calculatingText = 'Calculating...',
  errors = {},
  className,
  maxWidth = '7xl',
  layout = 'responsive'
}: CalculatorLayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl'
  };

  const getLayoutClasses = () => {
    switch (layout) {
      case 'side-by-side':
        return 'grid-cols-1 lg:grid-cols-2';
      case 'stacked':
        return 'grid-cols-1';
      case 'responsive':
      default:
        return hasResults ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3';
    }
  };

  return (
    <div className={cn('calculator-container', className)}>
      <div className={cn('mx-auto p-6', maxWidthClasses[maxWidth])}>
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {title}
          </h2>
          {description && (
            <p className="text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>
        
        {/* Main Calculator Grid */}
        <div className={cn(
          'grid gap-6 transition-all duration-500',
          getLayoutClasses()
        )}>
          {/* Input Section */}
          <div className={cn(
            'transition-all duration-500',
            layout === 'responsive' && hasResults ? 'lg:col-span-1' : 
            layout === 'responsive' && !hasResults ? 'lg:col-span-2' : ''
          )}>
            {inputSection}
          </div>
          
          {/* Calculate Button Card (only show when no results in responsive mode) */}
          {layout === 'responsive' && !hasResults && onCalculate && (
            <div className="lg:col-span-1">
              <Card className="h-fit">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="mb-4">
                      <Calculator className="w-12 h-12 mx-auto text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      Ready to Calculate
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Review your inputs and run the analysis
                    </p>
                    
                    <Button 
                      onClick={onCalculate}
                      disabled={isCalculating}
                      className="w-full mb-4"
                      size="lg"
                    >
                      {isCalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {calculatingText}
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          {calculateButtonText}
                        </>
                      )}
                    </Button>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {onShare && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={onShare}
                          className="flex-1"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                      )}
                      {onExport && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={onExport}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      )}
                    </div>

                    {/* Errors */}
                    {Object.keys(errors).length > 0 && (
                      <div className="mt-4 text-sm text-red-600">
                        {Object.values(errors).join(', ')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Calculate Button for other layouts */}
          {layout !== 'responsive' && onCalculate && (
            <div className="flex justify-center">
              <Button 
                onClick={onCalculate}
                disabled={isCalculating}
                size="lg"
                className="min-w-[200px]"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {calculatingText}
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    {calculateButtonText}
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Results Section */}
          {resultsSection && (hasResults || layout !== 'responsive') && (
            <div className={cn(
              layout === 'responsive' ? 'lg:col-span-1' : 'col-span-full'
            )}>
              {resultsSection}
            </div>
          )}
        </div>

        {/* Footer Actions (for side-by-side and stacked layouts) */}
        {layout !== 'responsive' && (onShare || onExport) && (
          <div className="mt-6 flex justify-center gap-4">
            {onShare && (
              <Button variant="outline" onClick={onShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Results
              </Button>
            )}
            {onExport && (
              <Button variant="outline" onClick={onExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            )}
          </div>
        )}

        {/* Global Errors */}
        {Object.keys(errors).length > 0 && layout !== 'responsive' && (
          <div className="mt-4 text-center text-sm text-red-600">
            {Object.values(errors).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Preset layout variants
export function ResponsiveCalculatorLayout(
  props: Omit<CalculatorLayoutProps, 'layout'>
) {
  return <CalculatorLayout {...props} layout="responsive" />;
}

export function SideBySideCalculatorLayout(
  props: Omit<CalculatorLayoutProps, 'layout'>
) {
  return <CalculatorLayout {...props} layout="side-by-side" />;
}

export function StackedCalculatorLayout(
  props: Omit<CalculatorLayoutProps, 'layout'>
) {
  return <CalculatorLayout {...props} layout="stacked" />;
}