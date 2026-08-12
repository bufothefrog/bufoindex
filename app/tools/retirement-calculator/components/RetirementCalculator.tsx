'use client';

import React from 'react';
import Link from 'next/link';
import { useRetirementStore } from '@/lib/store/retirementStore';
import { InputSection } from './InputSection';
import { ResultsSection } from './ResultsSection';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';

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

  const handleShare = async () => {
    const url = generateShareUrl();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BufoIndex Retirement Calculator',
          text: 'Check out my retirement planning scenario',
          url: url
        });
      } catch {
        // Fall back to clipboard
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      // Fall back to clipboard
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };
  
  return (
    <>
      <CalculatorLayout
        title="Retirement Planning Calculator"
        description="Comprehensive retirement planning with Monte Carlo simulations and advanced financial modeling. Compare multiple retirement scenarios and get personalized insights."
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