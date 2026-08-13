'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/inputs';
import { PercentageSlider } from '@/components/shared/inputs/PercentageSlider';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { Building } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CONTRIBUTION_LIMITS_2026 } from '@/lib/constants/irs-2026';
import type { BenefitsData, IncomeData } from '@/lib/types';

interface BenefitsInputCardProps {
  benefits: BenefitsData;
  income: IncomeData;
  onUpdate: (benefits: Partial<BenefitsData>) => void;
}

export function BenefitsInputCard({ benefits, onUpdate }: BenefitsInputCardProps) {
  const hsaAnnualLimit = benefits.hsa.coverageType === 'family'
    ? CONTRIBUTION_LIMITS_2026.hsa.family
    : CONTRIBUTION_LIMITS_2026.hsa.individual;

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
                  <SelectInput
                    name="contributionType"
                    label="Contribution Type"
                    value={benefits.employer401k.contributionType}
                    onChange={(value) => {
                      const newType = value as 'traditional' | 'roth' | 'split';
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
                    options={[
                      { value: 'traditional', label: 'Traditional (Pre-tax)' },
                      { value: 'roth', label: 'Roth (After-tax)' },
                      { value: 'split', label: 'Split (Both Traditional & Roth)' },
                    ]}
                    help="Traditional reduces taxable income now, Roth is tax-free in retirement"
                  />
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

                    <div className="p-2 bg-info/10 rounded-md border border-info/30">
                      <div className="text-xs text-info">
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
                <SelectInput
                  name="hsaCoverageType"
                  label="Coverage Type"
                  value={benefits.hsa.coverageType}
                  onChange={(value) => onUpdate({
                    hsa: { ...benefits.hsa, coverageType: value as 'individual' | 'family' }
                  })}
                  options={[
                    { value: 'individual', label: `Individual (${formatCurrency(CONTRIBUTION_LIMITS_2026.hsa.individual)} limit)` },
                    { value: 'family', label: `Family (${formatCurrency(CONTRIBUTION_LIMITS_2026.hsa.family)} limit)` },
                  ]}
                />
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

                <div className="text-xs text-info bg-info/10 p-3 rounded-md">
                  <p><strong>Three tax advantages:</strong> Deductible contributions + untaxed growth + untaxed withdrawals for qualified medical costs</p>
                  <p>
                    <strong>{formatCurrency(hsaAnnualLimit)}/year limit:</strong>{' '}
                    {formatCurrency(hsaAnnualLimit / 12)} per month
                  </p>
                </div>

                <div className="text-xs text-primary bg-primary/10 p-3 rounded-md border border-primary/30">
                  <p><strong>Reimbursement timing:</strong> There is no deadline for reimbursing a qualified expense, so a receipt kept today can be reimbursed years later.</p>
                  <p>Paying medical costs out of pocket leaves the balance invested and growing untaxed; reimbursing right away keeps that cash available now. The trade-off is between current liquidity and compounding.</p>
                </div>

                {benefits.hsa.investmentStrategy ? (
                  <div className="text-xs text-success bg-success/10 p-3 rounded-md">
                    <p><strong>Held as an investment:</strong> contributions, growth, and qualified withdrawals go untaxed, where a Roth IRA taxes the contribution. That extra advantage only applies while the balance stays invested.</p>
                    <p>This approach generally involves:</p>
                    <p>• Paying medical expenses out-of-pocket</p>
                    <p>• Keeping receipts for later reimbursement</p>
                    <p>• Investing the HSA balance rather than holding cash</p>
                    <p>• Reimbursing against those receipts in retirement</p>
                  </div>
                ) : (
                  <div className="text-xs text-warning bg-warning/10 p-3 rounded-md">
                    <p><strong>HSA and Roth IRA compared:</strong> spending the HSA on current medical costs uses up the balance that would otherwise compound untaxed.</p>
                    <p>Roth IRA contributions can be withdrawn at any time without tax or penalty, so the two accounts differ mainly in how accessible the money is until retirement.</p>
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
