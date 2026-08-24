import type { Metadata } from 'next'
import { RetirementCalculator } from './components/RetirementCalculator'

export const metadata: Metadata = {
  title: 'Retirement Calculator',
  description:
    'Monte Carlo retirement modeling with Social Security, healthcare costs, and side-by-side scenario comparison.',
}

export default function RetirementCalculatorPage() {
  return <RetirementCalculator />
}
