'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/inputs';
import { PercentageSlider } from '@/components/shared/inputs/PercentageSlider';
import { Building } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { BenefitsData, IncomeData } from '@/lib/types';

interface BenefitsInputCardProps {
  benefits: BenefitsData;
  income: IncomeData;
  onUpdate: (benefits: Partial<BenefitsData>) => void;
}

export function BenefitsInputCard({ benefits, onUpdate }: BenefitsInputCardProps) {
  return (
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
              checked={benefits.employer401k.available || false}
              onChange={(e) => onUpdate({
                employer401k: { ...benefits.employer401k, available: e.target.checked }
              })}
              className="w-4 h-4 text-sage-600"
            />
            <label htmlFor="has401k" className="font-medium">
              401(k) Available
            </label>
          </div>

          {benefits.employer401k.available && (
            <div className="space-y-4 pl-6 border-l-2 border-sage-100">
              <PercentageSlider
                name="matchPercent"
                label="Employer Match Percentage"
                value={benefits.employer401k.matchPercent}
                onChange={(value) => onUpdate({
                  employer401k: { ...benefits.employer401k, matchPercent: value }
                })}
                min={0}
                max={1}
                step={0.25}
              />

              <PercentageSlider
                name="matchLimit"
                label="Match Limit (% of Salary)"
                value={benefits.employer401k.matchLimit}
                onChange={(value) => onUpdate({
                  employer401k: { ...benefits.employer401k, matchLimit: value }
                })}
                min={0}
                max={0.15}
                step={0.01}
              />

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contribution Type</label>
                  <select
                    value={benefits.employer401k.contributionType}
                    onChange={(e) => {
                      const newType = e.target.value as 'traditional' | 'roth' | 'split';
                      const updates: Partial<typeof benefits.employer401k> = {
                        contributionType: newType
                      };

                      // Auto-populate split values from current contribution when switching to split
                      if (newType === 'split' && benefits.employer401k.contributionType !== 'split') {
                        const current = benefits.employer401k.currentContribution;
                        updates.traditionalContribution = current / 2;
                        updates.rothContribution = current / 2;
                      }
                      // Auto-populate single values when switching from split
                      else if (newType !== 'split') {
                        const total = benefits.employer401k.traditionalContribution + benefits.employer401k.rothContribution;
                        updates.currentContribution = total;
                        if (newType === 'traditional') {
                          updates.traditionalContribution = total;
                          updates.rothContribution = 0;
                        } else {
                          updates.traditionalContribution = 0;
                          updates.rothContribution = total;
                        }
                      }

                      onUpdate({
                        employer401k: { ...benefits.employer401k, ...updates }
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

                {benefits.employer401k.contributionType === 'split' ? (
                  <div className="space-y-3">
                    <PercentageSlider
                      name="traditionalContribution"
                      label="Traditional (Pre-tax) Contribution"
                      value={benefits.employer401k.traditionalContribution}
                      onChange={(value) => {
                        const newTotal = value + benefits.employer401k.rothContribution;
                        onUpdate({
                          employer401k: {
                            ...benefits.employer401k,
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
                      value={benefits.employer401k.rothContribution}
                      onChange={(value) => {
                        const newTotal = benefits.employer401k.traditionalContribution + value;
                        onUpdate({
                          employer401k: {
                            ...benefits.employer401k,
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
                        <strong>Total Contribution:</strong> {((benefits.employer401k.traditionalContribution + benefits.employer401k.rothContribution) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <PercentageSlider
                    name="currentContribution"
                    label={`${benefits.employer401k.contributionType === 'traditional' ? 'Traditional (Pre-tax)' : 'Roth (After-tax)'} Contribution`}
                    value={benefits.employer401k.currentContribution}
                    onChange={(value) => {
                      const updates: Partial<typeof benefits.employer401k> = {
                        currentContribution: value
                      };

                      if (benefits.employer401k.contributionType === 'traditional') {
                        updates.traditionalContribution = value;
                        updates.rothContribution = 0;
                      } else {
                        updates.traditionalContribution = 0;
                        updates.rothContribution = value;
                      }

                      onUpdate({
                        employer401k: { ...benefits.employer401k, ...updates }
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
              checked={benefits.hsa.eligible || false}
              onChange={(e) => onUpdate({
                hsa: { ...benefits.hsa, eligible: e.target.checked }
              })}
              className="w-4 h-4 text-sage-600"
            />
            <label htmlFor="hasHSA" className="font-medium">
              HSA Eligible (High Deductible Health Plan)
            </label>
          </div>

          {benefits.hsa.eligible && (
            <div className="space-y-4 pl-6 border-l-2 border-sage-100">
              <div className="space-y-2">
                <label className="text-sm font-medium">Coverage Type</label>
                <select
                  value={benefits.hsa.coverageType}
                  onChange={(e) => onUpdate({
                    hsa: { ...benefits.hsa, coverageType: e.target.value as 'individual' | 'family' }
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
                  value={benefits.hsa.currentContribution}
                  onChange={(value) => onUpdate({
                    hsa: { ...benefits.hsa, currentContribution: value }
                  })}
                  placeholder="0"
                />

              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hsaInvestmentStrategy"
                    checked={benefits.hsa.investmentStrategy || false}
                    onChange={(e) => onUpdate({
                      hsa: { ...benefits.hsa, investmentStrategy: e.target.checked }
                    })}
                    className="w-4 h-4 text-sage-600"
                  />
                  <label htmlFor="hsaInvestmentStrategy" className="text-sm font-medium">
                    I&apos;m using HSA as an investment (saving receipts, not withdrawing)
                  </label>
                </div>

                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
                  <p><strong>Triple tax advantage:</strong> Deductible contributions + tax-free growth + tax-free medical withdrawals</p>
                  <p><strong>Max monthly:</strong> {formatCurrency(benefits.hsa.coverageType === 'family' ? 692 : 346)}</p>
                </div>

                <div className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900 p-3 rounded-md border border-purple-200 dark:border-purple-700">
                  <p><strong>⚠️ Critical HSA Strategy:</strong> Never withdraw from your HSA for current medical expenses if possible.</p>
                  <p>Pay out-of-pocket and let your HSA compound tax-free. You can reimburse yourself decades later using saved receipts.</p>
                  <p><a href="#" className="text-purple-600 underline hover:text-purple-800">Learn the optimal HSA strategy →</a></p>
                </div>

                {benefits.hsa.investmentStrategy ? (
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
  );
}
