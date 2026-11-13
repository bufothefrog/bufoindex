/**
 * The intake as it was before slice w1, for the behaviour-preserving pins.
 * The questions and screen titles below were captured from the old
 * INTAKE_QUESTIONS and INTAKE_SCREENS (every intent in 'all' mode, default
 * profile) before they were deleted. This file holds the shared core; each
 * calculator's own questions live in its test/lib/calculators/<id>/form.test.ts,
 * so a calculator slice that grows its form edits only its own files.
 *
 * Slice b1 (fewer explainers) trimmed the help and descriptions; the
 * tables below carry the trimmed copy, so the pins now check that every
 * old question is still asked, with today's wording.
 *
 * askedScreens(flow) reads what the intake asks now, in the same shape as
 * oldScreens(...), so a test compares the two question by question;
 * intakePaths(flow) lists every path a flow's intake can ask.
 */

import { getIntakeScreens, intakeForm, type IntakeFlow } from '@/lib/constants/intake';
import { resolveOptions, visibleScreenFields } from '@/lib/fields/runtime';
import type { FieldOption, Get } from '@/lib/fields/types';
import { getDefaultFinancialProfile, getProfileValue } from '@/lib/profile/defaults';

/** Every profile path a flow's intake can ask, in order, deduplicated. */
export function intakePaths(flow: IntakeFlow): string[] {
  return Array.from(new Set(intakeForm(flow).screens.flatMap((screen) => screen.fields)));
}

export type OldKind = 'money' | 'number' | 'percent' | 'state' | 'frequency' | 'filing' | 'choice';

export interface OldQuestion {
  path: string;
  label: string;
  kind: OldKind;
  help?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface OldScreenCopy {
  title: string;
  description?: string;
}

/** [screen id, old section, question keys]. A key is the path, or '<intent>:<path>' for an intent's own wording. */
export type OldScreen = readonly [id: string, section: string, questions: readonly string[]];

export const OLD_CORE_SCREENS: Readonly<Record<string, OldScreenCopy>> = {
  about: { title: 'A little about you' },
  pay: { title: 'What does a typical paycheck look like?' },
  'must-pay': { title: 'What do you have to pay each month?' },
};

export const OLD_CORE_QUESTIONS: Readonly<Record<string, OldQuestion>> = {
  'person.age': { path: 'person.age', label: 'Your age', kind: 'number', min: 16, max: 100, step: 1 },
  'person.state': { path: 'person.state', label: 'State you live in', kind: 'state' },
  // The old intake offered single and married filing jointly; all four since slice c3 (O10).
  'person.filingStatus': { path: 'person.filingStatus', label: 'Tax filing status', kind: 'filing', options: [{ value: 'single', label: 'Single' }, { value: 'marriedJoint', label: 'Married filing jointly' }, { value: 'marriedSeparate', label: 'Married filing separately' }, { value: 'headOfHousehold', label: 'Head of household' }] },
  'income.grossPerPaycheck': { path: 'income.grossPerPaycheck', label: 'Gross pay per paycheck', kind: 'money', help: 'Before taxes and deductions.', min: 0 },
  'income.frequency': { path: 'income.frequency', label: 'How often you are paid', kind: 'frequency', options: [{ value: 'weekly', label: 'Every week' }, { value: 'bi-weekly', label: 'Every two weeks' }, { value: 'semi-monthly', label: 'Twice a month' }, { value: 'monthly', label: 'Once a month' }] },
  'income.netPerPaycheck': { path: 'income.netPerPaycheck', label: 'Take-home pay per paycheck', kind: 'money', help: 'What lands in your bank account after taxes and deductions.', min: 0 },
  'spending.necessaryMonthly': { path: 'spending.necessaryMonthly', label: 'Must-pay costs per month', kind: 'money', help: 'Rent or mortgage, utilities, insurance, groceries, minimum debt payments.', min: 0 },
};

export const OLD_CORE_FLOW: readonly OldScreen[] = [
  ['about', 'core', ['person.age', 'person.state', 'person.filingStatus']],
  ['pay', 'core', ['income.grossPerPaycheck', 'income.frequency', 'income.netPerPaycheck']],
  ['must-pay', 'core', ['spending.necessaryMonthly']],
];

/** A Get over the default profile, with `overrides` by path. */
export const fromDefaults = (overrides: Record<string, unknown> = {}): Get => {
  const defaults = getDefaultFinancialProfile();
  return (path: string) => (path in overrides ? overrides[path] : getProfileValue(defaults, path));
};

/** The FieldKind each old question kind became; a Yes/No choice is a boolean field. */
function newKind(question: OldQuestion): string {
  if (question.kind === 'frequency') return 'select';
  if (question.kind === 'filing') return 'choice';
  if (question.kind === 'choice' && question.options?.every((option) => typeof option.value === 'boolean')) {
    return 'boolean';
  }
  return question.kind;
}

export interface AskedQuestion {
  path: string;
  label: string;
  kind: string;
  help?: unknown;
  options?: readonly FieldOption[];
  min?: number;
  max?: number;
  step?: number;
}

export interface AskedScreen {
  id: string;
  title: string;
  description?: string;
  questions: AskedQuestion[];
}

/** What the flow asks now ('all' mode), screen by screen, with each visible question's wording and bounds. */
export function askedScreens(flow: IntakeFlow, get: Get = fromDefaults()): AskedScreen[] {
  const form = intakeForm(flow);
  return getIntakeScreens(flow, get).map((screen) => ({
    id: screen.id,
    title: screen.title,
    description: screen.description,
    questions: visibleScreenFields(form, screen, get).map((spec) => {
      const options = resolveOptions(spec, get);
      return {
        path: spec.path,
        label: spec.label,
        kind: spec.kind,
        help: spec.help,
        options: options.length > 0 ? options : undefined,
        min: spec.min,
        max: spec.max,
        step: spec.step,
      };
    }),
  }));
}

/** What the old intake asked for `flow` rows, from the given screen and question tables. */
export function oldScreens(
  flow: readonly OldScreen[],
  screens: Readonly<Record<string, OldScreenCopy>>,
  questions: Readonly<Record<string, OldQuestion>>
): AskedScreen[] {
  return flow.map(([id, , keys]) => ({
    id,
    title: screens[id].title,
    description: screens[id].description,
    questions: keys.map((key) => {
      const question = questions[key];
      return {
        path: question.path,
        label: question.label,
        kind: newKind(question),
        help: question.help,
        options: question.options,
        min: question.min,
        max: question.max,
        step: question.step,
      };
    }),
  }));
}
