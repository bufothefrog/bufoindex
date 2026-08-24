'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { CalculatorLayout, type ShareResult } from '@/components/ui/layouts/CalculatorLayout';

export function PaycheckAllocator() {
  const {
    result,
    isCalculating,
    errors,
    calculate,
    clearErrors,
    loadFromUrl,
    generateShareUrl
  } = useCalculatorStore();
  
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
          title: 'BufoIndex Paycheck Allocator',
          text: 'A paycheck allocation scenario',
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
    <CalculatorLayout
      title="Paycheck Allocator Calculator"
      description="Allocates your monthly paycheck across fixed costs, tax-advantaged accounts, and flexible spending, in priority order by after-tax return. Each step shows the math behind its placement."
      inputSections={<InputSection />}
      resultSection={result ? <ResultsSection /> : undefined}
      isCalculating={isCalculating}
      onCalculate={handleCalculate}
      onShare={handleShare}
      calculateButtonText="Calculate My Allocation"
      calculatingText="Calculating Optimal Allocation..."
      errors={errors}
      emptyStateConfig={{
        title: 'Ready to Calculate',
        description: 'Review your inputs and run the analysis',
        features: []
      }}
      disclaimer="Educational tool only. Tax amounts are estimates from published 2026 federal and state tables applied to the inputs you enter. Not tax or investment advice."
    />
  );
}