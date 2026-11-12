'use client';

import React, { useMemo, useState } from 'react';
import { ListChecks, Rows3, SquareStack } from 'lucide-react';
import {
  ChoiceGroup,
  FieldInput,
  FieldList,
  FieldSection,
  NullableField,
  type CustomRenderers,
} from '@/components/fields';
import { Checkbox } from '@/components/ui/checkbox';
import { SliderField } from '@/components/ui/inputs';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { HoldingRow } from '@/app/tools/portfolio-rebalancing-calculator/components/HoldingRow';
import type { Holding, Security } from '@/lib/calculations/portfolioRebalancing';
import { applyWrites, makeGet } from '@/lib/fields/paths';
import { validateFields } from '@/lib/fields/runtime';
import type { FieldKind, FieldOption, FieldSpec, FormSpec, Write } from '@/lib/fields/types';
import { formatCurrency, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

const FREQUENCY_OPTIONS: readonly FieldOption[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Monthly' },
];

const MIX_OPTIONS: readonly FieldOption[] = [
  { value: 'stocks-80', label: '80% stocks, 20% bonds', description: 'More growth, deeper drawdowns.' },
  { value: 'stocks-60', label: '60% stocks, 40% bonds', description: 'Smaller swings, lower expected growth.' },
];

const SOURCE_OPTIONS = [
  { value: 'statement', label: 'Statement' },
  { value: 'estimate', label: 'Estimate' },
] as const;
type Source = (typeof SOURCE_OPTIONS)[number]['value'];

const DEBTS: FieldSpec = {
  path: 'demo.debts',
  kind: 'list',
  label: 'Debts',
  tier: 'details',
  addLabel: 'Add debt',
  emptyText: 'No debts yet.',
  maxRows: 3,
  itemLabel: (row, index) => (typeof row.name === 'string' && row.name !== '' ? row.name : `Debt ${index + 1}`),
  row: [
    { path: 'name', kind: 'text', label: 'Name', tier: 'details', maxLength: 40 },
    { path: 'balance', kind: 'money', label: 'Balance', tier: 'details' },
  ],
};

/** One sample FieldSpec per kind, on demo paths (nothing here touches the visitor's profile). */
const DEMO_FIELDS: readonly FieldSpec[] = [
  { path: 'demo.gross', kind: 'money', label: 'Gross pay per paycheck', tier: 'core', help: 'Before taxes and deductions.', summary: (v) => `${formatCurrency(Number(v))} gross` },
  { path: 'demo.cash', kind: 'money', label: 'New cash', tier: 'details', precision: 2, placeholder: '0.00', hint: 'Your brokerage shows the settled cash balance.' },
  { path: 'demo.age', kind: 'number', label: 'Age', tier: 'core', min: 18, max: 100, unit: { suffix: ' years' }, summary: (v) => `age ${String(v)}` },
  { path: 'demo.savingsRate', kind: 'percent', label: 'Savings rate', tier: 'details', min: 0, max: 0.5, precision: 1, slider: true },
  { path: 'demo.months', kind: 'slider', label: 'Months of costs in cash', tier: 'assumption', min: 0, max: 12, step: 1, unit: { suffix: ' months' } },
  { path: 'demo.frequency', kind: 'select', label: 'Pay frequency', tier: 'core', options: FREQUENCY_OPTIONS },
  { path: 'demo.mix', kind: 'choice', label: 'Target mix', tier: 'details', options: MIX_OPTIONS },
  { path: 'demo.hasPlan', kind: 'boolean', label: 'My employer offers a 401(k)', tier: 'details', help: 'Shows the plan questions when checked.' },
  { path: 'demo.state', kind: 'state', label: 'State', tier: 'core', summary: (v) => String(v) },
  { path: 'demo.accountName', kind: 'text', label: 'Account name', tier: 'details', maxLength: 40, placeholder: 'Brokerage' },
  {
    path: 'demo.taxRate',
    kind: 'percent',
    label: 'Effective tax rate',
    tier: 'assumption',
    min: 0,
    max: 0.6,
    precision: 1,
    nullable: { autoLabel: 'Estimated from your pay', overrideDefault: 0.15 },
  },
  DEBTS,
  { path: 'demo.source', kind: 'custom', label: 'Balance source', tier: 'details', renderer: 'demo-source' },
];

const DEMO_FORM: FormSpec = {
  id: 'demo',
  fields: DEMO_FIELDS,
  screens: [
    {
      id: 'pay',
      title: 'Pay and location',
      description: 'A core screen: collapsed to its summary once answered, with Edit and Done.',
      tier: 'core',
      fields: ['demo.gross', 'demo.frequency', 'demo.state', 'demo.age'],
    },
    {
      id: 'assumptions',
      title: 'Assumptions',
      tier: 'assumption',
      fields: ['demo.months', 'demo.taxRate'],
      notes: [{ text: 'Assumption screens offer Restore defaults.', tone: 'info' }],
    },
  ],
};

const INITIAL_VALUES = {
  demo: {
    gross: 3200,
    cash: 1000,
    age: 34,
    savingsRate: 0.12,
    months: 3,
    frequency: 'biweekly',
    mix: 'stocks-80',
    hasPlan: true,
    state: 'CO',
    accountName: '',
    taxRate: null,
    debts: [{ id: 'debts-1', name: 'Car loan', balance: 8400 }],
    source: 'statement',
  },
};

/** The kinds that take the full width of the two-column grid (as in FieldSection). */
const WIDE_KINDS: ReadonlySet<FieldKind> = new Set(['choice', 'list', 'custom']);

const DEMO_SECURITIES: Security[] = [
  { id: 'demo-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
  { id: 'demo-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 70, assetClass: 'bonds' },
];

export interface FieldsSectionProps {
  /** Keeps control names and ids unique when the gallery renders twice (light and dark). */
  idPrefix: string;
}

export function FieldsSection({ idPrefix }: FieldsSectionProps) {
  const [values, setValues] = useState<Record<string, unknown>>(INITIAL_VALUES);
  const get = useMemo(() => makeGet(values), [values]);
  const errors = useMemo(() => validateFields(DEMO_FORM, get), [get]);
  const onWrite = (writes: Write[]) => setValues((current) => applyWrites(current, writes));
  const [payCollapsed, setPayCollapsed] = useState(true);

  const [choice, setChoice] = useState<FieldOption['value']>('stocks-60');
  const [checked, setChecked] = useState(false);
  const [slider, setSlider] = useState(0.04);
  const [auto, setAuto] = useState(true);
  // HoldingRow derives its input ids from the holding id, so each panel gets its own.
  const [holding, setHolding] = useState<Holding>(() => ({
    id: `${idPrefix}-holding`,
    accountId: 'demo-acc',
    securityId: 'demo-vti',
    shares: 12,
  }));
  const [securities, setSecurities] = useState<Security[]>(DEMO_SECURITIES);

  const renderers: CustomRenderers = useMemo(
    () => ({
      'demo-source': ({ spec, value, onWrite: write }) => (
        <SegmentedControl<Source>
          label={spec.label}
          options={SOURCE_OPTIONS}
          value={value === 'estimate' ? 'estimate' : 'statement'}
          onChange={(next) => write([{ path: spec.path, value: next }])}
        />
      ),
    }),
    []
  );

  const restoreAssumptions = () =>
    onWrite([
      { path: 'demo.months', value: INITIAL_VALUES.demo.months },
      { path: 'demo.taxRate', value: INITIAL_VALUES.demo.taxRate },
    ]);

  const updateSecurity = (id: string, patch: Partial<Security>) =>
    setSecurities((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <DemoSection
      title="Fields"
      intro="Every input on the calculator pages and in the intake renders from a FieldSpec in lib/fields through these components."
    >
      <DemoBlock title="FieldInput: every kind" icon={Rows3}>
        <p className="text-sm text-muted-foreground">
          One FieldSpec per kind on demo paths, validated live with <Code>validateFields</Code> (try an age
          over 100). Money with <Code>precision</Code> types decimals; <Code>hint</Code> renders a LookupHint;
          a <Code>nullable</Code> spec wraps its input in NullableField; <Code>custom</Code> renders a
          renderer by id.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {DEMO_FIELDS.map((spec) => (
            <div key={spec.path} className={cn('min-w-0 space-y-2', WIDE_KINDS.has(spec.kind) && 'md:col-span-2')}>
              <p className="font-mono text-xs text-muted-foreground">kind: {spec.kind}{spec.nullable ? ' (nullable)' : ''}</p>
              <FieldInput
                spec={spec}
                get={get}
                onWrite={onWrite}
                error={errors[spec.path]}
                errors={errors}
                renderers={renderers}
                idPrefix={`${idPrefix}-field`}
              />
            </div>
          ))}
        </div>
      </DemoBlock>

      <DemoBlock title="FieldSection and FieldList" icon={SquareStack}>
        <DemoEntry
          name="FieldSection"
          description="One topic screen as an input card: the tier icon, the toggle (Edit / Done on core screens), the collapsed one-line summary, screen notes, and Restore defaults on an assumption screen. A field error keeps the card open."
        >
          <div className="space-y-4">
            <FieldSection
              form={DEMO_FORM}
              screen={DEMO_FORM.screens[0]}
              get={get}
              errors={errors}
              onWrite={onWrite}
              collapsed={payCollapsed}
              onToggle={() => setPayCollapsed((c) => !c)}
            />
            <FieldSection
              form={DEMO_FORM}
              screen={DEMO_FORM.screens[1]}
              get={get}
              errors={errors}
              onWrite={onWrite}
              onRestoreDefaults={restoreAssumptions}
            />
          </div>
        </DemoEntry>
        <DemoEntry
          name="FieldList"
          description="An editable list of rows whose fields are row-relative FieldSpecs; Add, Remove (focus returns to Add) and maxRows. The same list renders through FieldInput above."
        >
          <FieldList spec={DEBTS} get={get} onWrite={onWrite} errors={errors} idPrefix={`${idPrefix}-list`} />
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="Field building blocks" icon={ListChecks}>
        <DemoEntry name="ChoiceGroup" description="A radio group of OptionCards; stack is the intake layout, grid the calculator layout.">
          <ChoiceGroup label="Target mix" options={MIX_OPTIONS} value={choice} onChange={setChoice} layout="stack" />
        </DemoEntry>
        <DemoEntry name="Checkbox" description="Native checkbox with a 44px row, help text and an announced error.">
          <div className="space-y-2">
            <Checkbox name={`${idPrefix}-checkbox`} label="Include employer match" checked={checked} onChange={setChecked} help="Adds the match to the plan's yearly total." />
            <Checkbox name={`${idPrefix}-checkbox-error`} label="I have read the assumptions" checked={false} onChange={() => {}} error="Check this box to continue." />
          </div>
        </DemoEntry>
        <DemoEntry name="SliderField" description="A labelled slider that prints its bounds and value through formatValue.">
          <SliderField
            name={`${idPrefix}-slider`}
            label="Withdrawal rate"
            value={slider}
            onChange={setSlider}
            min={0.02}
            max={0.07}
            step={0.005}
            formatValue={(n) => formatPercent(n, { digits: 1 })}
          />
        </DemoEntry>
        <DemoEntry name="NullableField" description="Auto shows the derived value and where it comes from; Custom shows the input.">
          <NullableField
            label="Monthly contribution"
            isAuto={auto}
            autoLabel="From your taxable investing"
            autoValue="$500"
            onAuto={() => setAuto(true)}
            onCustom={() => setAuto(false)}
          >
            <p className="text-sm text-muted-foreground">The field&apos;s own input renders here while Custom is selected.</p>
          </NullableField>
        </DemoEntry>
        <DemoEntry
          name="HoldingRow"
          description="The rebalancer's holding row (a custom renderer): ticker combobox, price, asset class and shares. context puts the account into each input's accessible name."
        >
          <HoldingRow
            holding={holding}
            security={securities.find((s) => s.id === holding.securityId) ?? null}
            securities={securities}
            index={0}
            canRemove={false}
            context="Demo account holding 1"
            onChangeHolding={(patch) => setHolding((h) => ({ ...h, ...patch }))}
            onChangeSecurity={(patch) => updateSecurity(holding.securityId, patch)}
            onSelectSecurity={(securityId) => setHolding((h) => ({ ...h, securityId }))}
            onCommitTicker={(ticker) => updateSecurity(holding.securityId, { ticker })}
            onRemove={() => {}}
          />
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default FieldsSection;
