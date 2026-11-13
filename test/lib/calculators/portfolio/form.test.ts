/**
 * The portfolio form: every field the rebalancer uses, on five screens
 * (targets, the shared accounts screen, holdings, the calculator-only new
 * cash, settings). The calculator page shows all five; the portfolio intake
 * asks the first three, with no core screen before them (O5). The settings
 * are an assumption screen, a collapsed card on the page.
 */

import { describe, expect, it } from 'vitest';
import { PORTFOLIO_FORM } from '@/lib/calculators/portfolio/form';
import {
  CORE_PATHS,
  getIntakeScreens,
  intentNeedsCore,
  remainingIntakeScreens,
  nextNeedsOwnAnswer,
  validateIntakeScreen,
} from '@/lib/constants/intake';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import { fieldWrites, resolveText, screensFor, summarizeScreen, visibleScreenNotes } from '@/lib/fields/runtime';
import type { FieldSpec } from '@/lib/fields/types';
import { getDefaultFinancialProfile, presetClassTargets } from '@/lib/profile/defaults';
import { askedScreens, fromDefaults, intakePaths, type OldQuestion } from '@/test/utils/intakeFixture';

/** The questions the intake asked for the portfolio intent before c5 (slice w1's fixture), after the core. */
const OLD_QUESTIONS: Record<string, OldQuestion> = {
  'investing.newCashThisMonth': { path: 'investing.newCashThisMonth', label: 'New cash to invest this month', kind: 'money', help: 'Money to invest now.', min: 0 },
  'investing.targetMix': { path: 'investing.targetMix', label: 'Target mix', kind: 'choice', options: [{ value: '100-0', label: '100% stocks' }, { value: '80-20', label: '80% stocks, 20% bonds' }, { value: '60-40', label: '60% stocks, 40% bonds' }] },
};

const SETTINGS_PATHS = [
  'assumptions.portfolio.mode',
  'assumptions.portfolio.allowTaxableSelling',
  'assumptions.portfolio.showPlacementAdvice',
];

const spec = (path: string): FieldSpec => PORTFOLIO_FORM.fields.find((field) => field.path === path)!;
const custom = fromDefaults({ 'investing.targetMix': 'custom' });
const ids = (screens: readonly { id: string }[]) => screens.map((s) => s.id);
const remainingIds = (provided: string[], get = fromDefaults()) =>
  ids(getIntakeScreens('portfolio', get, { mode: 'remaining', provided }));

describe('portfolio form: screens', () => {
  it('has the targets, accounts, holdings, new cash and settings screens, in that order', () => {
    expect(PORTFOLIO_FORM.screens.map((s) => [s.id, s.tier, s.surface ?? 'both', s.fields])).toEqual([
      ['targets', 'details', 'both', ['investing.targetMix', 'portfolio.classTargets']],
      ['accounts', 'details', 'both', ['portfolio.accounts']],
      ['holdings', 'details', 'both', ['portfolio.holdings']],
      ['new-cash', 'details', 'calculator', ['portfolio.newCash']],
      ['settings', 'assumption', 'both', SETTINGS_PATHS],
    ]);
    expect(PORTFOLIO_FORM.screens.map((s) => [s.title, s.question])).toEqual([
      ['Target allocation', 'Which stock and bond mix are you aiming for?'],
      ['What do you have saved and invested?', undefined],
      ['Holdings', 'What does each account hold today?'],
      ['New cash this month', undefined],
      ['Settings', 'How should the rebalance trade?'],
    ]);
    expect(PORTFOLIO_FORM.relations).toBeUndefined();
  });

  it('shows the class-targets editor only for the custom mix, on the calculator and in the intake', () => {
    const fields = (get = fromDefaults()) =>
      screensFor(PORTFOLIO_FORM, get, { mode: 'all', surface: 'calculator' }).map((s) => [
        s.id,
        PORTFOLIO_FORM.fields.filter((f) => s.fields.includes(f.path) && (!f.visibleWhen || f.visibleWhen(get))).map((f) => f.path),
      ]);
    expect(fields()).toEqual([
      ['targets', ['investing.targetMix']],
      ['accounts', ['portfolio.accounts']],
      ['holdings', ['portfolio.holdings']],
      ['new-cash', ['portfolio.newCash']],
      ['settings', SETTINGS_PATHS],
    ]);
    expect(fields(custom)[0]).toEqual(['targets', ['investing.targetMix', 'portfolio.classTargets']]);
    expect(askedScreens('portfolio', custom)[0].questions.map((q) => q.path)).toEqual([
      'investing.targetMix',
      'portfolio.classTargets',
    ]);
  });

  it('asks 3 screens in the intake, with no core screen before them, and not the settings', () => {
    expect(intentNeedsCore('portfolio')).toBe(false);
    expect(intentNeedsCore('retirement')).toBe(true);
    expect(intentNeedsCore('profile')).toBe(true);
    expect(intentNeedsCore('leverage')).toBe(true);
    expect(askedScreens('portfolio')).toEqual([
      {
        id: 'targets',
        title: 'Target allocation',
        description: undefined,
        questions: [
          {
            path: 'investing.targetMix',
            label: 'Target mix',
            kind: 'choice',
            help: undefined,
            options: [
              ...OLD_QUESTIONS['investing.targetMix'].options!,
              { value: 'custom', label: 'Custom', description: 'Set a target for each asset class.' },
            ],
            min: undefined,
            max: undefined,
            step: undefined,
          },
        ],
      },
      {
        id: 'accounts',
        title: 'What do you have saved and invested?',
        description: undefined,
        questions: [
          { path: 'portfolio.accounts', label: 'Accounts', kind: 'list', help: undefined, options: undefined, min: undefined, max: undefined, step: undefined },
        ],
      },
      {
        id: 'holdings',
        title: 'Holdings',
        description: 'Prices are taken as current and executable.',
        questions: [
          { path: 'portfolio.holdings', label: 'Holdings', kind: 'custom', help: undefined, options: undefined, min: undefined, max: undefined, step: undefined },
        ],
      },
    ]);
  });

  it('still asks every question the old intake asked: the mix as before, the new cash on the calculator page', () => {
    // The form lists the new cash too; the intake never shows its calculator-only screen.
    expect(intakePaths('portfolio')).toEqual([
      'investing.targetMix',
      'portfolio.classTargets',
      'portfolio.accounts',
      'portfolio.holdings',
      'portfolio.newCash',
    ]);
    const asked = askedScreens('portfolio', custom).flatMap((screen) => screen.questions.map((q) => q.path));
    expect(asked).toEqual([
      'investing.targetMix',
      'portfolio.classTargets',
      'portfolio.accounts',
      'portfolio.holdings',
    ]);
    expect(asked).toContain(OLD_QUESTIONS['investing.targetMix'].path);
    // The v1 investing.newCashThisMonth is no profile path now: its one home is
    // the per-account new cash, a calculator-only question, Auto from the
    // normal contributions.
    expect(spec('portfolio.newCash')).toMatchObject({ kind: 'custom', label: 'New cash this month', renderer: 'portfolio-new-cash' });
    expect(PORTFOLIO_FORM.screens.find((screen) => screen.fields.includes('portfolio.newCash'))?.surface).toBe('calculator');
  });

  it('takes the typical values on Next on every screen it asks', () => {
    expect(getIntakeScreens('portfolio', fromDefaults()).map((s) => nextNeedsOwnAnswer(s))).toEqual([false, false, false]);
  });

  it('notes the capital gains risk only while taxable selling is on', () => {
    const settings = PORTFOLIO_FORM.screens[4];
    const notes = (get = fromDefaults()) => visibleScreenNotes(settings, get).map((n) => [resolveText(n.text, get), n.tone]);
    expect(notes()).toEqual([]);
    expect(notes(fromDefaults({ 'assumptions.portfolio.allowTaxableSelling': true }))).toEqual([
      ['Selling in taxable may trigger capital gains tax.', 'caution'],
    ]);
  });
});

describe('portfolio form: switching the target mix to Custom', () => {
  const targetsAfter = (mix: unknown, previous: string, extra: Record<string, unknown> = {}) => {
    const get = fromDefaults({ 'investing.targetMix': previous, ...extra });
    const writes = fieldWrites(spec('investing.targetMix'), mix, get);
    return writes.filter((write) => write.path === 'portfolio.classTargets').map((write) => write.value);
  };

  it('starts the editable targets from the preset in use, not from the stored ones', () => {
    expect(targetsAfter('custom', '60-40')).toEqual([
      [
        { accountId: null, assetClass: 'us-stock', target: 0.45 },
        { accountId: null, assetClass: 'intl-stock', target: 0.15 },
        { accountId: null, assetClass: 'bonds', target: 0.4 },
        { accountId: null, assetClass: 'cash', target: 0 },
      ],
    ]);
  });

  it("keeps the visitor's own classes, at the 0% the preset gave them", () => {
    const stored = [
      { accountId: null, assetClass: 'us-stock', target: 0.5 },
      { accountId: null, assetClass: 'cac-1', target: 0.1 },
    ];
    const [targets] = targetsAfter('custom', '100-0', {
      'portfolio.classTargets': stored,
      'portfolio.customAssetClasses': [{ id: 'cac-1', label: 'Gold' }],
    }) as { assetClass: string; target: number }[][];
    expect(targets).toEqual([...presetClassTargets('100-0'), { accountId: null, assetClass: 'cac-1', target: 0 }]);
  });

  it('leaves the targets alone between presets, and for a mix that was already Custom', () => {
    expect(targetsAfter('60-40', '80-20')).toEqual([]);
    expect(targetsAfter('custom', 'custom')).toEqual([]);
  });
});

describe('portfolio form: the fields', () => {
  it('offers every target mix, Custom included', () => {
    expect(spec('investing.targetMix').options).toEqual([
      ...OLD_QUESTIONS['investing.targetMix'].options!,
      { value: 'custom', label: 'Custom', description: 'Set a target for each asset class.' },
    ]);
  });

  it('edits the holdings and class targets with custom renderers that cover their sibling lists', () => {
    expect(spec('portfolio.holdings')).toMatchObject({
      kind: 'custom',
      renderer: 'portfolio-holdings',
      covers: ['portfolio.securities'],
    });
    expect(spec('portfolio.classTargets')).toMatchObject({
      kind: 'custom',
      label: 'Target allocation',
      renderer: 'portfolio-class-targets',
      covers: ['portfolio.customAssetClasses'],
    });
  });

  it('lists accounts by kind, name, balance and the emergency-fund tick, allowing none', () => {
    const accounts = spec('portfolio.accounts');
    expect(accounts.row!.map((row) => [row.path, row.kind, row.label])).toEqual([
      ['kind', 'select', 'Kind'],
      ['name', 'text', 'Account name'],
      ['balance', 'money', 'Balance'],
      ['holdsEmergencyFund', 'boolean', 'Holds my emergency fund'],
    ]);
    expect(accounts.row![1]).toMatchObject({ maxLength: 40, testId: 'account-name-{i}' });
    expect(accounts.row![2]).toMatchObject({ min: 0 });
    expect(accounts).toMatchObject({ minRows: 0, addLabel: 'Add account', renderer: 'accounts' });
    expect(accounts.covers).toEqual(['portfolio.holdings', 'portfolio.securities']);
  });

  it('summarizes each screen in one line', () => {
    const [targets, accounts, holdings, newCash, settings] = PORTFOLIO_FORM.screens;
    expect(summarizeScreen(PORTFOLIO_FORM, targets, fromDefaults())).toBe('80% stocks, 20% bonds');
    expect(summarizeScreen(PORTFOLIO_FORM, targets, custom)).toBe('Custom, US Stock 60%, Intl Stock 20%, Bonds 20%');
    expect(summarizeScreen(PORTFOLIO_FORM, accounts, fromDefaults())).toBe(
      '401(k) or similar $16,225; Brokerage (taxable) $8,775 (3 holdings)'
    );
    expect(summarizeScreen(PORTFOLIO_FORM, holdings, fromDefaults())).toBe('3 holdings');
    expect(summarizeScreen(PORTFOLIO_FORM, newCash, fromDefaults())).toBe('Brokerage (taxable) $500');
    expect(summarizeScreen(PORTFOLIO_FORM, settings, fromDefaults())).toBe(
      'Whole shares, no selling in taxable, placement advice shown'
    );
    expect(
      summarizeScreen(
        PORTFOLIO_FORM,
        settings,
        fromDefaults({
          'assumptions.portfolio.mode': 'fractional',
          'assumptions.portfolio.allowTaxableSelling': true,
          'assumptions.portfolio.showPlacementAdvice': false,
        })
      )
    ).toBe('Fractional, selling in taxable allowed, placement advice hidden');
  });
});

describe('portfolio intake: validation', () => {
  it('checks each account row', () => {
    // Row fields are read by path, so the list goes into a whole profile.
    const get = makeGet(
      applyWrites(getDefaultFinancialProfile(), [
        {
          path: 'portfolio.accounts',
          value: [
            { id: 'acc-401k', kind: '401k', name: 'x'.repeat(41), balance: 0, holdsEmergencyFund: false },
            { id: 'acc-brok', kind: 'crypto', name: 'Brokerage', balance: -1, holdsEmergencyFund: false },
          ],
        },
      ])
    );
    const accounts = getIntakeScreens('portfolio', get)[1];
    expect(validateIntakeScreen('portfolio', accounts, get)).toEqual({
      'portfolio.accounts.0.name': 'Account name must be 40 characters or fewer.',
      'portfolio.accounts.1.kind': 'Kind must be one of the listed options.',
      'portfolio.accounts.1.balance': 'Balance must be at least $0.',
    });
  });

  it('accepts an empty account list (nothing saved yet)', () => {
    const get = fromDefaults({ 'portfolio.accounts': [] });
    const accounts = getIntakeScreens('portfolio', get).find((screen) => screen.id === 'accounts')!;
    expect(validateIntakeScreen('portfolio', accounts, get)).toEqual({});
  });

  it('accepts only the listed mixes and purchase modes', () => {
    const get = fromDefaults({ 'investing.targetMix': '90-10', 'assumptions.portfolio.mode': 'odd-lots' });
    const [targets] = getIntakeScreens('portfolio', get);
    const settings = PORTFOLIO_FORM.screens[4];
    expect(validateIntakeScreen('portfolio', targets, get)).toEqual({
      'investing.targetMix': 'Target mix must be one of the listed options.',
    });
    expect(validateIntakeScreen('portfolio', settings, get)).toEqual({
      'assumptions.portfolio.mode': 'Purchase mode must be one of the listed options.',
    });
  });
});

describe("portfolio intake: 'remaining' mode", () => {
  it('asks all 3 profile screens with or without the basics', () => {
    expect(remainingIds([])).toEqual(['targets', 'accounts', 'holdings']);
    expect(remainingIds([...CORE_PATHS])).toEqual(['targets', 'accounts', 'holdings']);
  });

  it('drops a screen once every visible fact on it is answered', () => {
    expect(remainingIds(['investing.targetMix', 'portfolio.accounts'])).toEqual(['holdings']);
    // With the custom mix the targets screen also needs the class targets.
    expect(remainingIds(['investing.targetMix'], custom)).toEqual(['targets', 'accounts', 'holdings']);
    expect(remainingIds(['investing.targetMix', 'portfolio.classTargets'], custom)).toEqual(['accounts', 'holdings']);
    // The settings never hold the intake back.
    expect(remainingIds(['investing.targetMix', 'portfolio.accounts', 'portfolio.holdings'])).toEqual([]);
  });

  it('asks the accounts while the list is unanswered, even with a balance already set', () => {
    // A balance on the Brokerage row does not answer the accounts list; only
    // the list's own path in profile.provided does.
    const base = getDefaultFinancialProfile();
    const accounts = base.portfolio.accounts.map((a, i) => (i === 1 ? { ...a, balance: 2400 } : a));
    const profile = {
      ...base,
      portfolio: { ...base.portfolio, accounts },
      provided: [...CORE_PATHS, 'investing.targetMix'],
    };
    expect(ids(remainingIntakeScreens('portfolio', profile))).toEqual(['accounts', 'holdings']);
    const answered = { ...profile, provided: [...profile.provided, 'portfolio.accounts'] };
    expect(ids(remainingIntakeScreens('portfolio', answered))).toEqual(['holdings']);
  });
});
