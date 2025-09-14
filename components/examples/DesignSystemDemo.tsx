/**
 * Design System Demo
 * Demonstrates the BufoIndex design system with PaycheckAllocator styling and RetirementCalculator accent
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { User, DollarSign, MapPin, Calculator, TrendingUp, Loader2 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { AllocationResult } from '@/lib/types';

interface DemoInputs {
  income: number;
  savings: number;
  taxRate: number;
  age: number;
  state: string;
}

export function DesignSystemDemo() {
  const [inputs, setInputs] = React.useState<DemoInputs>({
    income: 75000,
    savings: 15000,
    taxRate: 0.22,
    age: 30,
    state: 'CA'
  });
  
  const [results, setResults] = React.useState<AllocationResult | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);
  
  const updateInput = <K extends keyof DemoInputs>(field: K, value: DemoInputs[K]) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCalculate = async () => {
    setIsCalculating(true);
    
    // Simulate calculation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterTaxIncome = inputs.income * (1 - inputs.taxRate);
    const monthlySavings = inputs.savings / 12;
    
    setResults({
      allocations: [
        {
          id: 'emergency_fund',
          account: 'Emergency Fund',
          amount: monthlySavings * 0.3,
          percentage: 30,
          priority: 1,
          reasoning: 'Build emergency fund first',
          taxImpact: 0,
          category: 'emergency_fund',
          implementation: 'Open high-yield savings account'
        },
        {
          id: 'retirement',
          account: '401(k)',
          amount: monthlySavings * 0.7,
          percentage: 70,
          priority: 2,
          reasoning: 'Tax-advantaged retirement savings',
          taxImpact: -50,
          category: 'tax_advantaged',
          implementation: 'Increase payroll deduction'
        }
      ],
      skippedItems: [],
      projections: {
        currentPath: {
          tenYear: inputs.savings * Math.pow(1.07, 10),
          taxesOwed: afterTaxIncome * 0.15,
          fiAge: 65
        },
        optimizedPath: {
          tenYear: inputs.savings * Math.pow(1.08, 10),
          taxesOwed: afterTaxIncome * 0.12,
          fiAge: 62
        },
        improvement: {
          tenYear: inputs.savings * Math.pow(1.08, 10) - inputs.savings * Math.pow(1.07, 10),
          annualTaxSavings: afterTaxIncome * 0.03,
          fiYearsEarlier: 3
        }
      },
      optimizationScore: {
        overall: 85,
        breakdown: {
          taxEfficiency: 90,
          employerBenefits: 80,
          debtStrategy: 85,
          emergencyFundSize: 90,
          accountPrioritization: 85
        },
        comparison: 65
      },
      funMoneyAllocated: 500,
      funMoneyRange: {
        min: 300,
        max: 800,
        difference: 500
      },
      remainingAmount: 100
    });
    
    setIsCalculating(false);
  };

  return (
    <div className="calculator-container">
      <div className="max-w-7xl mx-auto p-6">
        {/* Progress Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Design System Demo Calculator
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Demonstrating the BufoIndex design system with PaycheckAllocator styling, 
            RetirementCalculator accent colors, and unified component patterns.
          </p>
        </div>
        
        {/* Main Calculator Grid */}
        <div className={cn(
          "grid gap-6 transition-all duration-500",
          results ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-3",
          "max-w-7xl"
        )}>
          {/* Input Section */}
          <div className={cn(
            "space-y-6",
            results ? "lg:col-span-1" : "lg:col-span-2"
          )}>
            {/* Personal Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-primary" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Age</label>
                    <Input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="30"
                      value={inputs.age || ''}
                      onChange={(e) => updateInput('age', Number(e.target.value))}
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500">Used for retirement projections</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <StateSelector
                      value={inputs.state}
                      onChange={(value: string) => updateInput('state', value)}
                      placeholder="Type to search states..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Financial Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span>Financial Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MoneyInput
                    name="income"
                    label="Annual Income"
                    value={inputs.income}
                    onChange={(value: number) => updateInput('income', value)}
                    placeholder="$75,000"
                    help="Your gross annual income before taxes"
                    required
                  />
                  
                  <MoneyInput
                    name="savings"
                    label="Annual Savings"
                    value={inputs.savings}
                    onChange={(value: number) => updateInput('savings', value)}
                    placeholder="$15,000"
                    help="Amount you save per year"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Marginal Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    placeholder="22"
                    value={inputs.taxRate * 100}
                    onChange={(e) => updateInput('taxRate', Number(e.target.value) / 100)}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500">Your marginal federal + state tax rate</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Calculate Button */}
            <Card>
              <CardContent className="p-6">
                <Button
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  size="lg"
                  className="w-full text-lg py-4"
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing Your Profile...
                    </>
                  ) : (
                    <>
                      <Calculator className="mr-2 h-5 w-5" />
                      Calculate Projections
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          {/* Results Section */}
          {results && (
            <div className="lg:col-span-1 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">
                            {((results.allocations.reduce((sum, alloc) => sum + alloc.amount, 0) / (inputs.income * (1 - inputs.taxRate) / 12)) * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-green-700">Savings Rate</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600">
                            {formatCurrency(inputs.income * (1 - inputs.taxRate) / 12)}
                          </div>
                          <div className="text-sm text-blue-700">Monthly After Tax</div>
                          <div className="text-xs text-blue-600">
                            {formatCurrency(results.allocations.reduce((sum, alloc) => sum + alloc.amount, 0))} saved/month
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Main Results Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-primary">
                    <TrendingUp className="w-5 h-5" />
                    <span>Projected Wealth</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(results.projections.optimizedPath.tenYear)}
                    </div>
                    <div className="text-sm text-primary/80">At Age 65</div>
                  </div>
                  
                  <div className="p-3 bg-background rounded-md border border-primary/20">
                    <div className="text-sm font-medium text-primary">
                      Recommendation:
                    </div>
                    <div className="text-sm text-primary/80 mt-1">
                      {results.optimizationScore.overall > 80 ? 'Excellent optimization!' : 'Consider increasing your savings rate'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Placeholder when no results */}
          {!results && !isCalculating && (
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Calculator className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Ready to Calculate?
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Fill in your information on the left, then click &quot;Calculate&quot; 
                    to see your personalized projections.
                  </p>
                  <div className="text-sm text-gray-500 space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Savings rate analysis</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Tax-adjusted calculations</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Wealth projections</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* Educational Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 max-w-4xl mx-auto">
            <strong>Disclaimer:</strong> This demo shows design system capabilities only. 
            Results are for demonstration purposes and not actual financial advice. 
            The styling demonstrates the unified BufoIndex design system.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Design System Demo Features
 * - PaycheckAllocator layout and structure
 * - PaycheckAllocator colors, fonts, and spacing
 * - PaycheckAllocator input field shapes (especially MoneyInput with $ prefix)
 * - RetirementCalculator accent color (sage-600)
 * - Unified card-based component approach
 */