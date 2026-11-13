'use client';

import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import { CalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { InputCard } from '@/components/ui/cards';
import { StatGrid } from '@/components/ui/results';
import { MoneyInput } from '@/components/ui/inputs';
import type { StatSpec } from '@/lib/design-system/stat';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

const RESULTS: readonly StatSpec[] = [
  { id: 'savings', label: 'Monthly savings', value: 1000, format: 'currency', tone: 'positive' },
  { id: 'rate', label: 'Savings rate', value: 0.2, format: 'percent' },
];

export interface LayoutsSectionProps {
  /** Keeps control names and ids unique when the gallery renders twice (light and dark). */
  idPrefix: string;
}

export function LayoutsSection({ idPrefix }: LayoutsSectionProps) {
  const inputs = (name: string, title = 'Inputs', label = 'Monthly income', value = 5000) => (
    <InputCard title={title}>
      <MoneyInput name={`${idPrefix}-${name}`} label={label} value={value} onChange={() => {}} />
    </InputCard>
  );

  return (
    <DemoSection
      title="Layouts"
      intro="Every calculator page is a CalculatorPage: the registry entry, the form's FieldSections and the results, inside CalculatorLayout."
    >
      <DemoBlock title="CalculatorLayout" icon={LayoutTemplate}>
        <DemoEntry
          name="Live results"
          description={<>The results follow the inputs (no Calculate button). Below lg the layout shows an Inputs | Results tab bar and a sticky bar whose one action is See results / Edit inputs; <Code>resultFooter</Code> closes the results.</>}
        >
          <div className="rounded-lg bg-muted/30 p-2 sm:p-4">
            <CalculatorLayout
              title="Live layout"
              description="Results recalculate as the inputs change."
              resultsLabel="Live layout results"
              inputSections={inputs('live-income')}
              resultSection={<StatGrid stats={RESULTS} />}
              resultFooter={<p className="text-sm text-muted-foreground">The resultFooter slot (NextSteps on a calculator page).</p>}
              disclaimer="Layout demonstration, not financial advice."
            />
          </div>
        </DemoEntry>
        <DemoEntry
          name="Inputs above"
          description={<>From lg the inputs sit in one row above full-width results; used where the inputs are short. Set with <Code>inputsPlacement=&quot;above&quot;</Code>; below lg it is the same tab layout.</>}
        >
          <div className="rounded-lg bg-muted/30 p-2 sm:p-4">
            <CalculatorLayout
              title="Inputs above"
              description="A row of short input cards over the results."
              resultsLabel="Inputs above results"
              inputsPlacement="above"
              inputSections={
                // The gallery column is narrow, so the demo row follows its
                // own width; a calculator uses lg / xl columns.
                <div className="@container">
                  <div className="space-y-4 @md:grid @md:grid-cols-2 @md:items-start @md:gap-6 @md:space-y-0">
                    {inputs('above-income', 'Income')}
                    {inputs('above-spending', 'Spending', 'Monthly spending', 4000)}
                  </div>
                </div>
              }
              resultSection={<StatGrid stats={RESULTS} />}
            />
          </div>
        </DemoEntry>
        <DemoEntry
          name="Live empty state"
          description="With no results (a field is invalid before the first run), the results column shows the live empty state."
        >
          <div className="rounded-lg bg-muted/30 p-2 sm:p-4">
            <CalculatorLayout
              title="Empty layout"
              description="No valid inputs yet."
              inputSections={inputs('empty-income')}
            />
          </div>
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default LayoutsSection;
