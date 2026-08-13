import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight, Scale } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Hero Strip */}
      <section className="text-center space-y-3 pt-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          BufoIndex
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Calculators for paycheck allocation, retirement modeling, and portfolio
          rebalancing. Everything runs client-side, scenarios are shareable by URL,
          and each tool shows the formulas behind its numbers.
        </p>
      </section>

      {/* Calculator Cards */}
      <div className="grid gap-6">
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
            Bracket-aware monthly allocation across fixed costs, tax-advantaged
            accounts, and flexible spending, ordered by after-tax return.
          </p>

          <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
            Allocate a Paycheck <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
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
            Monte Carlo retirement modeling with Social Security, healthcare
            costs, and side-by-side scenario comparison.
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
            Multi-account rebalancing that directs new deposits toward underweight
            asset classes, with taxable selling off by default and account-placement
            advice.
          </p>

          <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
            Rebalance with Cash Flow <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  )
}
