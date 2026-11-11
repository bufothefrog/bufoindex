'use client';

import React from 'react';
import { RotateCcw, SlidersHorizontal, Wallet } from 'lucide-react';
import { InputCard } from '@/components/ui/cards';
import { MoneyInput, NumberInput, PercentInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  type DcaComparisonInputs,
} from '@/lib/calculations/leverageComparison';
import { LEVERAGE_INPUT_BOUNDS, LEVERAGE_RATIO_OPTIONS } from '@/lib/constants/leverage';
import { formatLeverage } from './format';

export interface LeverageInputsProps {
  inputs: DcaComparisonInputs;
  onChange: (patch: Partial<DcaComparisonInputs>) => void;
}

const RATIO_LABELS: Record<number, string> = {
  1: '1x (index exposure, leveraged-fund fees)',
  2: '2x (SSO-like daily-reset fund)',
  3: '3x (UPRO-like daily-reset fund)',
};

// SelectInput and the BaseCard collapse toggle render 40px and 24px controls;
// these utilities lift them to a 44px+ tap target without forking either.
const TALL_SELECT = '[&_select]:h-12 [&_select]:text-base';
const TALL_COLLAPSE_TOGGLE =
  '[&_button]:flex [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:items-center [&_button]:justify-center';

export function LeverageInputs({ inputs, onChange }: LeverageInputsProps) {
  const ratioOptions: number[] = [...LEVERAGE_RATIO_OPTIONS];
  if (!ratioOptions.includes(inputs.leverageRatio)) {
    ratioOptions.push(inputs.leverageRatio);
    ratioOptions.sort((a, b) => a - b);
  }
  const b = LEVERAGE_INPUT_BOUNDS;
  const d = DEFAULT_DCA_COMPARISON_INPUTS;
  const L = formatLeverage(inputs.leverageRatio);

  const resetAssumptions = () =>
    onChange({
      indexMeanReturn: d.indexMeanReturn,
      indexVolatility: d.indexVolatility,
      financingRate: d.financingRate,
      expenseRatio: d.expenseRatio,
      indexExpenseRatio: d.indexExpenseRatio,
    });

  return (
    <div className="space-y-6">
      <InputCard title="Contributions" icon={Wallet}>
        <div className="space-y-4">
          <MoneyInput
            name="monthlyContribution"
            label="Monthly contribution"
            value={inputs.monthlyContribution}
            onChange={(value) => onChange({ monthlyContribution: value })}
            max={b.maxMonthlyContribution}
            size="lg"
            help="Invested at the start of every month, in both funds."
          />
          <NumberInput
            name="years"
            label="Years"
            value={inputs.years}
            onChange={(value) => onChange({ years: value })}
            min={b.minYears}
            max={b.maxYears}
            allowDecimals={false}
            suffix="yrs"
            size="lg"
            help={`${b.minYears} to ${b.maxYears} years of monthly contributions.`}
          />
          <MoneyInput
            name="startingBalance"
            label="Starting balance"
            value={inputs.startingBalance}
            onChange={(value) => onChange({ startingBalance: value })}
            max={b.maxStartingBalance}
            size="lg"
            help="Already invested at month 0. Use 0 to compare contributions only."
          />
          <SelectInput
            name="leverageRatio"
            label="Leverage ratio"
            value={String(inputs.leverageRatio)}
            onChange={(value) => onChange({ leverageRatio: Number(value) })}
            options={ratioOptions.map((ratio) => ({
              value: String(ratio),
              label: RATIO_LABELS[ratio] ?? `${formatLeverage(ratio)} daily-reset fund`,
            }))}
            className={TALL_SELECT}
            help={
              inputs.leverageRatio === 1
                ? 'At 1x the only difference from the index fund is the expense ratio in Assumptions.'
                : `Compared against a plain index fund receiving the same dollars on the same dates.`
            }
          />
        </div>
      </InputCard>

      <InputCard
        title="Assumptions"
        icon={SlidersHorizontal}
        collapsible
        defaultCollapsed
        headerClassName={TALL_COLLAPSE_TOGGLE}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defaults are long-run planning figures with sources listed under Model and caveats.
            Change them to test a flat decade or higher borrowing costs.
          </p>
          <PercentInput
            name="indexMeanReturn"
            label="Index expected annual return"
            value={inputs.indexMeanReturn}
            onChange={(value) => onChange({ indexMeanReturn: value })}
            min={b.minReturn}
            max={b.maxReturn}
            precision={1}
            size="lg"
            help="Expected simple return of the underlying index, before fund costs."
          />
          <PercentInput
            name="indexVolatility"
            label="Index annual volatility"
            value={inputs.indexVolatility}
            onChange={(value) => onChange({ indexVolatility: value })}
            min={b.minVolatility}
            max={b.maxVolatility}
            precision={1}
            size="lg"
            help={`The ${L} fund's volatility is about ${L} this figure.`}
          />
          <PercentInput
            name="financingRate"
            label="Financing rate on borrowed exposure"
            value={inputs.financingRate}
            onChange={(value) => onChange({ financingRate: value })}
            min={0}
            max={b.maxFinancingRate}
            precision={2}
            size="lg"
            help="Short-term rate plus a swap spread, charged on the extra (L - 1) exposure."
          />
          <PercentInput
            name="expenseRatio"
            label="Leveraged fund expense ratio"
            value={inputs.expenseRatio}
            onChange={(value) => onChange({ expenseRatio: value })}
            min={0}
            max={b.maxExpenseRatio}
            precision={2}
            size="lg"
          />
          <PercentInput
            name="indexExpenseRatio"
            label="Index fund expense ratio"
            value={inputs.indexExpenseRatio}
            onChange={(value) => onChange({ indexExpenseRatio: value })}
            min={0}
            max={b.maxExpenseRatio}
            precision={2}
            size="lg"
          />
          <p className="text-xs text-muted-foreground">
            {inputs.paths} simulated paths with a fixed seed, so the same inputs always give the
            same results. A different seed would move the summary figures by a few percentage
            points.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={resetAssumptions}
            className="h-11 w-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore default assumptions
          </Button>
        </div>
      </InputCard>
    </div>
  );
}

export default LeverageInputs;
