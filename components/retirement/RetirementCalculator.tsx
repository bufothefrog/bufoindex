'use client';

import React from 'react';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { TrendingUp, DollarSign, User } from 'lucide-react';
import { RetirementInputs, RetirementResults as RetirementResultsType, calculateRetirementAnalysis } from '@/lib/calculations/retirement';
import { RetirementConstants } from '@/lib/constants/retirement';
import { updateRetirementUrlHash, loadRetirementFromUrl } from '@/lib/utils/retirementState';
import { ComparisonCalculatorLayout } from '@/components/ui/layouts/CalculatorLayout';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { NumberInput } from '@/components/shared/inputs/NumberInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { TwoColumnFields, SingleColumnFields } from '@/components/shared/layout/FieldGroup';
import { PrimarySecondaryRow, EqualRow } from '@/components/shared/layout/InputRow';
import { RiskProfileSelector } from './RiskProfileSelector';
import { RetirementResults } from './RetirementResults';

export function RetirementCalculator() {
  const [inputs, setInputs] = React.useState<RetirementInputs>({
    startingAge: 25,
    retirementAge: 60,
    lifeExpectancy: 85, // NEW: User-defined life expectancy
    targetIncome: 80000,
    startingBalance: 10000,
    currentIncome: 100000,
    incomeAmount: 100000,
    incomePeriod: 'yearly',
    monthlySavings: 2000,
    necessaryMonthlyExpenses: 4000,
    accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
    retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
    inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
    socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
    socialSecurityBenefit: 30000,
    healthcareCostMultiplier: 1,
    volatility: RetirementConstants.DEFAULT_VOLATILITY,
    filingStatus: 'single',
    state: 'TX', // NEW: Default to Texas (no state income tax)
    riskProfile: 'tdf', // NEW: Default risk profile
    effectiveTaxRate: null, // null = auto-calculate from income/filing
    estimatedAnnualHealthcareCost: null, // null = use default model
  });

  const [results, setResults] = React.useState<RetirementResultsType | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  // Load from URL on component mount
  React.useEffect(() => {
    const urlData = loadRetirementFromUrl();
    if (urlData) {
      setInputs(urlData);
    }
  }, []);

  // Update URL when inputs change (debounced)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateRetirementUrlHash(inputs);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [inputs]);

  const handleInputChange = (field: keyof RetirementInputs, value: number | string) => {
    setInputs(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? value : Number(value)
    }));
  };

  const handleRiskProfileChange = (riskProfile: 'tdf' | 'custom') => {
    setInputs(prev => ({
      ...prev,
      riskProfile
    }));
  };

  const handleReturnRatesChange = (accumulationReturn: number, retirementReturn: number, volatility: number) => {
    setInputs(prev => ({
      ...prev,
      accumulationReturn,
      retirementReturn,
      volatility
    }));
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BufoIndex Retirement Calculator',
          text: 'Check out my retirement planning scenario',
          url: url
        });
      } catch {
        // Fall back to clipboard
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } else {
      // Fall back to clipboard
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    
    // Simulate calculation time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const calculationResults = calculateRetirementAnalysis(inputs);
      setResults(calculationResults);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const renderInputSections = () => (
    <div className="space-y-6">
      {/* Personal Information */}
      <InputCard 
        title="Personal Information" 
        icon={User}
        required={true}
      >
        <div className="space-y-4">
          {/* Row 1: Current Annual Income | Current Age */}
          <PrimarySecondaryRow
            primary={
              <MoneyInput
                name="currentIncome"
                label="Current Annual Income"
                value={inputs.currentIncome}
                onChange={(value) => handleInputChange('currentIncome', value)}
                placeholder="100,000"
              />
            }
            secondary={
              <NumberInput
                name="startingAge"
                label="Current Age"
                value={inputs.startingAge}
                onChange={(value) => handleInputChange('startingAge', value)}
                min={RetirementConstants.MIN_STARTING_AGE}
                max={65}
                help="Your current age"
              />
            }
          />

          {/* Row 2: Target Retirement Income | Target Retirement Age */}
          <PrimarySecondaryRow
            primary={
              <MoneyInput
                name="targetIncome"
                label="Target Annual Retirement Income"
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
                min={RetirementConstants.MIN_RETIREMENT_AGE}
                max={RetirementConstants.MAX_RETIREMENT_AGE}
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
                help={`${((inputs.monthlySavings * 12) / inputs.currentIncome * 100).toFixed(1)}% savings rate`}
              />
            }
          />

          {/* Row 4: Life Expectancy | State */}
          <EqualRow
            left={
              <NumberInput
                name="lifeExpectancy"
                label="Life Expectancy"
                value={inputs.lifeExpectancy}
                onChange={(value) => handleInputChange('lifeExpectancy', value)}
                min={65}
                max={110}
                suffix="years"
                help="Age you expect to live to"
              />
            }
            right={
              <StateSelector
                name="state"
                label="State"
                value={inputs.state}
                onChange={(value) => handleInputChange('state', value)}
                placeholder="Select your state..."
                help="For state tax calculations"
              />
            }
          />

          {/* Row 5: Risk Profile (full width) */}
          <SingleColumnFields>
            <RiskProfileSelector
              value={inputs.riskProfile}
              onChange={handleRiskProfileChange}
              onReturnRatesChange={handleReturnRatesChange}
            />
          </SingleColumnFields>
        </div>
      </InputCard>

      {/* Additional Details */}
      <InputCard 
        title="Additional Details" 
        icon={DollarSign}
      >
        <TwoColumnFields>
          <MoneyInput
            name="necessaryMonthlyExpenses"
            label="Necessary Monthly Expenses"
            value={inputs.necessaryMonthlyExpenses}
            onChange={(value) => handleInputChange('necessaryMonthlyExpenses', value)}
            placeholder="4,000"
            help="Essential monthly expenses"
          />

          <MoneyInput
            name="socialSecurityBenefit"
            label="Annual Social Security Benefit"
            value={inputs.socialSecurityBenefit}
            onChange={(value) => handleInputChange('socialSecurityBenefit', value)}
            placeholder="30,000"
            help="Annual benefit estimate"
          />
        </TwoColumnFields>
      </InputCard>

      {/* Return Rate Settings */}
      <InputCard 
        title="Return Rate Settings" 
        icon={TrendingUp}
        className={inputs.riskProfile === 'custom' ? '' : 'opacity-60'}
      >
        <TwoColumnFields>
          <NumberInput
            name="accumulationReturn"
            label="Expected Return (Accumulation)"
            value={inputs.accumulationReturn}
            onChange={(value) => handleInputChange('accumulationReturn', value)}
            step={0.001}
            min={0}
            max={0.25}
            suffix="%"
            help={`${(inputs.accumulationReturn * 100).toFixed(1)}% annual return while working`}
          />
          
          <NumberInput
            name="retirementReturn"
            label="Expected Return (Retirement)"
            value={inputs.retirementReturn}
            onChange={(value) => handleInputChange('retirementReturn', value)}
            step={0.001}
            min={0}
            max={0.25}
            suffix="%"
            help={`${(inputs.retirementReturn * 100).toFixed(1)}% annual return in retirement`}
          />
        </TwoColumnFields>
      </InputCard>

      {/* Advanced Settings */}
      <InputCard 
        title="Advanced Settings" 
        icon={TrendingUp}
      >
        <TwoColumnFields>
          <NumberInput
            name="inflationRate"
            label="Inflation Rate"
            value={inputs.inflationRate}
            onChange={(value) => handleInputChange('inflationRate', value)}
            step={0.001}
            min={0}
            max={0.10}
            suffix="%"
            help={`${(inputs.inflationRate * 100).toFixed(1)}% annual inflation`}
          />
          
          <NumberInput
            name="volatility"
            label="Market Volatility"
            value={inputs.volatility}
            onChange={(value) => handleInputChange('volatility', value)}
            step={0.01}
            min={0}
            max={0.50}
            suffix="%"
            help={`${(inputs.volatility * 100).toFixed(1)}% volatility (standard deviation)`}
          />
        </TwoColumnFields>
      </InputCard>
    </div>
  );

  const renderResultsSection = () => results ? (
    <RetirementResults 
      inputs={inputs}
      results={results}
      onShare={handleShare}
    />
  ) : null;

  return (
    <ComparisonCalculatorLayout
      title="Retirement Planning Calculator"
      description="Model multiple retirement scenarios with Monte Carlo analysis. Compare different retirement ages and see probability of success."
      inputSections={renderInputSections()}
      resultSection={renderResultsSection()}
      isCalculating={isCalculating}
      onCalculate={handleCalculate}
      calculateButtonText="Calculate Retirement Plan"
      calculatingText="Running Monte Carlo Analysis..."
      disclaimer="This calculator provides educational estimates only and should not be considered personalized financial advice. Actual investment returns may vary significantly from projections. Consider consulting with a qualified financial advisor for comprehensive retirement planning."
    />
  );
}