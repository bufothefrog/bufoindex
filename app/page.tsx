import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardList, LockKeyhole, MonitorSmartphone, Sigma } from 'lucide-react'
import { ContinueProfileCard } from '@/components/guided/ContinueProfileCard'
import { buttonVariants } from '@/components/ui/button'
import {
  CORE_START_PATH,
  coreStartLink,
  getIntentOption,
  type IntakeIntent,
} from '@/lib/constants/intake'
import { cn } from '@/lib/utils'

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

/**
 * Calculator previews. Each card links to the shared core intake with
 * `next` set, so every path answers the basics first and then continues to
 * that calculator's remaining questions. The icon and the "what it shows"
 * line come from INTENT_OPTIONS so the landing page and the chooser agree.
 */
const PREVIEWS: ReadonlyArray<{
  intent: Exclude<IntakeIntent, 'profile'>
  name: string
  question: string
}> = [
  {
    intent: 'paycheck',
    name: 'Paycheck Allocator',
    question: 'Where should each paycheck go?',
  },
  {
    intent: 'retirement',
    name: 'Retirement Calculator',
    question: 'Am I on track to retire when I want to?',
  },
  {
    intent: 'portfolio',
    name: 'Portfolio Rebalancer',
    question: 'What should I buy with new cash to reach my target mix?',
  },
  {
    intent: 'leverage',
    name: 'Leverage Comparison',
    question: 'How do a leveraged fund and a plain index fund compare when I invest monthly?',
  },
]

function CalculatorPreviewCard({ intent, name, question }: (typeof PREVIEWS)[number]) {
  const { icon: Icon, description } = getIntentOption(intent)
  return (
    <Link
      href={coreStartLink(intent) as Route}
      className={cn(
        'group flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors md:p-5',
        'hover:border-sage-400 dark:hover:border-sage-500',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage-100 dark:bg-sage-700"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5 text-sage-600 dark:text-sage-300" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-sage-600 dark:text-sage-300">
          {name}
        </span>
      </span>
      <div className="space-y-1">
        <h3 className="font-semibold leading-snug text-foreground">{question}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="mt-auto inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-sage-600 group-hover:text-sage-700 dark:text-sage-300 dark:group-hover:text-sage-200">
        Start with the basics
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-4">
      {/* Above the fold: name, positioning, and one way in. */}
      <div className="space-y-6 pt-4 md:pt-10">
        <section className="space-y-2 md:text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">BufoIndex</h1>
          <p className="max-w-2xl text-base text-muted-foreground md:mx-auto md:text-lg">
            Personal-finance calculators that start from a few quick answers and
            show the math behind every number.
          </p>
        </section>

        <div className="space-y-2 md:text-center">
          <Link
            href={CORE_START_PATH as Route}
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'h-auto min-h-12 w-full gap-2 px-8 py-3 text-base md:w-auto'
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="text-sm text-muted-foreground">
            A few quick questions, then pick what to learn.
          </p>
        </div>

        <ContinueProfileCard className="md:mx-auto md:max-w-xl" />
      </div>

      <section aria-labelledby="what-you-can-learn" className="space-y-4">
        <div className="space-y-1">
          <h2 id="what-you-can-learn" className="text-xl font-semibold tracking-tight md:text-2xl">
            What you can learn
          </h2>
          <p className="text-sm text-muted-foreground">
            Each calculator starts from the same basics, so one set of answers
            carries across all of them.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {PREVIEWS.map((preview) => (
            <li key={preview.intent} className="flex">
              <CalculatorPreviewCard {...preview} />
            </li>
          ))}
        </ul>
        <p>
          <Link
            href="/tools"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-sage-600 underline underline-offset-4 hover:text-sage-700 dark:text-sage-300 dark:hover:text-sage-200"
          >
            Just show me the tools
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </p>
      </section>

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
