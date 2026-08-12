'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DebtInput } from '@/components/shared/inputs/DebtInput';
import { Building } from 'lucide-react';
import type { DebtData } from '@/lib/types';

interface DebtsInputCardProps {
  debts: DebtData[];
  onAdd: (debt: DebtData) => void;
  onUpdate: (index: number, debt: Partial<DebtData>) => void;
  onRemove: (index: number) => void;
}

export function DebtsInputCard({ debts, onAdd, onUpdate, onRemove }: DebtsInputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Building className="w-5 h-5 text-red-600" />
          <span>Current Debts</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DebtInput
          debts={debts}
          onAddDebt={onAdd}
          onUpdateDebt={onUpdate}
          onRemoveDebt={onRemove}
        />
      </CardContent>
    </Card>
  );
}
