/**
 * The explainer budget of the forms (slice b1, fewer explainers): a form
 * says what to enter and nothing more. Every screen of the four calculator
 * forms and of the profile form is walked, for the default profile and for
 * a profile that turns every conditional field and note on, so the budget
 * cannot silently grow back:
 *
 * - a screen shows at most 30 explanatory words: its description, its
 *   visible notes, and per visible field (per row for a list) its help
 *   (unless the field sits on Auto, where the help is hidden), its hint and
 *   its option descriptions. Labels and Auto labels are not counted. Value
 *   readouts in help ("That's $X in future dollars") are counted, which is
 *   stricter than the rule;
 * - a field carries help or a hint, never both;
 * - a help or hint line is at most 12 words, an option description at most
 *   8, a screen description at most one sentence of 12 words, a note at
 *   most 20 words.
 */

import { describe, expect, it } from 'vitest';
import { FORMS, PROFILE_FORM } from '@/lib/calculators/forms';
import { CALCULATOR_IDS } from '@/lib/calculators/registry';
import {
  listRows,
  resolveOptions,
  resolveText,
  rowGet,
  visibleScreenFields,
  visibleScreenNotes,
} from '@/lib/fields/runtime';
import type { FieldSpec, FormSpec, Get, ScreenSpec } from '@/lib/fields/types';
import { fromDefaults } from '@/test/utils/intakeFixture';

const SCREEN_BUDGET = 30;
const LINE_BUDGET = 12;
const OPTION_BUDGET = 8;
const NOTE_BUDGET = 20;

/** Every conditional field and note on: bonuses, a split 401(k), an HSA, both IRAs, overrides, 1x and so on. */
const EVERYTHING_ON: Record<string, unknown> = {
  'person.filingStatus': 'headOfHousehold',
  'income.hasBonus': true,
  'workplace.has401k': true,
  'workplace.contributionType': 'split',
  'hsa.eligible': true,
  'hsa.investing': true,
  'ira.traditional': true,
  'ira.roth': true,
  'investing.targetMix': 'custom',
  'assumptions.retirement.riskProfile': 'custom',
  'assumptions.retirement.effectiveTaxRate': 0.12,
  'retirementIncome.annualHealthcareCost': 8000,
  'assumptions.portfolio.allowTaxableSelling': true,
  'strategy.leverageRatio': 1,
  'leverage.monthlyContribution': 500,
  'leverage.years': 20,
  'leverage.startingBalance': 1000,
};

const PROFILES: readonly [string, Get][] = [
  ['the default profile', fromDefaults()],
  ['every conditional field on', fromDefaults(EVERYTHING_ON)],
];

const FORM_LIST: readonly FormSpec[] = [...CALCULATOR_IDS.map((id) => FORMS[id]), PROFILE_FORM];

function words(text: string | undefined): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((token) => /[A-Za-z0-9]/.test(token)).length;
}

function sentences(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim() !== '').length;
}

/** The option descriptions a choice (or a wizard Yes/No) renders. */
function optionTexts(spec: FieldSpec, get: Get): string[] {
  if (spec.kind !== 'choice' && spec.kind !== 'boolean') return [];
  return resolveOptions(spec, get).flatMap((option) => (option.description ? [option.description] : []));
}

/** The explanatory lines one visible field shows, its list rows included. */
function fieldTexts(spec: FieldSpec, get: Get): string[] {
  const onAuto = spec.nullable !== undefined && get(spec.path) === null;
  const own = [onAuto ? undefined : resolveText(spec.help, get), resolveText(spec.hint, get), ...optionTexts(spec, get)];
  const texts = own.filter((text): text is string => Boolean(text));
  if (spec.kind === 'list' && spec.row) {
    listRows(get(spec.path)).forEach((_, index) => {
      const row = rowGet(get, spec.path, index);
      for (const rowSpec of spec.row ?? []) {
        if (!rowSpec.visibleWhen || rowSpec.visibleWhen(row)) texts.push(...fieldTexts(rowSpec, row));
      }
    });
  }
  return texts;
}

function screenTexts(form: FormSpec, screen: ScreenSpec, get: Get): string[] {
  return [
    ...(screen.description ? [screen.description] : []),
    ...visibleScreenNotes(screen, get).map((note) => note.text),
    ...visibleScreenFields(form, screen, get).flatMap((spec) => fieldTexts(spec, get)),
  ];
}

/** Every spec of a form, list row specs included. */
function allSpecs(form: FormSpec): FieldSpec[] {
  return form.fields.flatMap((spec) => [spec, ...(spec.row ?? [])]);
}

describe.each(FORM_LIST.map((form) => [form.id, form] as const))('the %s form keeps to the explainer budget', (_, form) => {
  it.each(PROFILES)(`shows at most ${SCREEN_BUDGET} explanatory words per screen for %s`, (_label, get) => {
    for (const screen of form.screens) {
      const texts = screenTexts(form, screen, get);
      const total = texts.reduce((sum, text) => sum + words(text), 0);
      expect(total, `${form.id}/${screen.id}: ${texts.join(' | ')}`).toBeLessThanOrEqual(SCREEN_BUDGET);
    }
  });

  it('gives each field help or a hint, never both', () => {
    for (const spec of allSpecs(form)) {
      expect(spec.help !== undefined && spec.hint !== undefined, `${form.id}/${spec.path}`).toBe(false);
    }
  });

  it.each(PROFILES)(`keeps help and hints to ${LINE_BUDGET} words and option descriptions to ${OPTION_BUDGET} for %s`, (_label, get) => {
    for (const screen of form.screens) {
      for (const spec of visibleScreenFields(form, screen, get)) {
        for (const text of [resolveText(spec.help, get), resolveText(spec.hint, get)]) {
          expect(words(text), `${form.id}/${spec.path}: ${text}`).toBeLessThanOrEqual(LINE_BUDGET);
        }
        for (const text of optionTexts(spec, get)) {
          expect(words(text), `${form.id}/${spec.path}: ${text}`).toBeLessThanOrEqual(OPTION_BUDGET);
        }
      }
    }
    for (const spec of allSpecs(form).filter((each) => each.row === undefined && typeof each.help === 'string')) {
      expect(words(spec.help as string), `${form.id}/${spec.path}`).toBeLessThanOrEqual(LINE_BUDGET);
    }
  });

  it.each(PROFILES)(`keeps descriptions to one sentence of ${LINE_BUDGET} words and notes to ${NOTE_BUDGET} for %s`, (_label, get) => {
    for (const screen of form.screens) {
      if (screen.description) {
        expect(words(screen.description), `${form.id}/${screen.id}`).toBeLessThanOrEqual(LINE_BUDGET);
        expect(sentences(screen.description), `${form.id}/${screen.id}`).toBe(1);
      }
      for (const note of visibleScreenNotes(screen, get)) {
        expect(words(note.text), `${form.id}/${screen.id}: ${note.text}`).toBeLessThanOrEqual(NOTE_BUDGET);
      }
    }
  });
});

describe('the explainer budget counter', () => {
  it('counts words, not punctuation or symbols', () => {
    expect(words('Up to $4,400 a year ($367 a month).')).toBe(8);
    expect(words('Charged on the extra (L-1) exposure - in full.')).toBe(8);
    expect(words(undefined)).toBe(0);
  });

  it('counts the help of a field in custom mode and leaves it out on Auto', () => {
    const spec = FORMS.retirement.fields.find((field) => field.path === 'retirementIncome.annualHealthcareCost')!;
    expect(fieldTexts(spec, fromDefaults())).toEqual([]);
    expect(fieldTexts(spec, fromDefaults({ 'retirementIncome.annualHealthcareCost': 8000 }))).toEqual([
      'Premiums plus out-of-pocket costs for a year.',
    ]);
  });

  it('counts a row field once per row', () => {
    // No list row of the forms carries a text since the account row's unrendered balance hint went, so
    // the counter runs on the account list spec with a hint put back on its balance.
    const accounts = FORMS.portfolio.fields.find((field) => field.path === 'portfolio.accounts')!;
    expect(fieldTexts(accounts, fromDefaults())).toEqual([]);
    const withHint: FieldSpec = {
      ...accounts,
      row: accounts.row!.map((row) => (row.path === 'balance' ? { ...row, hint: 'A row hint.' } : row)),
    };
    const rows = listRows(fromDefaults()('portfolio.accounts')).length;
    expect(rows).toBeGreaterThan(1);
    expect(fieldTexts(withHint, fromDefaults())).toEqual(Array(rows).fill('A row hint.'));
  });
});
