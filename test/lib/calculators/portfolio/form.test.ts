/**
 * The portfolio form (slice c5): every field the rebalancer uses, on the
 * four screens of docs/rebuild-plan.md sections 2.12 and 2.14 (targets,
 * accounts, holdings, settings). The calculator page shows all four and the
 * portfolio intake asks all four, with no core screen before them (O5).
 */

import { describe, expect, it } from 'vitest';
import { PORTFOLIO_FORM } from '@/lib/calculators/portfolio/form';
import {
  CORE_PATHS,
  getIntakeScreens,
  intentNeedsCore,
  remainingIntakeScreens,
  skipLabelFor,
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
  it('has the targets, accounts, holdings and settings screens, in that order, on both surfaces', () => {
    expect(PORTFOLIO_FORM.screens.map((s) => [s.id, s.tier, s.surface ?? 'both', s.fields])).toEqual([
      ['targets', 'details', 'both', ['investing.targetMix', 'portfolio.classTargets']],
      ['accounts', 'details', 'both', ['portfolio.accounts']],
      ['holdings', 'details', 'both', ['portfolio.holdings']],
      ['settings', 'assumption', 'both', SETTINGS_PATHS],
    ]);
    expect(PORTFOLIO_FORM.screens.map((s) => [s.title, s.question])).toEqual([
      ['Target allocation', 'Which stock and bond mix are you aiming for?'],
      ['Accounts', 'How much new cash are you investing this month?'],
      ['Holdings', 'What does each account hold today?'],
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
      ['settings', SETTINGS_PATHS],
    ]);
    expect(fields(custom)[0]).toEqual(['targets', ['investing.targetMix', 'portfolio.classTargets']]);
    expect(askedScreens('portfolio', custom)[0].questions.map((q) => q.path)).toEqual([
      'investing.targetMix',
      'portfolio.classTargets',
    ]);
  });

  it('asks 4 screens in the intake, with no core screen before them', () => {
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
        title: 'Accounts',
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
      {
        id: 'settings',
        title: 'Settings',
        description: undefined,
        questions: [
          {
            path: 'assumptions.portfolio.mode',
            label: 'Purchase mode',
            kind: 'choice',
            help: undefined,
            options: [
              { value: 'whole', label: 'Whole shares', description: 'Rounds down; leftover stays as cash.' },
              { value: 'fractional', label: 'Fractional', description: 'Exact amounts to the penny.' },
            ],
            min: undefined,
            max: undefined,
            step: undefined,
          },
          { path: 'assumptions.portfolio.allowTaxableSelling', label: 'Allow selling in taxable accounts', kind: 'boolean', help: undefined, options: undefined, min: undefined, max: undefined, step: undefined },
          { path: 'assumptions.portfolio.showPlacementAdvice', label: 'Show tax-efficient placement advice', kind: 'boolean', help: undefined, options: undefined, min: undefined, max: undefined, step: undefined },
        ],
      },
    ]);
  });

  it('still asks every question the old intake asked: the mix as before, the new cash as each account\'s deposit', () => {
    const asked = intakePaths('portfolio');
    expect(asked).toEqual([
      'investing.targetMix',
      'portfolio.classTargets',
      'portfolio.accounts',
      'portfolio.holdings',
      ...SETTINGS_PATHS,
    ]);
    expect(asked).toContain(OLD_QUESTIONS['investing.targetMix'].path);
    // The v1 investing.newCashThisMonth is no profile path now: its one home is
    // the deposit of each account, asked with the old help on the accounts list.
    const deposit = spec('portfolio.accounts').row!.find((row) => row.path === 'deposit')!;
    const old = OLD_QUESTIONS['investing.newCashThisMonth'];
    expect([deposit.kind, deposit.help, deposit.min]).toEqual([old.kind, old.help, old.min]);
    expect(deposit.label).toBe('New cash');
  });

  it('skips with a typical value on the facts and keeps the default settings', () => {
    expect(getIntakeScreens('portfolio', fromDefaults()).map((s) => skipLabelFor(s))).toEqual([
      'Skip, use a typical value',
      'Skip, use a typical value',
      'Skip, use a typical value',
      'Keep the default assumptions',
    ]);
  });

  it('notes the capital gains risk only while taxable selling is on', () => {
    const settings = PORTFOLIO_FORM.screens[3];
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

  it('lists accounts by name, type and new cash, keeping at least one', () => {
    const accounts = spec('portfolio.accounts');
    expect(accounts.row!.map((row) => [row.path, row.kind, row.label])).toEqual([
      ['name', 'text', 'Account name'],
      ['accountType', 'select', 'Type'],
      ['deposit', 'money', 'New cash'],
    ]);
    expect(accounts.row![0]).toMatchObject({ placeholder: 'Fidelity Roth IRA', maxLength: 40, testId: 'account-name-{i}' });
    expect(accounts.row![1].options).toEqual([
      { value: 'taxable', label: 'Taxable' },
      { value: 'tax-deferred', label: 'Tax-Deferred' },
      { value: 'tax-free', label: 'Tax-Free' },
    ]);
    expect(accounts.row![2]).toMatchObject({ min: 0, precision: 2, placeholder: '0.00' });
    expect(accounts).toMatchObject({ minRows: 1, addLabel: 'Add account' });
    expect(accounts.itemLabel!({ name: 'Roth IRA' }, 0)).toBe('Roth IRA');
    expect(accounts.itemLabel!({ name: '' }, 2)).toBe('Account 3');
  });

  it('asks before removing an account, which takes its holdings and their unused securities with it', () => {
    const accounts = spec('portfolio.accounts');
    expect(accounts.confirmRemove!({ name: 'Roth IRA' }, 0)).toBe('Delete Roth IRA? Its holdings will be removed too.');
    expect(accounts.confirmRemove!({ name: '' }, 1)).toBe('Delete account 2? Its holdings will be removed too.');
    // The remove button names the account as the prompt does.
    expect(accounts.removeLabel!({ name: 'Roth IRA' }, 0)).toBe('Remove Roth IRA');
    expect(accounts.removeLabel!({ name: '' }, 2)).toBe('Remove account 3');
    const defaults = getDefaultFinancialProfile().portfolio;
    expect(accounts.removeRow!(fromDefaults(), 0)).toEqual([
      { path: 'portfolio.securities', value: [defaults.securities[0], defaults.securities[1]] },
      { path: 'portfolio.holdings', value: [defaults.holdings[2], defaults.holdings[3]] },
    ]);
    expect(accounts.removeRow!(fromDefaults(), 5)).toEqual([]);
  });

  it('adds a numbered taxable account with no new cash', () => {
    expect(spec('portfolio.accounts').newRow!(fromDefaults())).toEqual({
      id: 'acc-3',
      name: 'Account 3',
      accountType: 'taxable',
      deposit: 0,
    });
  });

  it('summarizes each screen in one line', () => {
    const [targets, accounts, holdings, settings] = PORTFOLIO_FORM.screens;
    expect(summarizeScreen(PORTFOLIO_FORM, targets, fromDefaults())).toBe('80% stocks, 20% bonds');
    expect(summarizeScreen(PORTFOLIO_FORM, targets, custom)).toBe('Custom, US Stock 60%, Intl Stock 20%, Bonds 20%');
    expect(summarizeScreen(PORTFOLIO_FORM, accounts, fromDefaults())).toBe('2 accounts, $1,000 new cash');
    expect(summarizeScreen(PORTFOLIO_FORM, holdings, fromDefaults())).toBe('4 holdings');
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
            { id: 'acc-roth', name: 'x'.repeat(41), accountType: 'tax-free', deposit: 0 },
            { id: 'acc-brok', name: 'Brokerage', accountType: 'crypto', deposit: -1 },
          ],
        },
      ])
    );
    const accounts = getIntakeScreens('portfolio', get)[1];
    expect(validateIntakeScreen('portfolio', accounts, get)).toEqual({
      'portfolio.accounts.0.name': 'Account name must be 40 characters or fewer.',
      'portfolio.accounts.1.accountType': 'Type must be one of the listed options.',
      'portfolio.accounts.1.deposit': 'New cash must be at least $0.',
    });
  });

  it('needs at least one account', () => {
    const get = fromDefaults({ 'portfolio.accounts': [] });
    const accounts = getIntakeScreens('portfolio', get)[1];
    expect(validateIntakeScreen('portfolio', accounts, get)).toEqual({
      'portfolio.accounts': 'Accounts needs at least 1 entry.',
    });
  });

  it('accepts only the listed mixes and purchase modes', () => {
    const get = fromDefaults({ 'investing.targetMix': '90-10', 'assumptions.portfolio.mode': 'odd-lots' });
    const [targets, , , settings] = getIntakeScreens('portfolio', get);
    expect(validateIntakeScreen('portfolio', targets, get)).toEqual({
      'investing.targetMix': 'Target mix must be one of the listed options.',
    });
    expect(validateIntakeScreen('portfolio', settings, get)).toEqual({
      'assumptions.portfolio.mode': 'Purchase mode must be one of the listed options.',
    });
  });
});

describe("portfolio intake: 'remaining' mode", () => {
  it('asks all 4 screens with or without the basics', () => {
    expect(remainingIds([])).toEqual(['targets', 'accounts', 'holdings', 'settings']);
    expect(remainingIds([...CORE_PATHS])).toEqual(['targets', 'accounts', 'holdings', 'settings']);
  });

  it('drops a screen once every visible fact on it is answered', () => {
    expect(remainingIds(['investing.targetMix', 'portfolio.accounts'])).toEqual(['holdings', 'settings']);
    // With the custom mix the targets screen also needs the class targets.
    expect(remainingIds(['investing.targetMix'], custom)).toEqual(['targets', 'accounts', 'holdings', 'settings']);
    expect(remainingIds(['investing.targetMix', 'portfolio.classTargets'], custom)).toEqual([
      'accounts',
      'holdings',
      'settings',
    ]);
    expect(remainingIds(['investing.targetMix', 'portfolio.accounts', 'portfolio.holdings', ...SETTINGS_PATHS])).toEqual([]);
  });

  it('asks the accounts while the list is unanswered, even with a deposit already set', () => {
    // A deposit on the Brokerage row does not answer the accounts list; only
    // the list's own path in profile.provided does.
    const base = getDefaultFinancialProfile();
    const accounts = base.portfolio.accounts.map((a, i) => (i === 1 ? { ...a, deposit: 2400 } : a));
    const profile = {
      ...base,
      portfolio: { ...base.portfolio, accounts },
      provided: [...CORE_PATHS, 'investing.targetMix'],
    };
    expect(ids(remainingIntakeScreens('portfolio', profile))).toEqual(['accounts', 'holdings', 'settings']);
    const answered = { ...profile, provided: [...profile.provided, 'portfolio.accounts'] };
    expect(ids(remainingIntakeScreens('portfolio', answered))).toEqual(['holdings', 'settings']);
  });
});
