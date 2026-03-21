import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaycheckProfile } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronUp, DollarSign, Building2, Calculator } from 'lucide-react';

interface PaycheckSummaryBoxProps {
  profile: PaycheckProfile;
}

export function PaycheckSummaryBox({ profile }: PaycheckSummaryBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate employee contributions that are deducted from paycheck
  const traditionalEmployeeContribution = profile.benefits.employer401k.available 
    ? (profile.income.grossPaycheck * profile.benefits.employer401k.traditionalContribution)
    : 0;
    
  // Calculate employer match (NOT deducted from paycheck - it's additional)
  const employerMatch = profile.benefits.employer401k.available
    ? Math.min(
        profile.income.grossPaycheck * (profile.benefits.employer401k.traditionalContribution + profile.benefits.employer401k.rothContribution),
        profile.income.grossPaycheck * profile.benefits.employer401k.matchLimit
      ) * profile.benefits.employer401k.matchPercent
    : 0;
    
  // Only employee traditional contributions reduce taxable income from paycheck
  const pretaxDeductionsFromPaycheck = traditionalEmployeeContribution;
  
  // Calculate Roth contributions (after-tax)
  const rothContribution = profile.benefits.employer401k.available 
    ? (profile.income.grossPaycheck * profile.benefits.employer401k.rothContribution)
    : 0;
    
  // Calculate taxes and other deductions from paycheck
  const grossAfterPretax = profile.income.grossPaycheck - pretaxDeductionsFromPaycheck;
  const totalTaxAndDeductions = grossAfterPretax - profile.income.netPaycheck;
  
  // Calculate effective tax rate (tax/taxable income, where taxable = gross - employee pre-tax deductions)
  const taxableIncome = profile.income.grossPaycheck - pretaxDeductionsFromPaycheck;
  const effectiveTaxRate = taxableIncome > 0 
    ? (totalTaxAndDeductions / taxableIncome) * 100 
    : 0;
  
  const getFrequencyText = () => {
    switch (profile.income.frequency) {
      case 'weekly': return 'Weekly';
      case 'bi-weekly': return 'Bi-Weekly';
      case 'semi-monthly': return 'Semi-Monthly';
      case 'monthly': return 'Monthly';
    }
  };

  return (
    <Card className="border-indigo-200 dark:border-indigo-600 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-800 dark:to-blue-800">
      <CardHeader 
        className="cursor-pointer py-2 px-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            <span>{getFrequencyText()} Paycheck Breakdown</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-indigo-700 dark:text-indigo-200 font-mono tabular-nums">
              {formatCurrency(profile.income.grossPaycheck)} → {formatCurrency(profile.income.netPaycheck)}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            ) : (
              <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Gross Paycheck */}
            <div className="flex items-center justify-between p-2 rounded-lg border bg-blue-50 dark:bg-blue-800 border-blue-200 dark:border-blue-600">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <DollarSign className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-100">Gross Paycheck</span>
              </div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-300 font-mono tabular-nums">
                {formatCurrency(profile.income.grossPaycheck)}
              </div>
            </div>

            {traditionalEmployeeContribution > 0 && (
              /* Traditional 401k Employee Contributions */
              <div className="flex items-center justify-between p-2 rounded-lg border bg-green-50 dark:bg-green-800 border-green-200 dark:border-green-600">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-800 dark:text-green-100">Traditional 401k</div>
                    <div className="text-xs text-green-600 dark:text-green-300 font-mono tabular-nums">
                      {(profile.benefits.employer401k.traditionalContribution * 100).toFixed(1)}% contribution (pre-tax)
                    </div>
                  </div>
                </div>
                <div className="text-base font-bold text-green-600 dark:text-green-300 font-mono tabular-nums">
                  -{formatCurrency(traditionalEmployeeContribution)}
                </div>
              </div>
            )}

            {/* Taxes & Deductions */}
            <div className="flex items-center justify-between p-2 rounded-lg border bg-red-50 dark:bg-red-800 border-red-200 dark:border-red-600">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <Calculator className="w-3 h-3 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-red-800 dark:text-red-100">Taxes & Deductions</div>
                  <div className="text-xs text-red-600 dark:text-red-300">Federal, State, FICA, Benefits</div>
                </div>
              </div>
              <div className="text-base font-bold text-red-600 dark:text-red-300 font-mono tabular-nums">
                -{formatCurrency(totalTaxAndDeductions)}
              </div>
            </div>
            
            {rothContribution > 0 && (
              /* Roth 401k Contributions (after-tax, so not reducing taxable income) */
              <div className="flex items-center justify-between p-2 rounded-lg border bg-blue-50 dark:bg-blue-800 border-blue-200 dark:border-blue-600">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-100">Roth 401k</div>
                    <div className="text-xs text-blue-600 dark:text-blue-300 font-mono tabular-nums">
                      {(profile.benefits.employer401k.rothContribution * 100).toFixed(1)}% contribution (after-tax)
                    </div>
                  </div>
                </div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-300 font-mono tabular-nums">
                  -{formatCurrency(rothContribution)}
                </div>
              </div>
            )}
            


            {/* Take-Home Pay */}
            <div className="flex items-center justify-between p-2 rounded-lg border bg-blue-50 dark:bg-blue-800 border-blue-200 dark:border-blue-600">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <DollarSign className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-100">Take-Home Pay</span>
              </div>
              <div className="text-base font-bold text-blue-600 dark:text-blue-300 font-mono tabular-nums">
                {formatCurrency(profile.income.netPaycheck)}
              </div>
            </div>

            {employerMatch > 0 && (
              /* Employer Match (additional compensation, separate from paycheck) */
              <div className="flex items-center justify-between p-2 rounded-lg border bg-emerald-50 dark:bg-emerald-800 border-emerald-200 dark:border-emerald-600">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 dark:text-emerald-100">Employer 401k Match</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-300">
                      Additional compensation (not from paycheck)
                    </div>
                  </div>
                </div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-300 font-mono tabular-nums">
                  +{formatCurrency(employerMatch)}
                </div>
              </div>
            )}

            {/* Summary Info */}
            <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-800 border border-indigo-200 dark:border-indigo-600 rounded-lg">
              <div className="text-xs text-indigo-800 dark:text-indigo-100 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Monthly equivalent:</span>
                  <span className="font-mono tabular-nums">Gross: {formatCurrency(profile.income.monthlyGross)} | Net: {formatCurrency(profile.income.monthlyNet)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Effective tax rate:</span>
                  <span className="font-mono tabular-nums">{effectiveTaxRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}