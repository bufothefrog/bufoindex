'use client';

import React, { useState } from 'react';
import { Coins, Heart, Loader2, Scissors, Settings, Sliders, Star, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { MoneyInput, NumberInput, PercentInput } from '@/components/ui/inputs';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { TickerCombobox } from '@/components/ui/inputs/TickerCombobox';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { DollarModeToggle } from '@/components/shared/DollarModeToggle';
import { LookupHint } from '@/components/shared/LookupHint';
import { DEFAULT_DOLLAR_DISPLAY_MODE, type DollarDisplayMode } from '@/lib/utils/displayDollars';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

type Mode = 'whole' | 'fractional';
type Span = '1y' | '5y' | '10y';

const MODE_OPTIONS: readonly SegmentedControlOption<Mode>[] = [
  { value: 'whole', label: 'Whole shares', description: 'Rounds down; leftover stays as cash.', icon: Coins },
  { value: 'fractional', label: 'Fractional', description: 'Exact amounts to the penny.', icon: Scissors },
];

const SPAN_OPTIONS: readonly SegmentedControlOption<Span>[] = [
  { value: '1y', label: '1 year' },
  { value: '5y', label: '5 years' },
  { value: '10y', label: '10 years' },
];

const TICKERS = [
  { id: 'vti', ticker: 'VTI', price: 250 },
  { id: 'vxus', ticker: 'VXUS', price: 60 },
  { id: 'bnd', ticker: 'BND', price: 75 },
];

export interface ControlsSectionProps {
  /** Keeps control names and ids unique when the gallery renders twice (light and dark). */
  idPrefix: string;
}

export function ControlsSection({ idPrefix }: ControlsSectionProps) {
  const [number, setNumber] = useState(42);
  const [money, setMoney] = useState(75000);
  const [blankMoney, setBlankMoney] = useState<number | null>(null);
  const [percent, setPercent] = useState(0.25);
  const [state, setState] = useState('CA');
  const [filing, setFiling] = useState('single');
  const [ticker, setTicker] = useState('VTI');
  const [mode, setMode] = useState<Mode>('whole');
  const [span, setSpan] = useState<Span>('5y');
  const [dollarMode, setDollarMode] = useState<DollarDisplayMode>(DEFAULT_DOLLAR_DISPLAY_MODE);

  return (
    <DemoSection title="Controls" intro="The input primitives the field renderers compose, and the standalone controls.">
      <DemoBlock title="Buttons" icon={Settings}>
        <DemoEntry name="Variants">
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
        </DemoEntry>
        <DemoEntry name="Sizes">
          <div className="flex flex-wrap items-end gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Favorite">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </DemoEntry>
        <DemoEntry name="States">
          <div className="flex flex-wrap gap-3">
            <Button>Normal</Button>
            <Button disabled>Disabled</Button>
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading
            </Button>
            <Button>
              <Star className="mr-2 h-4 w-4" />
              With icon
            </Button>
          </div>
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="Input primitives" icon={Sliders}>
        <p className="text-sm text-muted-foreground">
          FieldInput picks one of these per FieldSpec kind; use them directly only outside a form spec.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <NumberInput
            name={`${idPrefix}-number`}
            label="NumberInput"
            value={number}
            onChange={setNumber}
            min={0}
            max={100}
            suffix=" years"
            help="Word units sit beside the box and join its description."
          />
          <MoneyInput name={`${idPrefix}-money`} label="MoneyInput" value={money} onChange={setMoney} help="Whole dollars with a $ prefix." />
          <PercentInput
            name={`${idPrefix}-percent`}
            label="PercentInput"
            value={percent}
            onChange={setPercent}
            min={0}
            max={1}
            showSlider
            help="Stores a fraction (0.25), shows 25.0%; showSlider adds the slider."
          />
          <StateSelector name={`${idPrefix}-state`} label="StateSelector" value={state} onChange={setState} help="Searchable list of the states." />
          <SelectInput
            name={`${idPrefix}-filing`}
            label="SelectInput"
            value={filing}
            onChange={setFiling}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'marriedJoint', label: 'Married filing jointly' },
              { value: 'marriedSeparate', label: 'Married filing separately' },
              { value: 'headOfHousehold', label: 'Head of household' },
            ]}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${idPrefix}-ticker`}>
              TickerCombobox
            </label>
            <TickerCombobox
              id={`${idPrefix}-ticker`}
              value={ticker}
              options={TICKERS}
              onSelectExisting={(id) => setTicker(TICKERS.find((t) => t.id === id)?.ticker ?? '')}
              onCommitNewTicker={setTicker}
            />
          </div>
          <MoneyInput
            name={`${idPrefix}-blank`}
            label="Unanswered (intake)"
            value={blankMoney}
            onChange={setBlankMoney}
            onClear={() => setBlankMoney(null)}
            placeholderValue={3500}
            showZero
            help="null shows empty with the typical value as the placeholder; a typed 0 shows as 0."
          />
          <MoneyInput
            name={`${idPrefix}-error`}
            label="Input with an error"
            value={0}
            onChange={() => {}}
            error="Enter an amount above $0."
            required
          />
          <div className="space-y-1.5">
            <MoneyInput name={`${idPrefix}-lookup`} label="Expected Social Security (monthly)" value={1800} onChange={() => {}} />
            <LookupHint>ssa.gov/myaccount shows your estimate.</LookupHint>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={`${idPrefix}-text`}>
              Input (plain text)
            </label>
            <Input id={`${idPrefix}-text`} placeholder="Brokerage" />
          </div>
        </div>
      </DemoBlock>

      <DemoBlock title="Choice controls" icon={ToggleLeft}>
        <DemoEntry
          name="SegmentedControl (track)"
          description={<>A radio group with roving focus and arrow keys. <Code>size=&quot;md&quot;</Code> is a 44px target; <Code>fullWidth</Code> splits the width evenly.</>}
        >
          <div className="space-y-4">
            <SegmentedControl label="Horizon" options={SPAN_OPTIONS} value={span} onChange={setSpan} />
            <SegmentedControl label="Horizon (md, full width)" options={SPAN_OPTIONS} value={span} onChange={setSpan} size="md" fullWidth />
          </div>
        </DemoEntry>
        <DemoEntry name="SegmentedControl (cards)" description="One bordered card per option, with an icon and a description.">
          <SegmentedControl label="Purchase mode" options={MODE_OPTIONS} value={mode} onChange={setMode} appearance="cards" />
        </DemoEntry>
        <DemoEntry
          name="DollarModeToggle"
          description="Display only: simulations run in nominal dollars, and this switches how results are shown."
        >
          <DollarModeToggle value={dollarMode} onChange={setDollarMode} />
        </DemoEntry>
        <DemoEntry name="ThemeToggle">
          <ThemeToggle />
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default ControlsSection;
