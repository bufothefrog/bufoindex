import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Calculator, TrendingUp, ArrowRight, Scale, Layers, type LucideIcon } from 'lucide-react'
import { CALCULATOR_IDS, CALCULATORS } from '@/lib/calculators/registry'
import type { CalculatorId } from '@/lib/calculators/types'

export const metadata: Metadata = {
  title: 'Tools',
  description:
    'Every BufoIndex calculator: paycheck allocation, Monte Carlo retirement modeling, portfolio rebalancing, and a leveraged versus plain index comparison. Runs client-side; nothing is uploaded.',
}

const CARD_ICONS: Record<CalculatorId, LucideIcon> = {
  paycheck: Calculator,
  retirement: TrendingUp,
  portfolio: Scale,
  leverage: Layers,
}

export default function ToolsPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <section className="space-y-2 pt-6 md:pt-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Tools</h1>
        <p className="text-muted-foreground">
          Every calculator runs client-side and shows the formulas behind its
          numbers.{' '}
          <Link
            href="/"
            className="text-sage-600 dark:text-sage-300 underline underline-offset-4 hover:text-sage-700 dark:hover:text-sage-200"
          >
            Prefer a few guided questions first?
          </Link>
        </p>
      </section>

      {/* Calculator Cards */}
      <div className="grid gap-6">
        {CALCULATOR_IDS.map((id) => {
          const { path, card } = CALCULATORS[id]
          const Icon = CARD_ICONS[id]
          return (
            <Link
              key={id}
              href={path as Route}
              className="group block p-6 bg-card border rounded-xl hover:shadow-lg transition-all duration-200 hover:border-sage-400 dark:hover:border-sage-500"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2.5 bg-sage-100 dark:bg-sage-700 rounded-lg">
                  <Icon className="w-5 h-5 text-sage-600 dark:text-sage-300" />
                </div>
                <h2 className="text-lg font-semibold group-hover:text-sage-600 dark:group-hover:text-sage-300 transition-colors">
                  {card.title}
                </h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">{card.summary}</p>

              <div className="flex items-center text-sm text-sage-600 dark:text-sage-300 font-medium group-hover:text-sage-700 dark:group-hover:text-sage-200 transition-colors">
                {card.action} <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
