import Link from 'next/link'
import { Calculator, TrendingUp } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/tools/paycheck-allocator"
          className="group flex flex-col items-center p-8 bg-card border rounded-xl hover:shadow-md hover:border-sage-300 dark:hover:border-sage-600 transition-all"
        >
          <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg mb-4">
            <Calculator className="w-6 h-6 text-sage-600 dark:text-sage-300" />
          </div>
          <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
            Paycheck Allocator
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Optimize your monthly paycheck allocation
          </p>
        </Link>

        <Link
          href="/tools/retirement-calculator"
          className="group flex flex-col items-center p-8 bg-card border rounded-xl hover:shadow-md hover:border-sage-300 dark:hover:border-sage-600 transition-all"
        >
          <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg mb-4">
            <TrendingUp className="w-6 h-6 text-sage-600 dark:text-sage-300" />
          </div>
          <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
            Retirement Calculator
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Plan retirement with Monte Carlo simulations
          </p>
        </Link>
      </div>
    </div>
  )
}
