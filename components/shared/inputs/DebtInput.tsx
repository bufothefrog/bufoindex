'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from './MoneyInput';
import { DebtData } from '@/lib/types';
import { formatPercent, formatCurrency } from '@/lib/utils';
import { Plus, Trash2, AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';

interface DebtInputProps {
  debts: DebtData[];
  onAddDebt: (debt: DebtData) => void;
  onUpdateDebt: (index: number, debt: Partial<DebtData>) => void;
  onRemoveDebt: (index: number) => void;
}

export function DebtInput({ debts, onAddDebt, onUpdateDebt, onRemoveDebt }: DebtInputProps) {
  const [isAddingDebt, setIsAddingDebt] = React.useState(false);
  
  const addNewDebt = () => {
    const newDebt: DebtData = {
      id: `debt-${Date.now()}`,
      name: '',
      balance: 0,
      interestRate: 0,
      minimumPayment: 0,
      extraPayment: 0,
      taxDeductible: false,
    };
    onAddDebt(newDebt);
    setIsAddingDebt(false);
  };

  const getDebtStatus = (interestRate: number) => {
    if (interestRate > 0.08) {
      return {
        status: 'high' as const,
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: 'High-interest debt - prioritize paying off',
      };
    } else if (interestRate >= 0.05) {
      return {
        status: 'medium' as const,
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: 'Moderate-interest debt - evaluate vs. investing',
      };
    } else {
      return {
        status: 'low' as const,
        icon: CheckCircle,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        message: 'Low-interest debt - likely better to invest',
      };
    }
  };

  return (
    <div className="space-y-4">

        {/* Existing Debts */}
        <div className="space-y-3">
          {debts.map((debt, index) => {
            const debtStatus = getDebtStatus(debt.interestRate);
            const IconComponent = debtStatus.icon;
            
            return (
              <div key={debt.id} className={`p-4 border rounded-lg ${debtStatus.bgColor} ${debtStatus.borderColor}`}>
                <div className="flex items-start space-x-3">
                  <IconComponent className={`w-5 h-5 mt-1 ${debtStatus.color}`} />
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Debt Name</label>
                        <Input
                          value={debt.name}
                          onChange={(e) => onUpdateDebt(index, { name: e.target.value })}
                          placeholder="e.g., Credit Card, Student Loan"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Balance</label>
                        <MoneyInput
                          name={`debt-balance-${index}`}
                          label=""
                          value={debt.balance}
                          onChange={(value) => onUpdateDebt(index, { balance: value })}
                          placeholder="$10,000"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Interest Rate (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="50"
                          value={debt.interestRate * 100}
                          onChange={(e) => onUpdateDebt(index, { interestRate: Number(e.target.value) / 100 })}
                          placeholder="15.99"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Minimum Payment</label>
                        <MoneyInput
                          name={`debt-minimum-${index}`}
                          label=""
                          value={debt.minimumPayment}
                          onChange={(value) => onUpdateDebt(index, { minimumPayment: value })}
                          placeholder="$200"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Extra Payment (optional)</label>
                        <MoneyInput
                          name={`debt-extra-${index}`}
                          label=""
                          value={debt.extraPayment}
                          onChange={(value) => onUpdateDebt(index, { extraPayment: value })}
                          placeholder="$0"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className={`font-medium ${debtStatus.color}`}>
                          {formatPercent(debt.interestRate)} interest rate
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className={debtStatus.color}>
                          {debtStatus.message}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveDebt(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Debt Button */}
        {debts.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="mb-4">No debts added yet</p>
            <Button onClick={addNewDebt} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Debt
            </Button>
          </div>
        )}
        
        {debts.length > 0 && (
          <Button onClick={addNewDebt} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Debt
          </Button>
        )}
        
        {/* Summary */}
        {debts.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm">
              <div className="flex justify-between mb-1">
                <span>Total Debt:</span>
                <span className="font-medium">
                  {formatCurrency(debts.reduce((sum, debt) => sum + debt.balance, 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Monthly Payments:</span>
                <span className="font-medium">
                  {formatCurrency(debts.reduce((sum, debt) => sum + debt.minimumPayment + debt.extraPayment, 0))}
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}