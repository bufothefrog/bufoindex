'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateSelector } from '@/components/shared/inputs/StateSelector';
import { Calculator } from 'lucide-react';
import type { TaxData } from '@/lib/types';

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
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <StateSelector
              value={taxes.state}
              onChange={(stateCode) => onUpdate({ state: stateCode })}
              placeholder="Select your state"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Filing Status</label>
            <select
              value={taxes.filingStatus}
              onChange={(e) => onUpdate({ filingStatus: e.target.value as 'single' | 'marriedJoint' | 'marriedSeparate' | 'headOfHousehold' })}
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="single">Single</option>
              <option value="marriedJoint">Married Filing Jointly</option>
              <option value="marriedSeparate">Married Filing Separately</option>
              <option value="headOfHousehold">Head of Household</option>
            </select>
          </div>
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
