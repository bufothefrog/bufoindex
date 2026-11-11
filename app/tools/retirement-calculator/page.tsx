import { calculatorMetadata } from '@/lib/calculators/registry'
import { RetirementCalculator } from './components/RetirementCalculator'

export const metadata = calculatorMetadata('retirement')

export default function RetirementCalculatorPage() {
  return <RetirementCalculator />
}
