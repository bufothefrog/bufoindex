import { calculatorMetadata } from '@/lib/calculators/registry';
import { PortfolioRebalancingCalculator } from './components/PortfolioRebalancingCalculator';

export const metadata = calculatorMetadata('portfolio');

export default function PortfolioRebalancingCalculatorPage() {
  return <PortfolioRebalancingCalculator />;
}
