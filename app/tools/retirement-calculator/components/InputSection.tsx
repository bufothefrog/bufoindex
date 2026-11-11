'use client';

import React, { useId, useState, useSyncExternalStore } from 'react';
import { useRetirementStore, useRetirementInputs } from '@/lib/store/retirementStore';
import type { IncomePeriod, RetirementInputs } from '@/lib/calculations/retirement';
import { InputCard } from '@/components/ui/cards';
import { Button } from '@/components/ui/button';
import { MoneyInput, NumberInput, PercentInput } from '@/components/ui/inputs';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { EqualRow } from '@/components/shared/layout/InputRow';
import { TwoColumnFields, SingleColumnFields } from '@/components/shared/layout/FieldGroup';
import { RiskProfileSelector } from '@/components/retirement/RiskProfileSelector';
import { LookupHint } from '@/components/shared/LookupHint';
import { formatPercent, formatCurrency } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  User,
  FileSearch,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Pencil
} from 'lucide-react';

// Fields in each tier, used to force a section open when one of its fields
// has a validation error (a collapsed card would otherwise hide it).
const QUICK_FIELDS = ['startingAge', 'retirementAge', 'currentIncome', 'incomeAmount', 'monthlySavings', 'startingBalance', 'state', 'filingStatus'];
const DETAIL_FIELDS = ['targetIncome', 'necessaryMonthlyExpenses', 'socialSecurityBenefit', 'socialSecurityAge', 'estimatedAnnualHealthcareCost', 'lifeExpectancy'];
const ASSUMPTION_FIELDS = ['accumulationReturn', 'retirementReturn', 'inflationRate', 'volatility', 'effectiveTaxRate', 'healthcareCostMultiplier'];

const INCOME_PERIOD_SUFFIX: Record<IncomePeriod, string> = {
  hourly: '/hr',
  biweekly: ' every 2 weeks',
  semimonthly: ' twice a month',
  monthly: '/mo',
  yearly: '/yr'
};

/** '30, TX, single, $100,000/yr, saving $2,000/mo, $25,000 invested, retire at 60' */
function buildQuickSummary(inputs: RetirementInputs): string {
  const parts = [
    String(inputs.startingAge),
    inputs.state,
    inputs.filingStatus === 'marriedJoint' ? 'married filing jointly' : 'single',
    `${formatCurrency(inputs.incomeAmount)}${INCOME_PERIOD_SUFFIX[inputs.incomePeriod]}`,
    `saving ${formatCurrency(inputs.monthlySavings)}/mo`,
    `${formatCurrency(inputs.startingBalance)} invested`,
    `retire at ${inputs.retirementAge}`
  ];
  return parts.filter(Boolean).join(', ');
}

function buildDetailsSummary(inputs: RetirementInputs): string {
  return [
    `${formatCurrency(inputs.targetIncome)}/yr target`,
    `${formatCurrency(inputs.necessaryMonthlyExpenses)}/mo essentials`,
    `Social Security ${formatCurrency(inputs.socialSecurityBenefit)}/yr at ${inputs.socialSecurityAge}`,
    `plan to age ${inputs.lifeExpectancy}`
  ].join(', ');
}

function buildAssumptionsSummary(inputs: RetirementInputs): string {
  const returns = inputs.riskProfile === 'tdf'
    ? 'Target-date glide path'
    : `${formatPercent(inputs.accumulationReturn)} / ${formatPercent(inputs.retirementReturn)} returns, ${formatPercent(inputs.volatility)} volatility`;
  const tax = inputs.effectiveTaxRate === null
    ? 'tax rate estimated from income'
    : `${formatPercent(inputs.effectiveTaxRate)} tax rate`;
  return [returns, `${formatPercent(inputs.inflationRate)} inflation`, tax, `${inputs.healthcareCostMultiplier}x healthcare`].join(', ');
}

// Persisted store values (hasCalculatedOnce, showAdvanced) are only trusted
// after hydration; the server snapshot keeps the first client render
// identical to the server render.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface SectionToggleProps {
  expanded: boolean;
  onToggle: () => void;
  controls: string;
  expandLabel: string;
  collapseLabel: string;
  expandIcon?: 'edit' | 'chevron';
  sectionName: string;
}

function SectionToggle({
  expanded,
  onToggle,
  controls,
  expandLabel,
  collapseLabel,
  expandIcon = 'chevron',
  sectionName
}: SectionToggleProps) {
  const ExpandIcon = expandIcon === 'edit' ? Pencil : ChevronDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={`${expanded ? collapseLabel : expandLabel} ${sectionName}`}
      className="min-h-11 shrink-0 px-3 text-sage-700 hover:bg-sage-100 dark:text-sage-200 dark:hover:bg-sage-800"
    >
      {expanded ? (
        <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
      ) : (
        <ExpandIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      {expanded ? collapseLabel : expandLabel}
    </Button>
  );
}

const CARD_HEADER_CLASS = 'p-4 pb-2 sm:p-6 sm:pb-4';
const CARD_CONTENT_CLASS = 'p-4 pt-0 sm:p-6 sm:pt-0';

export function InputSection() {
  const inputs = useRetirementInputs();
  const updateInputs = useRetirementStore((state) => state.updateInputs);
  const showAdvanced = useRetirementStore((state) => state.showAdvanced);
  const toggleAdvanced = useRetirementStore((state) => state.toggleAdvanced);
  const hasCalculatedOnce = useRetirementStore((state) => state.hasCalculatedOnce);
  const errors = useRetirementStore((state) => state.errors);
  const isClient = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  const ids = useId();
  const quickId = `${ids}-quick`;
  const detailsId = `${ids}-details`;
  const assumptionsId = `${ids}-assumptions`;

  // Quick answers start collapsed once the store says a calculation has run
  // (a returning visitor, a share link, or a hand-off from the intake flow).
  // The first edit or toggle freezes the choice, so a first-time visitor's
  // card does not fold shut under them when they press Calculate.
  const [quickOverride, setQuickOverride] = useState<boolean | null>(null);
  const [detailsCollapsedState, setDetailsCollapsedState] = useState(false);

  const hasErrorIn = (fields: string[]) => fields.some((field) => !!errors[field]);
  const quickCollapsed = !hasErrorIn(QUICK_FIELDS) && (quickOverride ?? (isClient && hasCalculatedOnce));
  const detailsCollapsed = !hasErrorIn(DETAIL_FIELDS) && detailsCollapsedState;
  const assumptionsOpen = hasErrorIn(ASSUMPTION_FIELDS) || (isClient && showAdvanced);

  const handleInputChange = (field: string, value: number | string) => {
    if (quickOverride === null) setQuickOverride(quickCollapsed);
    updateInputs({
      [field]: typeof value === 'string' ? value : Number(value)
    });
  };

  const savingsRate = (inputs.monthlySavings * 12) / inputs.currentIncome;
  const showAnnualizedHelp = inputs.incomePeriod !== 'yearly';

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Tier 1: Quick answers */}
      <InputCard
        title="Quick answers"
        icon={User}
        headerClassName={CARD_HEADER_CLASS}
        contentClassName={CARD_CONTENT_CLASS}
        actions={
          <SectionToggle
            expanded={!quickCollapsed}
            onToggle={() => setQuickOverride(!quickCollapsed)}
            controls={quickId}
            expandLabel="Edit"
            collapseLabel="Done"
            expandIcon="edit"
            sectionName="quick answers"
          />
        }
      >
        <div id={quickId}>
          {quickCollapsed ? (
            <p className="text-sm text-muted-foreground">{buildQuickSummary(inputs)}</p>
          ) : (
            <div className="space-y-6">
              <EqualRow
                left={
                  <NumberInput
                    name="startingAge"
                    label="Current Age"
                    value={inputs.startingAge}
                    onChange={(value) => handleInputChange('startingAge', value)}
                    min={0}
                    max={100}
                    allowDecimals={false}
                    help="Your current age"
                    error={errors.startingAge}
                  />
                }
                right={
                  <NumberInput
                    name="retirementAge"
                    label="Target Retirement Age"
                    value={inputs.retirementAge}
                    onChange={(value) => handleInputChange('retirementAge', value)}
                    min={0}
                    max={100}
                    allowDecimals={false}
                    help="When you want to retire"
                    error={errors.retirementAge}
                  />
                }
              />

              <SingleColumnFields>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Current Income</label>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <MoneyInput
                        name="incomeAmount"
                        label=""
                        ariaLabel="Current Income"
                        value={inputs.incomeAmount}
                        onChange={(value) => handleInputChange('incomeAmount', value)}
                        placeholder="100,000"
                        error={errors.currentIncome ?? errors.incomeAmount}
                      />
                    </div>
                    <div className="w-[140px] shrink-0">
                      <SelectInput
                        name="incomePeriod"
                        label=""
                        ariaLabel="Income period"
                        value={inputs.incomePeriod}
                        onChange={(value) => handleInputChange('incomePeriod', value)}
                        options={[
                          { value: 'hourly', label: 'Hourly' },
                          { value: 'biweekly', label: 'Bi-weekly' },
                          { value: 'semimonthly', label: 'Semi-monthly' },
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'yearly', label: 'Yearly' },
                        ]}
                      />
                    </div>
                  </div>
                  {showAnnualizedHelp && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatCurrency(inputs.currentIncome)}/year
                    </p>
                  )}
                </div>
              </SingleColumnFields>

              <EqualRow
                left={
                  <MoneyInput
                    name="monthlySavings"
                    label="Monthly Savings Amount"
                    value={inputs.monthlySavings}
                    onChange={(value) => handleInputChange('monthlySavings', value)}
                    placeholder="2,000"
                    help={`${formatPercent(savingsRate)} savings rate`}
                    error={errors.monthlySavings}
                  />
                }
                right={
                  <MoneyInput
                    name="startingBalance"
                    label="Current Investment Balance"
                    value={inputs.startingBalance}
                    onChange={(value) => handleInputChange('startingBalance', value)}
                    placeholder="10,000"
                    error={errors.startingBalance}
                  />
                }
              />

              <EqualRow
                left={
                  <StateSelector
                    name="state"
                    label="State"
                    value={inputs.state}
                    onChange={(value) => handleInputChange('state', value)}
                    placeholder="Select your state..."
                    help="For state tax calculations"
                    error={errors.state}
                  />
                }
                right={
                  <SelectInput
                    name="filingStatus"
                    label="Filing Status"
                    value={inputs.filingStatus}
                    onChange={(value) => handleInputChange('filingStatus', value)}
                    options={[
                      { value: 'single', label: 'Single' },
                      { value: 'marriedJoint', label: 'Married Filing Jointly' }
                    ]}
                    error={errors.filingStatus}
                  />
                }
              />
            </div>
          )}
        </div>
      </InputCard>

      {/* Tier 2: Details worth looking up */}
      <InputCard
        title="Details worth looking up"
        icon={FileSearch}
        headerClassName={CARD_HEADER_CLASS}
        contentClassName={CARD_CONTENT_CLASS}
        actions={
          <SectionToggle
            expanded={!detailsCollapsed}
            onToggle={() => setDetailsCollapsedState(!detailsCollapsed)}
            controls={detailsId}
            expandLabel="Show"
            collapseLabel="Hide"
            sectionName="details worth looking up"
          />
        }
      >
        <div id={detailsId}>
          {detailsCollapsed ? (
            <p className="text-sm text-muted-foreground">{buildDetailsSummary(inputs)}</p>
          ) : (
            <div className="space-y-6">
              <EqualRow
                left={
                  <div className="space-y-1.5">
                    <MoneyInput
                      name="targetIncome"
                      label="Target Annual Income in Retirement"
                      value={inputs.targetIncome}
                      onChange={(value) => handleInputChange('targetIncome', value)}
                      placeholder="80,000"
                      help={`That's $${Math.round(inputs.targetIncome * Math.pow(1 + inputs.inflationRate, inputs.retirementAge - inputs.startingAge)).toLocaleString()} in future dollars`}
                      error={errors.targetIncome}
                    />
                    <LookupHint>
                      Think about what you would spend per year; many people start near 70–80% of current income.
                    </LookupHint>
                  </div>
                }
                right={
                  <div className="space-y-1.5">
                    <MoneyInput
                      name="necessaryMonthlyExpenses"
                      label="Necessary Monthly Expenses"
                      value={inputs.necessaryMonthlyExpenses}
                      onChange={(value) => handleInputChange('necessaryMonthlyExpenses', value)}
                      placeholder="4,000"
                      help="Essential monthly expenses"
                      error={errors.necessaryMonthlyExpenses}
                    />
                    <LookupHint>
                      Rent or mortgage, utilities, insurance, groceries, minimum debt payments.
                    </LookupHint>
                  </div>
                }
              />

              <EqualRow
                left={
                  <div className="space-y-1.5">
                    <MoneyInput
                      name="socialSecurityBenefit"
                      label="Social Security Benefit"
                      value={inputs.socialSecurityBenefit}
                      onChange={(value) => handleInputChange('socialSecurityBenefit', value)}
                      placeholder="30,000"
                      help="Annual benefit estimate"
                      error={errors.socialSecurityBenefit}
                    />
                    <LookupHint>ssa.gov/myaccount shows your estimate.</LookupHint>
                  </div>
                }
                right={
                  <div className="space-y-1.5">
                    <NumberInput
                      name="socialSecurityAge"
                      label="Social Security Age"
                      value={inputs.socialSecurityAge}
                      onChange={(value) => handleInputChange('socialSecurityAge', value)}
                      min={0}
                      max={100}
                      allowDecimals={false}
                      help="When to claim benefits"
                      error={errors.socialSecurityAge}
                    />
                    <LookupHint>
                      Benefits can start between 62 and 70; the same ssa.gov statement lists the amount by claiming age.
                    </LookupHint>
                  </div>
                }
              />

              <EqualRow
                left={
                  <div className="space-y-1.5">
                    <MoneyInput
                      name="estimatedAnnualHealthcareCost"
                      label="Annual Healthcare Cost"
                      value={inputs.estimatedAnnualHealthcareCost ?? 7500}
                      onChange={(value) => handleInputChange('estimatedAnnualHealthcareCost', value)}
                      placeholder="7,500"
                      help="Override estimated annual cost"
                      error={errors.estimatedAnnualHealthcareCost}
                    />
                    <LookupHint>Premiums plus typical out-of-pocket costs for a year.</LookupHint>
                  </div>
                }
                right={
                  <div className="space-y-1.5">
                    <NumberInput
                      name="lifeExpectancy"
                      label="Life Expectancy"
                      value={inputs.lifeExpectancy}
                      onChange={(value) => handleInputChange('lifeExpectancy', value)}
                      min={0}
                      max={100}
                      allowDecimals={false}
                      suffix="years"
                      help="Age you expect to live to"
                      error={errors.lifeExpectancy}
                    />
                    <LookupHint>
                      ssa.gov has a life expectancy calculator by birth date and sex.
                    </LookupHint>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </InputCard>

      {/* Tier 3: Assumptions (the former Advanced Settings) */}
      <InputCard
        title="Assumptions"
        icon={SlidersHorizontal}
        headerClassName={CARD_HEADER_CLASS}
        contentClassName={CARD_CONTENT_CLASS}
        actions={
          <SectionToggle
            expanded={assumptionsOpen}
            onToggle={toggleAdvanced}
            controls={assumptionsId}
            expandLabel="Show"
            collapseLabel="Hide"
            sectionName="assumptions"
          />
        }
      >
        <div id={assumptionsId}>
          {!assumptionsOpen ? (
            <p className="text-sm text-muted-foreground">{buildAssumptionsSummary(inputs)}</p>
          ) : (
            <div className="space-y-6">
              <SingleColumnFields>
                <RiskProfileSelector
                  value={inputs.riskProfile}
                  currentAge={inputs.startingAge}
                  onChange={(riskProfile) => handleInputChange('riskProfile', riskProfile)}
                  onReturnRatesChange={(accumulationReturn, retirementReturn, volatility) => {
                    handleInputChange('accumulationReturn', accumulationReturn);
                    handleInputChange('retirementReturn', retirementReturn);
                    handleInputChange('volatility', volatility);
                  }}
                />
              </SingleColumnFields>

              <TwoColumnFields>
                <PercentInput
                  name="accumulationReturn"
                  label="Accumulation Return"
                  value={inputs.accumulationReturn}
                  onChange={(value) => handleInputChange('accumulationReturn', value)}
                  min={0}
                  max={0.25}
                  step={0.001}
                  precision={2}
                  showSlider
                  help="Nominal (before inflation) annual return while saving — the today's-dollars view handles inflation"
                  error={errors.accumulationReturn}
                />

                <PercentInput
                  name="retirementReturn"
                  label="Retirement Return"
                  value={inputs.retirementReturn}
                  onChange={(value) => handleInputChange('retirementReturn', value)}
                  min={0}
                  max={0.25}
                  step={0.001}
                  precision={2}
                  showSlider
                  help="Nominal (before inflation) annual return after retiring"
                  error={errors.retirementReturn}
                />
              </TwoColumnFields>

              <TwoColumnFields>
                <PercentInput
                  name="inflationRate"
                  label="Inflation Rate"
                  value={inputs.inflationRate}
                  onChange={(value) => handleInputChange('inflationRate', value)}
                  min={0.01}
                  max={0.05}
                  step={0.001}
                  precision={2}
                  showSlider
                  help="Grows spending in the simulation and sets the today's-dollars conversion"
                  error={errors.inflationRate}
                />

                <PercentInput
                  name="volatility"
                  label="Portfolio Volatility"
                  value={inputs.volatility}
                  onChange={(value) => handleInputChange('volatility', value)}
                  min={0.05}
                  max={0.25}
                  step={0.005}
                  precision={2}
                  showSlider
                  help="Annual standard deviation of returns in the Monte Carlo draws"
                  error={errors.volatility}
                />
              </TwoColumnFields>

              <TwoColumnFields>
                <PercentInput
                  name="effectiveTaxRate"
                  label="Effective Tax Rate"
                  value={inputs.effectiveTaxRate ?? 0.15}
                  onChange={(value) => handleInputChange('effectiveTaxRate', value)}
                  min={0}
                  max={0.40}
                  step={0.01}
                  precision={2}
                  showSlider
                  error={errors.effectiveTaxRate}
                />

                <div className="space-y-2">
                  <span className="text-sm font-medium">Healthcare Cost Multiplier</span>
                  <div className="px-3">
                    <Slider
                      aria-label="Healthcare Cost Multiplier"
                      value={[inputs.healthcareCostMultiplier]}
                      onValueChange={(value: number[]) => handleInputChange('healthcareCostMultiplier', value[0])}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-center text-sm text-muted-foreground mt-1">
                      {inputs.healthcareCostMultiplier}x average cost
                    </div>
                  </div>
                  {errors.healthcareCostMultiplier && (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.healthcareCostMultiplier}
                    </p>
                  )}
                </div>
              </TwoColumnFields>
            </div>
          )}
        </div>
      </InputCard>
    </div>
  );
}

export default InputSection;
