import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight, Scale } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Hero Strip */}
      <section className="text-center space-y-3 pt-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Bufo Index
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Math-driven calculators that replace conventional financial wisdom with
          strategies optimized for maximum lifetime wealth.
        </p>
      </section>

      {/* Calculator Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/tools/paycheck-allocator"
          className="group block p-6 bg-card border rounded-xl hover:shadow-lg transition-all duration-200 hover:border-sage-400 dark:hover:border-sage-500"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-sage-100 dark:bg-sage-700 rounded-lg">
              <Calculator className="w-5 h-5 text-sage-600 dark:text-sage-300" />
            </div>
            <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
              Paycheck Allocator
            </h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Smart monthly allocation that maximizes tax efficiency
            and long-term wealth building with a clear priority list.
          </p>

          <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
            Start Optimizing <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/tools/retirement-calculator"
          className="group block p-6 bg-card border rounded-xl hover:shadow-lg transition-all duration-200 hover:border-sage-400 dark:hover:border-sage-500"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-sage-100 dark:bg-sage-700 rounded-lg">
              <TrendingUp className="w-5 h-5 text-sage-600 dark:text-sage-300" />
            </div>
            <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
              Retirement Calculator
            </h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Monte Carlo simulations, multiple scenarios, and tax-aware
            projections to optimize for early financial independence.
          </p>

          <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
            Plan Retirement <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/tools/portfolio-rebalancing-calculator"
          className="group block p-6 bg-card border rounded-xl hover:shadow-lg transition-all duration-200 hover:border-sage-400 dark:hover:border-sage-500"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-sage-100 dark:bg-sage-700 rounded-lg">
              <Scale className="w-5 h-5 text-sage-600 dark:text-sage-300" />
            </div>
            <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
              Portfolio Rebalancing
            </h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Stay on target without selling. Tell us your holdings and new deposit;
            we&apos;ll compute exactly how many shares to buy of each asset.
          </p>

          <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
            Rebalance with Cash Flow <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  )
}
