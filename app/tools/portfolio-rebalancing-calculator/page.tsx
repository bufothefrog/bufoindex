import type { Metadata } from 'next';
import { PortfolioRebalancingCalculator } from './components/PortfolioRebalancingCalculator';

export const metadata: Metadata = {
  title: 'Portfolio Rebalancer',
  description:
    'Compute the trades needed to bring a multi-account portfolio back to its target allocation, with custom asset classes and account-placement guidance.',
};

export default function PortfolioRebalancingCalculatorPage() {
  return <PortfolioRebalancingCalculator />;
}
