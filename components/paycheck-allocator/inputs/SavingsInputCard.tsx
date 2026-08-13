'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/inputs';
import { Input } from '@/components/ui/input';
import { PiggyBank } from 'lucide-react';
import type { UserPreferences, BenefitsData } from '@/lib/types';

interface SavingsInputCardProps {
  preferences: UserPreferences;
  benefits: BenefitsData;
  onUpdatePreferences: (preferences: Partial<UserPreferences>) => void;
  onUpdateBenefits: (benefits: Partial<BenefitsData>) => void;
}

export function SavingsInputCard({ preferences, benefits, onUpdatePreferences, onUpdateBenefits }: SavingsInputCardProps) {
  return (
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
              value={preferences.currentEmergencyFund}
              onChange={(value) => onUpdatePreferences({ currentEmergencyFund: value })}
              placeholder="10,000"
              help="Current balance in savings/emergency accounts"
            />

            <div className="space-y-2">
              <label htmlFor="emergencyFundMonths" className="text-sm font-medium">Target Months</label>
              <Input
                id="emergencyFundMonths"
                type="number"
                min="1"
                max="24"
                value={preferences.emergencyFundMonths}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= 24) {
                    onUpdatePreferences({ emergencyFundMonths: value });
                  }
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Months of expenses to save (typically 3-6)</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="emergencyFundAPY" className="text-sm font-medium">APY (%)</label>
              <Input
                id="emergencyFundAPY"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={preferences.emergencyFundAPY * 100}
                onChange={(e) => onUpdatePreferences({ emergencyFundAPY: parseFloat(e.target.value) / 100 })}
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
                checked={benefits.ira?.hasIRA || false}
                onChange={(e) => onUpdateBenefits({
                  ira: {
                    ...benefits.ira,
                    hasIRA: e.target.checked,
                    accountTypes: benefits.ira?.accountTypes || { traditional: false, roth: false },
                    currentContributions: benefits.ira?.currentContributions || { traditional: 0, roth: 0 },
                    currentBalances: benefits.ira?.currentBalances || { traditional: 0, roth: 0 }
                  }
                })}
                className="w-4 h-4 text-sage-600"
              />
              <label htmlFor="hasIRA" className="font-medium">
                I have an IRA (Individual Retirement Account)
              </label>
            </div>

            {benefits.ira?.hasIRA && (
              <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">What type(s) of IRA do you have?</p>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hasTraditionalIRA"
                        checked={benefits.ira?.accountTypes?.traditional || false}
                        onChange={(e) => onUpdateBenefits({
                          ira: {
                            ...benefits.ira,
                            accountTypes: {
                              ...benefits.ira?.accountTypes,
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
                        checked={benefits.ira?.accountTypes?.roth || false}
                        onChange={(e) => onUpdateBenefits({
                          ira: {
                            ...benefits.ira,
                            accountTypes: {
                              ...benefits.ira?.accountTypes,
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
                  {benefits.ira?.accountTypes?.traditional && (
                    <MoneyInput
                      name="traditionalIRAContribution"
                      label="Monthly Traditional IRA Contributions"
                      value={benefits.ira?.currentContributions?.traditional || 0}
                      onChange={(value) => onUpdateBenefits({
                        ira: {
                          ...benefits.ira,
                          currentContributions: {
                            ...benefits.ira?.currentContributions,
                            traditional: value
                          }
                        }
                      })}
                      placeholder="500"
                    />
                  )}

                  {benefits.ira?.accountTypes?.roth && (
                    <MoneyInput
                      name="rothIRAContribution"
                      label="Monthly Roth IRA Contributions"
                      value={benefits.ira?.currentContributions?.roth || 0}
                      onChange={(value) => onUpdateBenefits({
                        ira: {
                          ...benefits.ira,
                          currentContributions: {
                            ...benefits.ira?.currentContributions,
                            roth: value
                          }
                        }
                      })}
                      placeholder="500"
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
                checked={preferences.hasTaxableAccount || false}
                onChange={(e) => onUpdatePreferences({ hasTaxableAccount: e.target.checked })}
                className="w-4 h-4 text-sage-600"
              />
              <label htmlFor="hasTaxableAccount" className="font-medium">
                I have a taxable brokerage account
              </label>
            </div>

            {preferences.hasTaxableAccount && (
              <div className="space-y-4 pl-6 border-l-2 border-sage-100">
                <MoneyInput
                  name="taxableAccountContribution"
                  label="Monthly Contribution"
                  value={preferences.taxableAccountContribution}
                  onChange={(value) => onUpdatePreferences({ taxableAccountContribution: value })}
                  placeholder="500"
                  help="Monthly investments to taxable accounts"
                />

                <div className="text-xs text-info bg-info/10 p-3 rounded-md">
                  <p><strong>Taxable accounts:</strong> No contribution limits or withdrawal restrictions, but gains and dividends are taxed in the year they occur.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
