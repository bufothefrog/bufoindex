import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaycheckProfile, AllocationResult } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { monthlyToPaycheck } from '@/lib/calculations/core';
import { 
  Building2, 
  Copy, 
  CheckCircle, 
  Info,
  Zap,
  Settings,
  Target
} from 'lucide-react';

interface PayrollSetupGuideProps {
  profile: PaycheckProfile;
  result: AllocationResult;
}

type AutomationTier = 'basic' | 'intermediate' | 'advanced';

export function PayrollSetupGuide({ profile, result }: PayrollSetupGuideProps) {
  const [selectedTier, setSelectedTier] = useState<AutomationTier>('intermediate');
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  
  // Calculate per-paycheck amounts
  const paycheckAmount = profile.income.netPaycheck;
  const frequency = profile.income.frequency;
  
  // Calculate priority allocations per paycheck
  const expensesAndFunMoney = monthlyToPaycheck(
    profile.preferences.necessaryExpenses + result.funMoneyAllocated,
    frequency
  );
  
  const priorityAllocations = result.allocations.map(allocation => ({
    ...allocation,
    paycheckAmount: monthlyToPaycheck(allocation.amount, frequency)
  }));
  
  const remainingPerPaycheck = monthlyToPaycheck(result.remainingAmount, frequency);
  
  const getFrequencyText = () => {
    switch (frequency) {
      case 'weekly': return 'Weekly';
      case 'bi-weekly': return 'Bi-Weekly';
      case 'semi-monthly': return 'Semi-Monthly';
      case 'monthly': return 'Monthly';
    }
  };
  
  const getInstructions = () => {
    const instructions = {
      basic: {
        title: 'Basic Setup (Manual Transfers)',
        description: 'Everything goes to checking account, you handle transfers manually',
        setup: [
          `Direct deposit: 100% to checking account`,
          `Amount per paycheck: ${formatCurrency(paycheckAmount)}`,
          '',
          'Then set up automatic transfers:',
          ...priorityAllocations.map(allocation => 
            `• ${allocation.account}: ${formatCurrency(allocation.paycheckAmount)} ${frequency}`
          ),
          ...(remainingPerPaycheck > 0 ? [`• Investment account: ${formatCurrency(remainingPerPaycheck)} ${frequency}`] : [])
        ],
        pros: ['Simple to set up', 'Works with any employer'],
        cons: ['Requires manual management', 'Delays in transfers']
      },
      intermediate: {
        title: 'Intermediate Setup (2-Account Split)',
        description: 'Split between checking and one investment account',
        setup: [
          `Account 1 - Checking: ${formatCurrency(expensesAndFunMoney)}`,
          `Account 2 - Primary Investment/Savings: ${formatCurrency(paycheckAmount - expensesAndFunMoney)}`,
          '',
          'Then manually allocate the investment portion:',
          ...priorityAllocations.map(allocation => 
            `• ${allocation.account}: ${formatCurrency(allocation.paycheckAmount)}`
          )
        ],
        pros: ['Automates savings', 'Keeps spending money separate'],
        cons: ['Still requires some manual allocation']
      },
      advanced: {
        title: 'Advanced Setup (Multi-Account Split)',
        description: 'Direct deposit splits to multiple accounts automatically',
        setup: [
          `Account 1 - Checking: ${formatCurrency(expensesAndFunMoney)}`,
          ...priorityAllocations.slice(0, 3).map(allocation => 
            `Account ${priorityAllocations.indexOf(allocation) + 2} - ${allocation.account}: ${formatCurrency(allocation.paycheckAmount)}`
          ),
          ...(remainingPerPaycheck > 0 ? [`Account ${priorityAllocations.length + 2} - Investment: ${formatCurrency(remainingPerPaycheck)}`] : []),
          '',
          'Note: Most payroll systems support 3-4 account splits maximum'
        ],
        pros: ['Fully automated', 'No manual transfers needed'],
        cons: ['Requires employer support', 'Limited account splits']
      }
    };
    
    return instructions[selectedTier];
  };
  
  const copyInstructions = async () => {
    const instructions = getInstructions();
    const text = `${instructions.title}\n\n${instructions.description}\n\n${instructions.setup.join('\n')}`;
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInstructions(true);
      setTimeout(() => setCopiedInstructions(false), 2000);
    } catch (error) {
      console.error('Failed to copy instructions:', error);
    }
  };
  
  const instructions = getInstructions();
  
  return (
    <Card className="border-green-200 dark:border-green-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span>Payroll Configuration Guide</span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Configure your {getFrequencyText().toLowerCase()} payroll to automate your optimized allocation
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paycheck Summary */}
        <div className="p-4 bg-white rounded-lg border border-green-200">
          <h4 className="font-medium text-gray-900 mb-3">Your {getFrequencyText()} Paycheck Flow</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Take-Home Pay:</span>
              <span className="font-medium">{formatCurrency(paycheckAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-green-700">
              <span>Expenses + Fun Money:</span>
              <span className="font-medium">{formatCurrency(expensesAndFunMoney)}</span>
            </div>
            <div className="flex items-center justify-between text-blue-700">
              <span>Priority Investments:</span>
              <span className="font-medium">{formatCurrency(paycheckAmount - expensesAndFunMoney)}</span>
            </div>
          </div>
        </div>
        
        {/* Automation Tier Selection */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Choose Your Automation Level</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['basic', 'intermediate', 'advanced'] as AutomationTier[]).map((tier) => {
              const icons = { basic: Settings, intermediate: Target, advanced: Zap };
              const Icon = icons[tier];
              
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedTier === tier
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className={`w-4 h-4 ${selectedTier === tier ? 'text-green-600' : 'text-gray-500'}`} />
                    <span className={`text-sm font-medium capitalize ${selectedTier === tier ? 'text-green-900' : 'text-gray-700'}`}>
                      {tier}
                    </span>
                  </div>
                  <p className={`text-xs ${selectedTier === tier ? 'text-green-700' : 'text-gray-500'}`}>
                    {tier === 'basic' && 'Manual transfers'}
                    {tier === 'intermediate' && '2-account split'}
                    {tier === 'advanced' && 'Multi-account split'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Selected Instructions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{instructions.title}</h4>
            <Button
              onClick={copyInstructions}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              {copiedInstructions ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Instructions</span>
                </>
              )}
            </Button>
          </div>
          
          <p className="text-sm text-gray-600">{instructions.description}</p>
          
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="space-y-2">
              {instructions.setup.map((line, index) => (
                <div key={index} className={`text-sm ${line === '' ? 'py-1' : 'text-gray-800'} ${line.startsWith('•') ? 'ml-4' : ''}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
          
          {/* Pros/Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-green-800">Pros:</h5>
              <ul className="space-y-1">
                {instructions.pros.map((pro, index) => (
                  <li key={index} className="text-xs text-green-700 flex items-center space-x-2">
                    <CheckCircle className="w-3 h-3" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-amber-800">Cons:</h5>
              <ul className="space-y-1">
                {instructions.cons.map((con, index) => (
                  <li key={index} className="text-xs text-amber-700 flex items-center space-x-2">
                    <Info className="w-3 h-3" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Implementation Tips */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
          <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Implementation Tips:</h5>
          <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
            <li>• Contact your HR/Payroll department with the account routing information</li>
            <li>• Changes typically take 1-2 pay periods to take effect</li>
            <li>• Keep backup transfers set up during the transition period</li>
            <li>• Review and adjust quarterly based on income or expense changes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}