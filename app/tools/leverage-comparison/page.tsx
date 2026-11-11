import { calculatorMetadata } from '@/lib/calculators/registry';
import { LeverageComparison } from './components/LeverageComparison';

export const metadata = calculatorMetadata('leverage');

export default function LeverageComparisonPage() {
  return <LeverageComparison />;
}
