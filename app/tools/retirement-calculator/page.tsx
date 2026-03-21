import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RetirementCalculator } from './components/RetirementCalculator'

export default function RetirementCalculatorPage() {
  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center space-x-4">
        <Link 
          href="/" 
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <div className="w-1 h-4 bg-border"></div>
        <h1 className="text-sm font-medium">Retirement Calculator</h1>
      </div>

      {/* Calculator */}
      <RetirementCalculator />
    </div>
  )
}