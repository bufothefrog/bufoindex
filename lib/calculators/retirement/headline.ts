/**
 * The retirement calculator's headline figures (docs/rebuild-plan.md section
 * 2.11), labelled, toned and formatted once for the results page and the
 * dashboard card. Pure.
 *
 * The plan figures come from the "Your Current Plan" scenario, found by its
 * id (the engine names it 'current-plan-<status>'), not by its display name.
 * Balances are nominal as of that scenario's retirement year; `mode` converts
 * them for display with the plan's own inflation rate (display only).
 */

import type {
  RetirementInputs,
  RetirementResults,
  RetirementScenario,
  ScenarioTitlePart,
} from '@/lib/calculations/retirement';
import { RetirementConstants } from '@/lib/constants/retirement';
import type { StatSpec } from '@/lib/design-system/stat';
import type { Tone } from '@/lib/design-system/tone';
import { formatCurrency, formatPercent } from '@/lib/format';
import { displayDollars, displayRealDollars, type DollarDisplayMode } from '@/lib/utils/displayDollars';

const CURRENT_PLAN_ID_PREFIX = 'current-plan';

const GUIDELINE = RetirementConstants.WITHDRAWAL_RATE;
/** One point above the guideline: the edge of the marginal band. */
const MARGINAL_WITHDRAWAL_RATE = 0.05;

/** A scenario's success probability: 70% and up positive, 50% and up caution, below that negative. */
export function successTone(successProbability: number): Tone {
  if (successProbability >= 0.7) return 'positive';
  if (successProbability >= 0.5) return 'caution';
  return 'negative';
}

/**
 * The plan's implied withdrawal rate against the 4% guideline: at or below it
 * is comfortable, within one point is marginal, beyond that is risky.
 */
export function withdrawalRateTone(rate: number): Tone {
  if (rate <= GUIDELINE) return 'positive';
  if (rate <= MARGINAL_WITHDRAWAL_RATE) return 'caution';
  return 'negative';
}

/** The plan's implied first-year withdrawal rate, graded against the guideline. */
export function withdrawalRateStat(results: RetirementResults): StatSpec {
  const rate = results.initialWithdrawalRate;
  const guideline = formatPercent(GUIDELINE);
  return {
    id: 'withdrawal-rate',
    label: 'Implied Withdrawal Rate',
    value: rate,
    format: 'percent',
    tone: withdrawalRateTone(rate),
    hint: rate <= GUIDELINE ? `at or below the ${guideline} guideline` : `above the ${guideline} guideline`,
  };
}

/** How many scenarios the analysis compared. */
export function scenarioCountStat(results: RetirementResults): StatSpec {
  return {
    id: 'scenarios',
    label: 'Scenarios Analyzed',
    value: results.scenarios.length,
    format: 'count',
    tone: 'info',
    hint: 'retirement options',
  };
}

/** The scenario that runs the plan as entered; the first scenario if none is marked. */
export function currentPlanScenario(results: RetirementResults): RetirementScenario | undefined {
  return results.scenarios.find((s) => s.id.startsWith(CURRENT_PLAN_ID_PREFIX)) ?? results.scenarios[0];
}

/** One title part as text: a figure converted to the display mode, rounded, then formatted. */
function titlePartText(part: ScenarioTitlePart, mode: DollarDisplayMode, inflationRate: number): string {
  if (typeof part === 'string') return part;
  const value =
    part.basis === 'nominal'
      ? displayDollars(part.amount, mode, inflationRate, part.yearsFromNow)
      : displayRealDollars(part.amount, mode, inflationRate, part.yearsFromNow);
  const rounded = part.roundTo === undefined ? value : Math.round(value / part.roundTo) * part.roundTo;
  return formatCurrency(rounded);
}

/**
 * A scenario's card title in the active dollar mode (display only). The
 * engine's name prints its figures as computed; a scenario that carries title
 * parts has each figure converted with the plan's inflation rate over the
 * part's own horizon. A scenario with no title parts shows its name.
 */
export function scenarioTitle(scenario: RetirementScenario, mode: DollarDisplayMode, inflationRate: number): string {
  if (!scenario.title) return scenario.name;
  return scenario.title.map((part) => titlePartText(part, mode, inflationRate)).join('');
}

const MODE_HINT: Record<DollarDisplayMode, string> = {
  today: "Today's dollars",
  nominal: 'Future dollars',
};

/**
 * Success probability, projected and required balance at retirement, and the
 * implied withdrawal rate. The three plan figures are null when the analysis
 * has no scenario.
 */
export function retirementHeadline(
  results: RetirementResults,
  inputs: RetirementInputs,
  mode: DollarDisplayMode = 'today'
): StatSpec[] {
  const plan = currentPlanScenario(results);
  const years = (plan?.retirementAge ?? inputs.retirementAge) - inputs.startingAge;
  const balance = (nominal: number | undefined) =>
    nominal === undefined ? null : displayDollars(nominal, mode, inputs.inflationRate, years);

  return [
    {
      id: 'success',
      label: 'Success Probability',
      value: plan?.successProbability ?? null,
      format: 'percent',
      tone: plan ? successTone(plan.successProbability) : 'neutral',
    },
    {
      id: 'projected',
      label: 'Projected Balance',
      value: balance(plan?.projectedBalance),
      format: 'currency',
      hint: MODE_HINT[mode],
    },
    {
      id: 'required',
      label: 'Required Balance',
      value: balance(plan?.requiredBalance),
      format: 'currency',
      hint: MODE_HINT[mode],
    },
    withdrawalRateStat(results),
  ];
}
