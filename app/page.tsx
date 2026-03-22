import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Calculator Grid */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Financial Optimization Tools</h2>
          <p className="text-muted-foreground text-lg">
            Interactive calculators that expose financial industry myths with actionable insights
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Paycheck Allocator Card */}
          <Link
            href="/tools/paycheck-allocator"
            className="group block p-8 bg-card border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-sage-300 dark:hover:border-sage-600"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg">
                  <Calculator className="w-6 h-6 text-sage-600 dark:text-sage-300" />
                </div>
                <h3 className="text-xl font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
                  Paycheck Allocator
                </h3>
              </div>

              <p className="text-muted-foreground">
                Smart monthly allocation for your next paycheck. Get a clear priority list
                that maximizes tax efficiency and long-term wealth building.
              </p>

              <div className="space-y-2">
                <div className="text-sm font-medium text-sage-600 dark:text-sage-300">Key Features:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Tax bracket optimization</li>
                  <li>• Account prioritization algorithm</li>
                  <li>• Contrarian recommendations</li>
                  <li>• Mobile-optimized interface</li>
                </ul>
              </div>

              <div className="flex items-center text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
                Start Optimizing <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Retirement Calculator Card */}
          <Link
            href="/tools/retirement-calculator"
            className="group block p-8 bg-card border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-sage-300 dark:hover:border-sage-600"
          >
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-sage-100 dark:bg-sage-700 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-sage-600 dark:text-sage-300" />
                </div>
                <h3 className="text-xl font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
                  Retirement Calculator
                </h3>
              </div>

              <p className="text-muted-foreground">
                Comprehensive retirement planning with Monte Carlo simulations.
                Compare multiple scenarios and optimize for early financial independence.
              </p>

              <div className="space-y-2">
                <div className="text-sm font-medium text-sage-600 dark:text-sage-300">Key Features:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Monte Carlo simulations</li>
                  <li>• Multiple retirement scenarios</li>
                  <li>• Advanced tax calculations</li>
                  <li>• Interactive visualizations</li>
                </ul>
              </div>

              <div className="flex items-center text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
                Plan Retirement <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
