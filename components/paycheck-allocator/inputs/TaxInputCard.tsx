'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { Calculator } from 'lucide-react';
import type { TaxData } from '@/lib/types';

const FILING_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'marriedJoint', label: 'Married Filing Jointly' },
  { value: 'marriedSeparate', label: 'Married Filing Separately' },
  { value: 'headOfHousehold', label: 'Head of Household' },
];

interface TaxInputCardProps {
  taxes: TaxData;
  onUpdate: (taxes: Partial<TaxData>) => void;
}

export function TaxInputCard({ taxes, onUpdate }: TaxInputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-sage-600" />
          <span>Tax Situation</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StateSelector
            name="taxState"
            label="State"
            value={taxes.state}
            onChange={(stateCode) => onUpdate({ state: stateCode })}
            placeholder="Select your state"
          />

          <SelectInput
            name="filingStatus"
            label="Filing Status"
            value={taxes.filingStatus}
            onChange={(value) => onUpdate({ filingStatus: value as TaxData['filingStatus'] })}
            options={FILING_STATUS_OPTIONS}
          />
        </div>

        <div className="p-3 bg-info/10 rounded-md border border-info/30">
          <div className="text-sm text-info">
            <strong>Tax brackets are calculated automatically</strong> based on your income and state.
            The calculator uses current federal and state tax brackets to optimize your allocation.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
