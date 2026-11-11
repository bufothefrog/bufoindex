import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalculatorHeader } from '@/components/ui/layouts/CalculatorLayout';
import { LeverageComparison } from './components/LeverageComparison';

export const metadata: Metadata = {
  title: 'Leverage Comparison',
  description:
    'Simulate monthly contributions into a plain index fund and a daily-reset leveraged fund on the same dates, with ending-balance percentiles, drawdowns, and the lump-sum framing shown side by side.',
};

function LeverageComparisonFallback() {
  return (
    <div className="mx-auto max-w-7xl py-6">
      <CalculatorHeader
        title="Leverage Comparison"
        description="Loading the simulation..."
      />
    </div>
  );
}

export default function LeverageComparisonPage() {
  // useSearchParams (initial inputs from ?c=&y=&b=&l=) needs a Suspense
  // boundary so the rest of the page can be statically rendered.
  return (
    <Suspense fallback={<LeverageComparisonFallback />}>
      <LeverageComparison />
    </Suspense>
  );
}
