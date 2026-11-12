'use client';

import React, { useState } from 'react';
import { AlertTriangle, BarChart3, DollarSign, Info, Layers, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { ExpandableListCard } from '@/components/calculators/shared/ExpandableListCard';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { BaseCard, InputCard, ResultCard } from '@/components/ui/cards';
import { DENSE_CARD_CLASSES } from '@/components/ui/cards/density';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  DataTable,
  Disclaimer,
  KeyValueList,
  StatGrid,
  StatTile,
  type DataTableColumn,
  type KeyValueItem,
} from '@/components/ui/results';
import type { StatSpec } from '@/lib/design-system/stat';
import { TONES, type Tone } from '@/lib/design-system/tone';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

const TONE_FIGURES: Readonly<Record<Tone, number>> = {
  neutral: 412000,
  positive: 0.87,
  caution: 0.62,
  negative: 0.31,
  info: 0.04,
  brand: 1.5,
};

const TONE_STATS: readonly StatSpec[] = TONES.map((tone) => ({
  id: tone,
  label: `tone="${tone}"`,
  value: TONE_FIGURES[tone],
  format: tone === 'neutral' ? 'currency' : tone === 'brand' ? 'multiple' : 'percent',
  tone,
}));

const HEADLINE: readonly StatSpec[] = [
  { id: 'success', label: 'Success probability', value: 0.84, format: 'percent', tone: 'positive', badge: 'Current plan' },
  { id: 'projected', label: 'Projected at retirement', value: 1240000, format: 'currency-compact', hint: "Today's dollars" },
  { id: 'required', label: 'Required at retirement', value: 1100000, format: 'currency-compact', hint: "Today's dollars" },
  { id: 'withdrawal', label: 'Withdrawal rate', value: 0.038, format: 'percent-1', tone: 'positive' },
  { id: 'gap', label: 'Gap to target', value: null, format: 'currency', hint: 'A null value prints a dash' },
];

const ROWS: readonly KeyValueItem[] = [
  { id: 'gross', label: 'Gross pay', subtitle: 'per paycheck', value: 3200, format: 'currency', icon: Wallet },
  { id: 'retirement', label: '401(k) contribution', value: 192, format: 'currency', prefix: '-', icon: PiggyBank },
  { id: 'match', label: 'Employer match', value: 96, format: 'currency', prefix: '+', tone: 'positive', icon: DollarSign },
  { id: 'note', label: 'Tax bracket', value: '22% (fixed)' },
];

const DETAILS: readonly KeyValueItem[] = [
  { id: 'start', label: 'Retirement age', value: '65' },
  { id: 'income', label: 'Annual income', value: 64000, format: 'currency' },
  { id: 'years', label: 'Years of income', value: '30 years' },
  { id: 'success', label: 'Success probability', value: 0.84, format: 'percent' },
];

interface Trade {
  ticker: string;
  shares: number;
  amount: number;
  drift: number;
}

const TRADES: readonly Trade[] = [
  { ticker: 'VTI', shares: 4, amount: 1000, drift: -0.021 },
  { ticker: 'VXUS', shares: 0, amount: 0, drift: 0.004 },
  { ticker: 'BND', shares: 6, amount: 450, drift: 0.017 },
];

const TRADE_COLUMNS: readonly DataTableColumn<Trade>[] = [
  { id: 'ticker', header: 'Fund', rowHeader: true, cell: (row) => row.ticker, footer: 'Total' },
  { id: 'shares', header: 'Shares to buy', numeric: true, value: (row) => row.shares, format: 'shares' },
  { id: 'amount', header: 'Amount', numeric: true, value: (row) => row.amount, format: 'currency', footer: '$1,450' },
  {
    id: 'drift',
    header: 'Drift',
    numeric: true,
    value: (row) => row.drift,
    format: 'percent-signed',
    tone: (row) => (Math.abs(row.drift) > 0.015 ? 'caution' : undefined),
  },
];

export function ResultsSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <DemoSection
      title="Results"
      intro="The shared results vocabulary: headline figures as StatSpec data, label and value lists, tables, alerts, progress and the card shells."
    >
      <DemoBlock title="StatTile and StatGrid" icon={BarChart3}>
        <DemoEntry
          name="StatTile tones"
          description={<>Every tone in <Code>TONES</Code> (lib/design-system/tone.ts). The tone tints the border and surface; the figure stays text-foreground.</>}
        >
          <StatGrid stats={TONE_STATS} columns={3} />
        </DemoEntry>
        <DemoEntry
          name="StatGrid from a headline"
          description={<>A calculator&apos;s <Code>headline.ts</Code> returns StatSpec[]; the results header and the overview card both render it. <Code>fullWidth</Code> lets one figure lead; <Code>size=&quot;lg&quot;</Code> is the results header size.</>}
        >
          <StatGrid stats={HEADLINE} columns={2} fullWidth={['success']} size="lg" />
        </DemoEntry>
        <DemoEntry name="StatTile loading and centered" description="loading keeps the tile's size while the value is pending (the overview's deferred simulations).">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Median ending balance" value={null} format="currency" loading />
            <StatTile label="Scenarios run" value={500} format="count" align="center" />
          </div>
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="KeyValueList and DataTable" icon={Layers}>
        <DemoEntry name="KeyValueList (rows)" description="A description list: icon, subtitle, signed prefix and tone; numbers format through lib/format.">
          <KeyValueList items={ROWS} />
        </DemoEntry>
        <DemoEntry name="KeyValueList (grid)" description="Two columns of label over value, for detail panels.">
          <KeyValueList items={DETAILS} layout="grid" />
        </DemoEntry>
        <DemoEntry
          name="DataTable"
          description="Caption, row headers, numeric columns that never wrap, a per-cell tone and a footer row. On a narrow phone the table scrolls inside its own frame, never the page."
        >
          <DataTable
            caption="Trades for the new cash"
            showCaption
            framed
            columns={TRADE_COLUMNS}
            rows={TRADES}
            rowKey={(row) => row.ticker}
          />
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="Alerts and progress" icon={AlertTriangle}>
        <DemoEntry name="StatusAlert (muted)" description="A neutral panel; only the icon and the title carry the tone.">
          <div className="space-y-2">
            {TONES.map((tone) => (
              <StatusAlert key={tone} tone={tone} icon={Info} title={`tone="${tone}"`}>
                The body text stays muted.
              </StatusAlert>
            ))}
          </div>
        </DemoEntry>
        <DemoEntry
          name="StatusAlert (tinted)"
          description={<>The whole panel takes the tone; pass <Code>role=&quot;alert&quot;</Code> for a warning that follows an input change.</>}
        >
          <div className="space-y-2">
            {TONES.map((tone) => (
              <StatusAlert key={tone} tone={tone} appearance="tinted" icon={AlertTriangle} title={`tone="${tone}"`}>
                The body text reads in the foreground color.
              </StatusAlert>
            ))}
          </div>
        </DemoEntry>
        <DemoEntry name="ProgressBar" description='role="progressbar" with its value range; brand is the default tone.'>
          <div className="space-y-3">
            {TONES.map((tone, index) => (
              <div key={tone} className="space-y-1">
                <p className="font-mono text-xs text-muted-foreground">tone=&quot;{tone}&quot;</p>
                <ProgressBar
                  label={`Progress, ${tone}`}
                  value={(index + 1) * 15}
                  valueText={`${(index + 1) * 15} of 100`}
                  tone={tone}
                />
              </div>
            ))}
          </div>
        </DemoEntry>
        <DemoEntry name="ExpandableListCard" description="A toned list card with a left accent; the header toggles the details (Enter and Space too).">
          <ExpandableListCard
            icon={TrendingUp}
            title="Retire at 65"
            subtitle="Current plan"
            value="84%"
            valueSubtext="success"
            tone="positive"
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
          >
            <KeyValueList items={DETAILS} layout="grid" />
          </ExpandableListCard>
        </DemoEntry>
        <DemoEntry name="Disclaimer" description="The footer line every calculator and the overview end with.">
          <Disclaimer text="Educational estimates, not financial advice." />
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="Card shells" icon={Wallet}>
        <DemoEntry
          name="BaseCard and DENSE_CARD_CLASSES"
          description={<>The overview cards and NextSteps spread <Code>DENSE_CARD_CLASSES</Code> (components/ui/cards/density.ts): tighter padding on phones, the default padding from sm up.</>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BaseCard title="Default padding" icon={Wallet}>
              <p className="text-sm text-muted-foreground">p-6 at every width.</p>
            </BaseCard>
            <BaseCard title="Dense padding" icon={Wallet} {...DENSE_CARD_CLASSES}>
              <p className="text-sm text-muted-foreground">p-4 on a phone, p-6 from sm.</p>
            </BaseCard>
          </div>
        </DemoEntry>
        <DemoEntry name="ResultCard" description={<>A results panel with a 2px border; <Code>tone</Code> colors the border, title and icon (sage without one).</>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ResultCard title="Portfolio projections" icon={TrendingUp}>
              <p className="text-sm text-muted-foreground">No tone: the sage brand border.</p>
            </ResultCard>
            <ResultCard title="Tax-efficient placement" icon={Info} tone="info">
              <p className="text-sm text-muted-foreground">tone=&quot;info&quot;</p>
            </ResultCard>
            <ResultCard title="Account plan" icon={TrendingUp} tone="positive">
              <p className="text-sm text-muted-foreground">tone=&quot;positive&quot;</p>
            </ResultCard>
            <ResultCard title="Shortfall" icon={AlertTriangle} tone="caution">
              <p className="text-sm text-muted-foreground">tone=&quot;caution&quot;</p>
            </ResultCard>
          </div>
        </DemoEntry>
        <DemoEntry name="InputCard" description="The card FieldSection renders each topic screen in.">
          <InputCard title="Pay and location" icon={Wallet}>
            <p className="text-sm text-muted-foreground">The screen&apos;s fields render here.</p>
          </InputCard>
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default ResultsSection;
