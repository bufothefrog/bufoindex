'use client';

import React from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/shared/inputs/MoneyInput';
import { PercentageSlider } from '@/components/shared/inputs/PercentageSlider';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { DebtInput } from '@/components/shared/inputs/DebtInput';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { 
  DollarSign, 
  Calculator,
  Heart, 
  Settings, 
  ChevronDown, 
  ChevronUp,
  Building,
  PiggyBank
} from 'lucide-react';


export function InputSection() {
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
      {/* Income Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-sage-600" />
            <span>Paycheck Income</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MoneyInput
              name="grossPaycheck"
              label="Gross Paycheck Amount"
              value={profile.income.grossPaycheck}
              onChange={(value) => updateIncome({ grossPaycheck: value })}
              placeholder="$2,500"
              required
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Pay Frequency</label>
              <select 
                value={profile.income.frequency}
                onChange={(e) => updateIncome({ frequency: e.target.value as 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 dark:focus-visible:ring-sage-600 focus-visible:ring-offset-2 hover:border-sage-300 dark:hover:border-sage-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="semi-monthly">Semi-Monthly (2x/month)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          
          <MoneyInput
            name="netPaycheck"
            label="Take-Home Per Paycheck"
            value={profile.income.netPaycheck}
            onChange={(value) => updateIncome({ netPaycheck: value })}
            placeholder="$1,900"
            required
          />
          
          {/* Bonus Section */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={profile.income.regularBonus || false}
                onChange={(e) => updateIncome({ regularBonus: e.target.checked })}
                className="rounded"
              />
              <label className="text-sm font-medium">I receive regular bonuses</label>
            </div>
            
            {profile.income.regularBonus && (
              <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <MoneyInput
                  name="bonusAmount"
                  label="Average Bonus Amount"
                  value={profile.income.bonusAmount}
                  onChange={(value) => updateIncome({ bonusAmount: value })}
                  placeholder="$2,000"
                />
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bonus Frequency</label>
                  <select 
                    value={profile.income.bonusFrequency}
                    onChange={(e) => updateIncome({ bonusFrequency: e.target.value as 'quarterly' | 'annual' | 'irregular' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-400 dark:focus-visible:ring-sage-600 focus-visible:ring-offset-2 hover:border-sage-300 dark:hover:border-sage-600 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="irregular">Irregular</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
        </CardContent>
      </Card>
      
      {/* Essential Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-sage-600" />
            <span>Essential Expenses</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Necessary Expenses and Age */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MoneyInput
              name="necessaryExpenses"
              label="Necessary Monthly Expenses"
              value={profile.preferences.necessaryExpenses}
              onChange={(value) => updatePreferences({ necessaryExpenses: value })}
              placeholder="$2,500"
              help="Rent, utilities, groceries, minimum debt payments, insurance, etc."
              required
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Age</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={profile.preferences.age}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= 100) {
                    updatePreferences({ age: value });
                  }
                }}
                placeholder="30"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Used for catch-up contribution eligibility</p>
            </div>
          </div>

          {/* Fun Money Range */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Extra Money You Want Available</h4>
            <p className="text-sm text-muted-foreground">Range for dining out, entertainment, shopping, and discretionary spending</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyInput
                name="funMoneyMin"
                label="Minimum"
                value={profile.preferences.funMoney.min}
                onChange={(value) => updatePreferences({ 
                  funMoney: { ...profile.preferences.funMoney, min: value }
                })}
                placeholder="$500"
              />
              
              <MoneyInput
                name="funMoneyMax"
                label="Maximum"
                value={profile.preferences.funMoney.max}
                onChange={(value) => updatePreferences({ 
                  funMoney: { ...profile.preferences.funMoney, max: value }
                })}
                placeholder="$1,000"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Investment & Savings Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PiggyBank className="w-5 h-5 text-sage-600" />
            <span>Investment & Savings Accounts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Emergency Fund Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Emergency Fund</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MoneyInput
                name="currentEmergencyFund"
                label="Current Balance"
                value={profile.preferences.currentEmergencyFund}
                onChange={(value) => updatePreferences({ currentEmergencyFund: value })}
                placeholder="$10,000"
                help="Current balance in savings/emergency accounts"
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Months</label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={profile.preferences.emergencyFundMonths}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1 && value <= 24) {
                      updatePreferences({ emergencyFundMonths: value });
                    }
                  }}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Months of expenses to save (typically 3-6)</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">APY (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={profile.preferences.emergencyFundAPY * 100}
                  onChange={(e) => updatePreferences({ emergencyFundAPY: parseFloat(e.target.value) / 100 })}
                  placeholder="4.0"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">High-yield savings currently offer 3.5-4.5% APY</p>
              </div>
            </div>
          </div>

          {/* Account Type Selectors - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IRA Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasIRA"
                  checked={profile.benefits.ira?.hasIRA || false}
                  onChange={(e) => updateBenefits({
                    ira: { 
                      ...profile.benefits.ira,
                      hasIRA: e.target.checked,
                      accountTypes: profile.benefits.ira?.accountTypes || { traditional: false, roth: false },
                      currentContributions: profile.benefits.ira?.currentContributions || { traditional: 0, roth: 0 },
                      currentBalances: profile.benefits.ira?.currentBalances || { traditional: 0, roth: 0 }
                    }
                  })}
                  className="w-4 h-4 text-sage-600"
                />
                <label htmlFor="hasIRA" className="font-medium">
                  I have an IRA (Individual Retirement Account)
                </label>
              </div>
              
              {profile.benefits.ira?.hasIRA && (
                <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">What type(s) of IRA do you have?</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="hasTraditionalIRA"
                          checked={profile.benefits.ira?.accountTypes?.traditional || false}
                          onChange={(e) => updateBenefits({
                            ira: {
                              ...profile.benefits.ira,
                              accountTypes: { 
                                ...profile.benefits.ira?.accountTypes,
                                traditional: e.target.checked
                              }
                            }
                          })}
                          className="w-4 h-4 text-sage-600"
                        />
                        <label htmlFor="hasTraditionalIRA" className="text-sm">Traditional IRA</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="hasRothIRA"
                          checked={profile.benefits.ira?.accountTypes?.roth || false}
                          onChange={(e) => updateBenefits({
                            ira: {
                              ...profile.benefits.ira,
                              accountTypes: { 
                                ...profile.benefits.ira?.accountTypes,
                                roth: e.target.checked
                              }
                            }
                          })}
                          className="w-4 h-4 text-sage-600"
                        />
                        <label htmlFor="hasRothIRA" className="text-sm">Roth IRA</label>
                      </div>
                    </div>
                  </div>

                  {/* IRA Contributions */}
                  <div className="space-y-3">
                    {profile.benefits.ira?.accountTypes?.traditional && (
                      <MoneyInput
                        name="traditionalIRAContribution"
                        label="Monthly Traditional IRA Contributions"
                        value={profile.benefits.ira?.currentContributions?.traditional || 0}
                        onChange={(value) => updateBenefits({
                          ira: {
                            ...profile.benefits.ira,
                            currentContributions: { 
                              ...profile.benefits.ira?.currentContributions, 
                              traditional: value 
                            }
                          }
                        })}
                        placeholder="$500"
                      />
                    )}
                    
                    {profile.benefits.ira?.accountTypes?.roth && (
                      <MoneyInput
                        name="rothIRAContribution"
                        label="Monthly Roth IRA Contributions"
                        value={profile.benefits.ira?.currentContributions?.roth || 0}
                        onChange={(value) => updateBenefits({
                          ira: {
                            ...profile.benefits.ira,
                            currentContributions: { 
                              ...profile.benefits.ira?.currentContributions,
                              roth: value 
                            }
                          }
                        })}
                        placeholder="$500"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Taxable Investment Account Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasTaxableAccount"
                  checked={profile.preferences.hasTaxableAccount || false}
                  onChange={(e) => updatePreferences({ hasTaxableAccount: e.target.checked })}
                  className="w-4 h-4 text-sage-600"
                />
                <label htmlFor="hasTaxableAccount" className="font-medium">
                  I have a taxable brokerage account
                </label>
              </div>
              
              {profile.preferences.hasTaxableAccount && (
                <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                  <MoneyInput
                    name="taxableAccountContribution"
                    label="Monthly Contribution"
                    value={profile.preferences.taxableAccountContribution}
                    onChange={(value) => updatePreferences({ taxableAccountContribution: value })}
                    placeholder="$500"
                    help="Monthly investments to taxable accounts"
                  />
                  
                  <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
                    <p><strong>Taxable accounts:</strong> Most flexible for investing after maximizing tax-advantaged accounts.</p>
                    <p>Consider low-cost index funds (VTI, VXUS) for tax efficiency.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tax Situation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-sage-600" />
            <span>Tax Situation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <StateSelector
                value={profile.taxes.state}
                onChange={(stateCode) => updateTaxes({ state: stateCode })}
                placeholder="Select your state"
              />
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
          
          <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tax brackets are calculated automatically</strong> based on your income and state.
              The calculator uses current federal and state tax brackets to optimize your allocation.
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Employer Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-sage-600" />
            <span>Employer Benefits</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 401k Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="has401k"
                checked={profile.benefits.employer401k.available || false}
                onChange={(e) => updateBenefits({
                  employer401k: { ...profile.benefits.employer401k, available: e.target.checked }
                })}
                className="w-4 h-4 text-sage-600"
              />
              <label htmlFor="has401k" className="font-medium">
                401(k) Available
              </label>
            </div>
            
            {profile.benefits.employer401k.available && (
              <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                <PercentageSlider
                  name="matchPercent"
                  label="Employer Match Percentage"
                  value={profile.benefits.employer401k.matchPercent}
                  onChange={(value) => updateBenefits({
                    employer401k: { ...profile.benefits.employer401k, matchPercent: value }
                  })}
                  min={0}
                  max={1}
                  step={0.25}
                />
                
                <PercentageSlider
                  name="matchLimit"
                  label="Match Limit (% of Salary)"
                  value={profile.benefits.employer401k.matchLimit}
                  onChange={(value) => updateBenefits({
                    employer401k: { ...profile.benefits.employer401k, matchLimit: value }
                  })}
                  min={0}
                  max={0.15}
                  step={0.01}
                />
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contribution Type</label>
                    <select
                      value={profile.benefits.employer401k.contributionType}
                      onChange={(e) => {
                        const newType = e.target.value as 'traditional' | 'roth' | 'split';
                        const updates: Partial<typeof profile.benefits.employer401k> = {
                          contributionType: newType
                        };
                        
                        // Auto-populate split values from current contribution when switching to split
                        if (newType === 'split' && profile.benefits.employer401k.contributionType !== 'split') {
                          const current = profile.benefits.employer401k.currentContribution;
                          updates.traditionalContribution = current / 2;
                          updates.rothContribution = current / 2;
                        }
                        // Auto-populate single values when switching from split
                        else if (newType !== 'split') {
                          const total = profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution;
                          updates.currentContribution = total;
                          if (newType === 'traditional') {
                            updates.traditionalContribution = total;
                            updates.rothContribution = 0;
                          } else {
                            updates.traditionalContribution = 0;
                            updates.rothContribution = total;
                          }
                        }
                        
                        updateBenefits({
                          employer401k: { ...profile.benefits.employer401k, ...updates }
                        });
                      }}
                      className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      <option value="traditional">Traditional (Pre-tax)</option>
                      <option value="roth">Roth (After-tax)</option>
                      <option value="split">Split (Both Traditional & Roth)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Traditional reduces taxable income now, Roth is tax-free in retirement
                    </p>
                  </div>
                  
                  {profile.benefits.employer401k.contributionType === 'split' ? (
                    <div className="space-y-3">
                      <PercentageSlider
                        name="traditionalContribution"
                        label="Traditional (Pre-tax) Contribution"
                        value={profile.benefits.employer401k.traditionalContribution}
                        onChange={(value) => {
                          const newTotal = value + profile.benefits.employer401k.rothContribution;
                          updateBenefits({
                            employer401k: { 
                              ...profile.benefits.employer401k, 
                              traditionalContribution: value,
                              currentContribution: newTotal
                            }
                          });
                        }}
                        min={0}
                        max={1.00}
                        step={0.01}
                      />
                      
                      <PercentageSlider
                        name="rothContribution"
                        label="Roth (After-tax) Contribution"
                        value={profile.benefits.employer401k.rothContribution}
                        onChange={(value) => {
                          const newTotal = profile.benefits.employer401k.traditionalContribution + value;
                          updateBenefits({
                            employer401k: { 
                              ...profile.benefits.employer401k, 
                              rothContribution: value,
                              currentContribution: newTotal
                            }
                          });
                        }}
                        min={0}
                        max={1.00}
                        step={0.01}
                      />
                      
                      <div className="p-2 bg-blue-50 rounded-md border border-blue-200">
                        <div className="text-xs text-blue-800">
                          <strong>Total Contribution:</strong> {((profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PercentageSlider
                      name="currentContribution"
                      label={`${profile.benefits.employer401k.contributionType === 'traditional' ? 'Traditional (Pre-tax)' : 'Roth (After-tax)'} Contribution`}
                      value={profile.benefits.employer401k.currentContribution}
                      onChange={(value) => {
                        const updates: Partial<typeof profile.benefits.employer401k> = {
                          currentContribution: value
                        };
                        
                        if (profile.benefits.employer401k.contributionType === 'traditional') {
                          updates.traditionalContribution = value;
                          updates.rothContribution = 0;
                        } else {
                          updates.traditionalContribution = 0;
                          updates.rothContribution = value;
                        }
                        
                        updateBenefits({
                          employer401k: { ...profile.benefits.employer401k, ...updates }
                        });
                      }}
                      min={0}
                      max={1.00}
                      step={0.01}
                    />
                  )}
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
                checked={profile.benefits.hsa.eligible || false}
                onChange={(e) => updateBenefits({
                  hsa: { ...profile.benefits.hsa, eligible: e.target.checked }
                })}
                className="w-4 h-4 text-sage-600"
              />
              <label htmlFor="hasHSA" className="font-medium">
                HSA Eligible (High Deductible Health Plan)
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
                  <MoneyInput
                    name="currentHSAContribution"
                    label="Current Monthly HSA Contribution"
                    value={profile.benefits.hsa.currentContribution}
                    onChange={(value) => updateBenefits({
                      hsa: { ...profile.benefits.hsa, currentContribution: value }
                    })}
                    placeholder="$0"
                  />
                  
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hsaInvestmentStrategy"
                      checked={profile.benefits.hsa.investmentStrategy || false}
                      onChange={(e) => updateBenefits({
                        hsa: { ...profile.benefits.hsa, investmentStrategy: e.target.checked }
                      })}
                      className="w-4 h-4 text-sage-600"
                    />
                    <label htmlFor="hsaInvestmentStrategy" className="text-sm font-medium">
                      I&apos;m using HSA as an investment (saving receipts, not withdrawing)
                    </label>
                  </div>
                  
                  <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
                    <p><strong>Triple tax advantage:</strong> Deductible contributions + tax-free growth + tax-free medical withdrawals</p>
                    <p><strong>Max monthly:</strong> {formatCurrency(profile.benefits.hsa.coverageType === 'family' ? 692 : 346)}</p>
                  </div>
                  
                  <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900 p-3 rounded-md border border-purple-200 dark:border-purple-700">
                    <p><strong>⚠️ Critical HSA Strategy:</strong> Never withdraw from your HSA for current medical expenses if possible.</p>
                    <p>Pay out-of-pocket and let your HSA compound tax-free. You can reimburse yourself decades later using saved receipts.</p>
                    <p><a href="#" className="text-purple-600 underline hover:text-purple-800">Learn the optimal HSA strategy →</a></p>
                  </div>
                  
                  {profile.benefits.hsa.investmentStrategy ? (
                    <div className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900 p-3 rounded-md">
                      <p><strong>HSA Investment Strategy:</strong> With this approach, HSA beats Roth IRA due to triple tax advantage.</p>
                      <p>• Pay medical expenses out-of-pocket</p>
                      <p>• Save receipts indefinitely</p>
                      <p>• Invest HSA funds in index funds</p>
                      <p>• Withdraw tax-free against saved receipts in retirement</p>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900 p-3 rounded-md">
                      <p><strong>HSA vs Roth IRA Priority:</strong> If using HSA for current medical expenses, prioritize Roth IRA for better flexibility.</p>
                      <p>HSA is only superior when maximized as a long-term investment account.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
        </CardContent>
      </Card>
      
      {/* Debt Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-red-600" />
            <span>Current Debts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DebtInput
            debts={profile.debts}
            onAddDebt={addDebt}
            onUpdateDebt={updateDebt}
            onRemoveDebt={removeDebt}
          />
        </CardContent>
      </Card>
      {/* Advanced Settings Toggle */}
      <Card>
        <CardContent className="p-4">
          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Settings</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Advanced Settings (shown when toggled) */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Risk Tolerance</label>
              <select
                value={profile.preferences.riskTolerance}
                onChange={(e) => updatePreferences({ 
                  riskTolerance: e.target.value as 'conservative' | 'moderate' | 'optimizer'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="conservative">Conservative (traditional advice)</option>
                <option value="moderate">Moderate (balanced approach)</option>
                <option value="optimizer">Optimizer (maximum mathematical efficiency)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Optimization Goal</label>
              <select
                value={profile.preferences.optimizationGoal}
                onChange={(e) => updatePreferences({ 
                  optimizationGoal: e.target.value as 'tax_minimization' | 'wealth_maximization' | 'balanced'
                })}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="balanced">Balanced (recommended)</option>
                <option value="tax_minimization">Tax Minimization</option>
                <option value="wealth_maximization">Wealth Maximization</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}