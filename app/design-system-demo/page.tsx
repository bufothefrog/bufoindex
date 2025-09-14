'use client';

import React from 'react';
import { 
  AdvancedCalculatorLayout, 
  SimpleCalculatorLayout, 
  ComparisonCalculatorLayout 
} from '@/components/ui/layouts/CalculatorLayout';
import { InputCard, ResultCard, SummaryCard } from '@/components/ui/cards/BaseCard';
import { EnhancedMoneyInput, PercentInput, NumberInput } from '@/components/ui/inputs';
import { DollarSign, Settings, Target } from 'lucide-react';

export default function DesignSystemDemo() {
  const [activeDemo, setActiveDemo] = React.useState<'simple' | 'advanced' | 'comparison'>('simple');
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [demoInputs, setDemoInputs] = React.useState({
    income: 5000,
    expenses: 3000,
    savingsRate: 20,
    age: 30
  });

  const handleCalculate = async () => {
    setIsCalculating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setShowResults(true);
    setIsCalculating(false);
  };

  const renderInputSections = () => (
    <div className="space-y-6">
      <InputCard 
        title="Income & Expenses" 
        icon={DollarSign}
        required={true}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <EnhancedMoneyInput
            name="income"
            label="Monthly Income"
            value={demoInputs.income}
            onChange={(value) => setDemoInputs(prev => ({ ...prev, income: value }))}
            required
            help="Your gross monthly income before taxes"
          />
          <EnhancedMoneyInput
            name="expenses"
            label="Monthly Expenses"
            value={demoInputs.expenses}
            onChange={(value) => setDemoInputs(prev => ({ ...prev, expenses: value }))}
            required
            help="Essential monthly expenses"
          />
        </div>
      </InputCard>

      <InputCard 
        title="Savings & Goals" 
        icon={Target}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <PercentInput
            name="savingsRate"
            label="Target Savings Rate"
            value={demoInputs.savingsRate}
            onChange={(value) => setDemoInputs(prev => ({ ...prev, savingsRate: value }))}
            help="Percentage of income to save"
          />
          <NumberInput
            name="age"
            label="Current Age"
            value={demoInputs.age}
            onChange={(value) => setDemoInputs(prev => ({ ...prev, age: value }))}
            min={18}
            max={100}
          />
        </div>
      </InputCard>

      {activeDemo === 'advanced' && (
        <InputCard 
          title="Advanced Options" 
          icon={Settings}
          collapsible={true}
        >
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              This card demonstrates advanced features like collapsible sections and complex form layouts.
            </div>
          </div>
        </InputCard>
      )}
    </div>
  );

  const renderResultsSection = () => showResults ? (
    <div className="space-y-6">
      <SummaryCard
        title="Monthly Surplus"
        value={`$${demoInputs.income - demoInputs.expenses}`}
        label="Available for savings"
        change={{ value: "+12%", direction: "up" }}
      />
      
      <ResultCard 
        title="Optimization Results" 
        status="success"
        highlight={true}
      >
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Recommended Allocation:</span>
            <span className="font-semibold">${Math.round((demoInputs.income - demoInputs.expenses) * 0.8)}</span>
          </div>
          <div className="flex justify-between">
            <span>Emergency Buffer:</span>
            <span className="font-semibold">${Math.round((demoInputs.income - demoInputs.expenses) * 0.2)}</span>
          </div>
        </div>
      </ResultCard>

      <ResultCard title="Key Insights">
        <ul className="text-sm space-y-2">
          <li>• Your savings rate of {demoInputs.savingsRate}% is {demoInputs.savingsRate > 20 ? 'excellent' : 'below optimal'}</li>
          <li>• Consider increasing tax-advantaged account contributions</li>
          <li>• Monthly surplus allows for aggressive wealth building</li>
        </ul>
      </ResultCard>
    </div>
  ) : null;

  const getLayoutComponent = () => {
    switch (activeDemo) {
      case 'simple':
        return SimpleCalculatorLayout;
      case 'advanced':
        return AdvancedCalculatorLayout;
      case 'comparison':
        return ComparisonCalculatorLayout;
      default:
        return SimpleCalculatorLayout;
    }
  };

  const LayoutComponent = getLayoutComponent();

  return (
    <div className="space-y-8">
      {/* Demo Controls */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Design System Demo</h1>
          <p className="text-gray-600 mb-6">
            Test the new calculator layout system with different configurations
          </p>
          
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => { setActiveDemo('simple'); setShowResults(false); }}
              className={`px-4 py-2 rounded-md ${
                activeDemo === 'simple' 
                  ? 'bg-sage-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Simple Layout
            </button>
            <button
              onClick={() => { setActiveDemo('advanced'); setShowResults(false); }}
              className={`px-4 py-2 rounded-md ${
                activeDemo === 'advanced' 
                  ? 'bg-sage-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Advanced Layout
            </button>
            <button
              onClick={() => { setActiveDemo('comparison'); setShowResults(false); }}
              className={`px-4 py-2 rounded-md ${
                activeDemo === 'comparison' 
                  ? 'bg-sage-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Comparison Layout
            </button>
          </div>

          <div className="text-sm text-gray-500">
            <p><strong>Simple:</strong> Basic calculator with minimal features</p>
            <p><strong>Advanced:</strong> Complex calculator with optimization features</p>
            <p><strong>Comparison:</strong> Multiple scenario comparison tool</p>
          </div>
        </div>
      </div>

      {/* Layout Demo */}
      <LayoutComponent
        title={`${activeDemo.charAt(0).toUpperCase() + activeDemo.slice(1)} Calculator Demo`}
        description={`Demonstrating the ${activeDemo} calculator layout with design system components`}
        inputSections={renderInputSections()}
        resultSection={renderResultsSection()}
        isCalculating={isCalculating}
        onCalculate={handleCalculate}
        calculateButtonText="Calculate Demo"
        calculatingText="Running Demo Calculation..."
        disclaimer="This is a design system demonstration. Values shown are for testing purposes only."
      />

      {/* Component Showcase */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Component Showcase</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Components */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Input Components</h3>
            
            <InputCard title="Money Input Demo" icon={DollarSign}>
              <EnhancedMoneyInput
                name="demo-money"
                label="Amount"
                value={1500}
                onChange={() => {}}
                help="This is the enhanced money input with formatting"
              />
            </InputCard>

            <InputCard title="Input Variants" icon={Settings}>
              <div className="space-y-4">
                <PercentInput
                  name="demo-percent"
                  label="Percentage"
                  value={25}
                  onChange={() => {}}
                />
                <NumberInput
                  name="demo-number"
                  label="Age"
                  value={35}
                  onChange={() => {}}
                  min={18}
                  max={100}
                />
              </div>
            </InputCard>
          </div>

          {/* Result Components */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold">Result Components</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard
                title="Total Savings"
                value="$2,500"
                label="This month"
                change={{ value: "+8%", direction: "up" }}
              />
              <SummaryCard
                title="Efficiency"
                value="94%"
                label="Tax optimization"
                change={{ value: "optimal", direction: "neutral" }}
              />
            </div>

            <ResultCard title="Success Result" status="success" highlight={true}>
              <p>This demonstrates a successful calculation result with highlighted styling.</p>
            </ResultCard>

            <ResultCard title="Warning Result" status="warning">
              <p>This shows a warning state result card for attention-needed situations.</p>
            </ResultCard>
          </div>
        </div>
      </div>
    </div>
  );
}