'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { Input } from '@/components/ui/input';
import {
  DollarSign, 
  MapPin, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  Building,
  User
} from 'lucide-react';
import { Tooltip, HELP_TOOLTIPS } from '@/components/shared/Tooltip';
import { DebtInput } from '@/components/shared/inputs/DebtInput';

export function StreamlinedInputSection() {
  const {
    profile,
    updateIncome,
    updateTaxes,
    updateBenefits,
    updatePreferences,
    addDebt,
    updateDebt,
    removeDebt,
    showAdvanced,
    setShowAdvanced,
  } = useCalculatorStore();
  
  return (
    <div className="space-y-6">
      {/* Essential Inputs - Front Loaded */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <span>Monthly Financial Snapshot</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Income Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MoneyInput
              name="grossIncome"
              label="Gross Monthly Income"
              value={profile.income.gross}
              onChange={(value) => updateIncome({ gross: value })}
              placeholder="$6,000"
              required
            />
            
            <MoneyInput
              name="netIncome"
              label="Net Take-Home Pay"
              value={profile.income.net}
              onChange={(value) => updateIncome({ net: value })}
              placeholder="$4,200"
              required
            />
          </div>
          
          {/* Necessary Expenses */}
          <MoneyInput
            name="necessaryExpenses"
            label="Necessary Monthly Expenses"
            value={profile.preferences.necessaryExpenses}
            onChange={(value) => updatePreferences({ necessaryExpenses: value })}
            placeholder="$2,500"
            help="Rent, utilities, groceries, minimum debt payments, insurance, etc."
            required
          />

          {/* Emergency Fund Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MoneyInput
              name="currentEmergencyFund"
              label="Current Emergency Fund"
              value={profile.preferences.currentEmergencyFund}
              onChange={(value) => updatePreferences({ currentEmergencyFund: value })}
              placeholder="$5,000"
              help="Current balance in savings/emergency accounts"
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Months</label>
              <Input
                type="number"
                min="0"
                max="12"
                placeholder="6"
                value={profile.preferences.emergencyFundMonths || ''}
                onChange={(e) => updatePreferences({ 
                  emergencyFundMonths: Number(e.target.value) || 0
                })}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Months of expenses to save (typically 3-6)
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Emergency Fund APY (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="4.0"
                value={profile.preferences.emergencyFundAPY * 100}
                onChange={(e) => updatePreferences({ 
                  emergencyFundAPY: Number(e.target.value) / 100 
                })}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                High-yield savings accounts currently offer 3.5-4.5% APY
              </p>
            </div>
          </div>
          
          {/* Extra Money Range */}
          <div className="space-y-4">
            <label className="text-sm font-medium block">Extra Money You Want Available</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                name="funMoneyMin"
                label="Minimum"
                value={profile.preferences.funMoney.min}
                onChange={(value) => updatePreferences({
                  funMoney: { ...profile.preferences.funMoney, min: value }
                })}
                placeholder="$300"
              />
              <MoneyInput
                name="funMoneyMax"
                label="Maximum"
                value={profile.preferences.funMoney.max}
                onChange={(value) => updatePreferences({
                  funMoney: { ...profile.preferences.funMoney, max: value }
                })}
                placeholder="$600"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Range for dining out, entertainment, shopping, and discretionary spending
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Location for Tax Calculation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Location & Tax Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <StateSelector
                value={profile.taxes.state}
                onChange={(stateCode) => updateTaxes({ state: stateCode })}
                placeholder="Type to search states..."
              />
              <p className="text-xs text-muted-foreground">
                Used for state income tax calculations in optimization
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Filing Status</label>
              <select
                value={profile.taxes.filingStatus}
                onChange={(e) => updateTaxes({ filingStatus: e.target.value as 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold' })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="single">Single</option>
                <option value="marriedJoint">Married Filing Jointly</option>
                <option value="marriedSeparate">Married Filing Separately</option>
                <option value="headOfHousehold">Head of Household</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Personal Information for Optimization */}
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
                value={profile.preferences.age || ''}
                onChange={(e) => updatePreferences({ age: Number(e.target.value) })}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">Used for Roth vs Traditional optimization</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="peakEarnings"
                  checked={profile.preferences.isPeakEarnings}
                  onChange={(e) => updatePreferences({ isPeakEarnings: e.target.checked })}
                  className="w-4 h-4 text-primary"
                />
                <label htmlFor="peakEarnings" className="text-sm font-medium">
                  Peak Earning Years?
                </label>
                <Tooltip content="Are you currently in or approaching your highest earning years of your career? This affects Roth vs Traditional recommendations." />
              </div>
              <p className="text-xs text-muted-foreground">
                Check if you&apos;re in/approaching your highest earning years
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Expected Retirement Tax Bracket (optional)</label>
            <select
              value={profile.preferences.expectedRetirementBracket || ''}
              onChange={(e) => updatePreferences({ 
                expectedRetirementBracket: e.target.value ? Number(e.target.value) : undefined 
              })}
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="">Auto-detect (recommended)</option>
              <option value="0.10">10% bracket</option>
              <option value="0.12">12% bracket</option>
              <option value="0.22">22% bracket</option>
              <option value="0.24">24% bracket</option>
              <option value="0.32">32% bracket</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Leave as &quot;Auto-detect&quot; unless you have specific retirement income expectations
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Retirement Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-primary" />
            <span>Retirement Benefits</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 401k Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="has401k"
                checked={profile.benefits.employer401k.available}
                onChange={(e) => updateBenefits({
                  employer401k: { ...profile.benefits.employer401k, available: e.target.checked }
                })}
                className="w-4 h-4 text-primary"
              />
              <label htmlFor="has401k" className="font-medium">
                I have access to a 401(k)
              </label>
            </div>
            
            {profile.benefits.employer401k.available && (
              <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employer Match %</label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={profile.benefits.employer401k.matchPercent * 100}
                      onChange={(e) => updateBenefits({
                        employer401k: { 
                          ...profile.benefits.employer401k, 
                          matchPercent: Number(e.target.value) / 100 
                        }
                      })}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">e.g., 50% means 50¢ per $1 you contribute</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Match Limit (% of salary)</label>
                    <Input
                      type="number"
                      placeholder="6"
                      value={profile.benefits.employer401k.matchLimit * 100}
                      onChange={(e) => updateBenefits({
                        employer401k: { 
                          ...profile.benefits.employer401k, 
                          matchLimit: Number(e.target.value) / 100 
                        }
                      })}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Maximum % of salary they&apos;ll match</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current Contribution (% of salary this year)</label>
                  <Input
                    type="number"
                    placeholder="3"
                    value={profile.benefits.employer401k.currentContribution * 100}
                    onChange={(e) => updateBenefits({
                      employer401k: { 
                        ...profile.benefits.employer401k, 
                        currentContribution: Number(e.target.value) / 100 
                      }
                    })}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Optional: What % have you already contributed this year?</p>
                </div>
              </div>
            )}
          </div>
          
          {/* HSA Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="hasHSA"
                checked={profile.benefits.hsa.eligible}
                onChange={(e) => updateBenefits({
                  hsa: { ...profile.benefits.hsa, eligible: e.target.checked }
                })}
                className="w-4 h-4 text-primary"
              />
              <label htmlFor="hasHSA" className="font-medium">
                I have a High Deductible Health Plan (HSA eligible)
              </label>
            </div>
            
            {profile.benefits.hsa.eligible && (
              <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Coverage Type</label>
                  <select
                    value={profile.benefits.hsa.coverageType}
                    onChange={(e) => updateBenefits({
                      hsa: { ...profile.benefits.hsa, coverageType: e.target.value as 'individual' | 'family' }
                    })}
                    className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="individual">Individual ($4,150 limit)</option>
                    <option value="family">Family ($8,300 limit)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current Monthly HSA Contribution (optional)</label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={profile.benefits.hsa.currentContribution}
                    onChange={(e) => updateBenefits({
                      hsa: { ...profile.benefits.hsa, currentContribution: Number(e.target.value) }
                    })}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">What you&apos;re already contributing per month this year</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Debts Section */}
      <DebtInput
        debts={profile.debts}
        onAddDebt={addDebt}
        onUpdateDebt={updateDebt}
        onRemoveDebt={removeDebt}
      />
      
      {/* Advanced Settings Toggle */}
      <Card>
        <CardContent className="p-4">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Options</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Advanced Settings */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Risk Tolerance</label>
                <Tooltip content={HELP_TOOLTIPS.riskTolerance} />
              </div>
              <select
                value={profile.preferences.riskTolerance}
                onChange={(e) => updatePreferences({ 
                  riskTolerance: e.target.value as 'conservative' | 'moderate' | 'optimizer'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="conservative">Conservative - Follow traditional advice, prioritize safety</option>
                <option value="moderate">Moderate - Balance between safety and optimization</option>
                <option value="optimizer">Optimizer - Maximum mathematical efficiency, reject financial myths</option>
              </select>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Optimization Goal</label>
                <Tooltip content={HELP_TOOLTIPS.optimizationGoal} />
              </div>
              <select
                value={profile.preferences.optimizationGoal}
                onChange={(e) => updatePreferences({ 
                  optimizationGoal: e.target.value as 'tax_minimization' | 'wealth_maximization' | 'balanced'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="balanced">Balanced - Optimize for both taxes and growth (recommended)</option>
                <option value="tax_minimization">Tax Minimization - Prioritize reducing current year taxes</option>
                <option value="wealth_maximization">Wealth Maximization - Prioritize long-term wealth building</option>
              </select>
            </div>
            
          </CardContent>
        </Card>
      )}
    </div>
  );
}