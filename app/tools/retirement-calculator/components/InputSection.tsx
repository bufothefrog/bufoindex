'use client';

import React from 'react';
import { useRetirementStore, useRetirementInputs } from '@/lib/store/retirementStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { NumberInput } from '@/components/shared/inputs/NumberInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { PrimarySecondaryRow, EqualRow } from '@/components/shared/layout/InputRow';
import { TwoColumnFields, SingleColumnFields, ThreeColumnFields } from '@/components/shared/layout/FieldGroup';
import { PercentageInput } from '@/components/calculators/shared/PercentageInput';
import { RiskProfileSelector } from '@/components/retirement/RiskProfileSelector';
import { formatPercent, formatCurrency } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { 
  User, 
  Settings, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';


export function InputSection() {
  const inputs = useRetirementInputs();
  const { updateInputs, showAdvanced, toggleAdvanced } = useRetirementStore();
  
  // TDF calculations are now handled in the retirement calculation itself
  
  const handleInputChange = (field: string, value: number | string) => {
    updateInputs({
      [field]: typeof value === 'string' ? value : Number(value)
    });
  };

  const savingsRate = (inputs.monthlySavings * 12) / inputs.currentIncome;
  const showAnnualizedHelp = inputs.incomePeriod !== 'yearly';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="w-5 h-5 mr-2" />
          Retirement Planning Inputs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Current Income (amount + period) | Current Age */}
        <PrimarySecondaryRow
          primary={
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Current Income</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <MoneyInput
                    name="incomeAmount"
                    label=""
                    value={inputs.incomeAmount}
                    onChange={(value) => handleInputChange('incomeAmount', value)}
                    placeholder="100,000"
                  />
                </div>
                <div className="w-[140px]">
                  <SelectInput
                    name="incomePeriod"
                    label=""
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
          }
          secondary={
            <NumberInput
              name="startingAge"
              label="Current Age"
              value={inputs.startingAge}
              onChange={(value) => handleInputChange('startingAge', value)}
              min={0}
              max={100}
              help="Your current age"
            />
          }
        />

        {/* Row 2: Target Annual Income | Target Retirement Age */}
        <PrimarySecondaryRow
          primary={
            <MoneyInput
              name="targetIncome"
              label="Target Annual Income in Retirement"
              value={inputs.targetIncome}
              onChange={(value) => handleInputChange('targetIncome', value)}
              placeholder="80,000"
              help={`That's $${Math.round(inputs.targetIncome * Math.pow(1 + inputs.inflationRate, inputs.retirementAge - inputs.startingAge)).toLocaleString()} in future dollars`}
            />
          }
          secondary={
            <NumberInput
              name="retirementAge"
              label="Target Retirement Age"
              value={inputs.retirementAge}
              onChange={(value) => handleInputChange('retirementAge', value)}
              min={0}
              max={100}
              help="When you want to retire"
            />
          }
        />

        {/* Row 3: Current Investment Balance | Monthly Savings Amount */}
        <EqualRow
          left={
            <MoneyInput
              name="startingBalance"
              label="Current Investment Balance"
              value={inputs.startingBalance}
              onChange={(value) => handleInputChange('startingBalance', value)}
              placeholder="10,000"
            />
          }
          right={
            <MoneyInput
              name="monthlySavings"
              label="Monthly Savings Amount"
              value={inputs.monthlySavings}
              onChange={(value) => handleInputChange('monthlySavings', value)}
              placeholder="2,000"
              help={`${formatPercent(savingsRate)} savings rate`}
            />
          }
        />

        {/* Row 4: State | Filing Status */}
        <EqualRow
          left={
            <StateSelector
              name="state"
              label="State"
              value={inputs.state}
              onChange={(value) => handleInputChange('state', value)}
              placeholder="Select your state..."
              help="For state tax calculations"
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
            />
          }
        />

        {/* Advanced Settings Toggle */}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={toggleAdvanced}
            className="w-full justify-between"
          >
            <div className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Advanced Settings
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 border-t pt-4">
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

            <SingleColumnFields>
              <MoneyInput
                name="necessaryMonthlyExpenses"
                label="Necessary Monthly Expenses"
                value={inputs.necessaryMonthlyExpenses}
                onChange={(value) => handleInputChange('necessaryMonthlyExpenses', value)}
                placeholder="4,000"
                help="Essential monthly expenses"
              />
            </SingleColumnFields>

            <TwoColumnFields>
              <PercentageInput
                label="Accumulation Return"
                value={inputs.accumulationReturn}
                onChange={(value) => handleInputChange('accumulationReturn', value)}
                min={0}
                max={0.25}
                step={0.001}
                displayMode="both"
              />

              <PercentageInput
                label="Retirement Return"
                value={inputs.retirementReturn}
                onChange={(value) => handleInputChange('retirementReturn', value)}
                min={0}
                max={0.25}
                step={0.001}
                displayMode="both"
              />
            </TwoColumnFields>

            <TwoColumnFields>
              <PercentageInput
                label="Inflation Rate"
                value={inputs.inflationRate}
                onChange={(value) => handleInputChange('inflationRate', value)}
                min={0.01}
                max={0.05}
                step={0.001}
                displayMode="both"
              />

              <PercentageInput
                label="Portfolio Volatility"
                value={inputs.volatility}
                onChange={(value) => handleInputChange('volatility', value)}
                min={0.05}
                max={0.25}
                step={0.005}
                displayMode="both"
              />
            </TwoColumnFields>

            <ThreeColumnFields>
              <NumberInput
                name="socialSecurityAge"
                label="Social Security Age"
                value={inputs.socialSecurityAge}
                onChange={(value) => handleInputChange('socialSecurityAge', value)}
                min={0}
                max={100}
                help="When to claim benefits"
              />

              <NumberInput
                name="lifeExpectancy"
                label="Life Expectancy"
                value={inputs.lifeExpectancy}
                onChange={(value) => handleInputChange('lifeExpectancy', value)}
                min={0}
                max={100}
                suffix="years"
                help="Age you expect to live to"
              />

              <MoneyInput
                name="socialSecurityBenefit"
                label="Social Security Benefit"
                value={inputs.socialSecurityBenefit}
                onChange={(value) => handleInputChange('socialSecurityBenefit', value)}
                placeholder="30,000"
                help="Annual benefit estimate"
              />
            </ThreeColumnFields>

            <div className="space-y-2">
              <label className="text-sm font-medium">Healthcare Cost Multiplier</label>
              <div className="px-3">
                <Slider
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
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}