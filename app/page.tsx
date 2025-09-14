import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            BufoIndex
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            For Those Who Want Financial Control, Not Financial Comfort
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-4">
          <p className="text-lg text-muted-foreground">
            Personal finance optimization platform that exposes financial industry myths 
            with math-driven strategies for aggressive wealth accumulation.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted/50 rounded-lg">
              <strong className="text-sage-600 dark:text-sage-300">Transparency</strong> - Show actual strategies being used
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <strong className="text-sage-600 dark:text-sage-300">Sophistication</strong> - Go beyond basic advice
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <strong className="text-sage-600 dark:text-sage-300">Optimization</strong> - Mathematical over emotional
            </div>
          </div>
        </div>
      </section>

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

      {/* Value Proposition */}
      <section className="bg-sage-50 dark:bg-sage-800 rounded-2xl p-8 md:p-12">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold">
            Why Conventional Financial Advice Fails
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="space-y-3">
              <h3 className="font-semibold text-red-600 dark:text-red-300">Conventional Approach</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• &quot;Save 6+ months emergency fund&quot;</li>
                <li>• &quot;Pay off all debt before investing&quot;</li>
                <li>• &quot;Max your 401k first&quot;</li>
                <li>• &quot;60/40 stocks/bonds for safety&quot;</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sage-600 dark:text-sage-300">Optimized Approach</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Emergency funds beyond 3 months cost $50k+</li>
                <li>• Low-rate debt vs investing: $100k difference</li>
                <li>• HSA beats 401k for retirement savings</li>
                <li>• Conservative allocation costs $300k lifetime</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 bg-card rounded-lg">
            <p className="text-sm font-medium text-sage-700 dark:text-sage-200">
              Our tools show you the math behind optimization strategies, 
              helping you make informed decisions for maximum lifetime wealth.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}