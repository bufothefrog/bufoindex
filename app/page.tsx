import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, LockKeyhole, MonitorSmartphone, Sigma } from 'lucide-react'
import { IntentPicker } from '@/components/guided/IntentPicker'
import { ContinueProfileCard } from '@/components/guided/ContinueProfileCard'

export const metadata: Metadata = {
  title: { absolute: 'BufoIndex' },
  description:
    'Personal-finance calculators that start from a few quick answers and show the math behind every number. Paycheck allocation, retirement modeling, rebalancing, and a leveraged versus plain index comparison.',
}

const HOW_IT_WORKS = [
  {
    icon: MonitorSmartphone,
    title: 'Runs in your browser',
    body: 'Every calculation happens on your device.',
  },
  {
    icon: LockKeyhole,
    title: 'Nothing uploaded',
    body: 'No account and no server. Saved answers stay in this browser.',
  },
  {
    icon: ClipboardList,
    title: 'Easy questions first',
    body: 'The intake asks what you know offhand. Details that need a document wait on the calculator.',
  },
  {
    icon: Sigma,
    title: 'Shows the math',
    body: 'Formulas and assumptions sit next to the results.',
  },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-4">
      {/* Above the fold: name, positioning, and the one question. */}
      <div className="space-y-6 pt-4 md:pt-10">
        <section className="space-y-2 md:text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">BufoIndex</h1>
          <p className="max-w-2xl text-base text-muted-foreground md:mx-auto md:text-lg">
            Personal-finance calculators that start from a few quick answers and
            show the math behind every number.
          </p>
        </section>

        <IntentPicker leading={<ContinueProfileCard />} />

        <p>
          <Link
            href="/tools"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 dark:text-sage-300 dark:hover:text-sage-200"
          >
            Just show me the tools
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>

      <section aria-labelledby="how-it-works" className="space-y-4">
        <h2 id="how-it-works" className="text-lg font-semibold">
          How this site works
        </h2>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sage-600 dark:text-sage-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="point-of-view"
        className="space-y-3 rounded-xl border border-border bg-muted/40 p-5 md:p-6"
      >
        <h2 id="point-of-view" className="text-lg font-semibold">
          Point of view
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          For people with steady income, no high-interest debt, and a long
          horizon, this site starts from a cash-flow investor preset: automate
          contributions every payday, keep a smaller cash buffer backed by a
          plan, and consider leverage only with a long horizon and the drawdown
          math in front of you. It is one preset, not the answer. Your overview
          shows it next to the standard alternative, with about three months of
          expenses in cash and no leverage, run through the same math. The
          calculators themselves use the numbers you enter.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Educational tools only. Results depend on the assumptions you enter and
        are not predictions. Not tax or investment advice.
      </p>
    </div>
  )
}
