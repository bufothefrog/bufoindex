import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RetirementCalculator } from './components/RetirementCalculator'

export default function RetirementCalculatorPage() {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back
      </Link>
      <RetirementCalculator />
    </div>
  )
}
