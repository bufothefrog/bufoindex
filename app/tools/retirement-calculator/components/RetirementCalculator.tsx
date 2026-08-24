'use client';

import React from 'react';
import Link from 'next/link';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { CalculatorLayout, type ShareResult } from '@/components/ui/layouts/CalculatorLayout';

// Main retirement calculator component
export function RetirementCalculator() {
  const { 
    results, 
    isCalculating, 
    errors, 
    calculate,
    clearErrors,
    loadFromUrl,
    generateShareUrl
  } = useRetirementStore();
  
  React.useEffect(() => {
    // Clear errors and load from URL if present when component mounts
    clearErrors();
    loadFromUrl();
  }, [clearErrors, loadFromUrl]);
  
  const handleCalculate = async () => {
    await calculate();
  };

  const handleShare = async (): Promise<ShareResult | void> => {
    const url = generateShareUrl();

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'BufoIndex Retirement Calculator',
          text: 'Check out my retirement planning scenario',
          url: url
        });
        return { status: 'shared' };
      } catch (error) {
        // User dismissed the share sheet — nothing to report
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        // Otherwise fall through to the clipboard fallback
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      return { status: 'copied' };
    } catch {
      // Clipboard unavailable (insecure context, permissions) — offer manual copy
      return { status: 'error', url };
    }
  };
  
  return (
    <>
      <CalculatorLayout
        title="Retirement Planning Calculator"
        description="Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison."
        inputSections={<InputSection />}
        resultSection={results ? <ResultsSection /> : undefined}
        isCalculating={isCalculating}
        onCalculate={handleCalculate}
        onShare={handleShare}
        calculateButtonText="Calculate Retirement Plan"
        calculatingText="Running Monte Carlo Analysis..."
        errors={errors}
        emptyStateConfig={{
          title: 'Ready to Calculate',
          description: 'Review your inputs and run the analysis',
          features: []
        }}
        disclaimer="Educational tool only. Results are simulated outcomes under the assumptions you enter, not predictions. Not tax or investment advice."
      />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        How these numbers are computed —{' '}
        <Link
          href="/tools/retirement-calculator/methodology"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Methodology
        </Link>
      </p>
    </>
  );
}