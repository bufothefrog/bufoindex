import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6">
      <Link
        href="/tools/paycheck-allocator"
        className="group flex items-center justify-between p-6 bg-card border rounded-xl hover:shadow-md hover:border-sage-300 dark:hover:border-sage-600 transition-all"
      >
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg">
            <Calculator className="w-6 h-6 text-sage-600 dark:text-sage-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
              Paycheck Allocator
            </h2>
            <p className="text-sm text-muted-foreground">
              Optimize your monthly paycheck allocation
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-sage-600 dark:group-hover:text-sage-300 group-hover:translate-x-1 transition-all" />
      </Link>

      <Link
        href="/tools/retirement-calculator"
        className="group flex items-center justify-between p-6 bg-card border rounded-xl hover:shadow-md hover:border-sage-300 dark:hover:border-sage-600 transition-all"
      >
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg">
            <TrendingUp className="w-6 h-6 text-sage-600 dark:text-sage-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
              Retirement Calculator
            </h2>
            <p className="text-sm text-muted-foreground">
              Plan retirement with Monte Carlo simulations
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-sage-600 dark:group-hover:text-sage-300 group-hover:translate-x-1 transition-all" />
      </Link>
    </div>
  )
}
