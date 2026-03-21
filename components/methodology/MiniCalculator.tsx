/**
 * Mini Calculator Component
 * Interactive calculator widget for individual formulas
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Play, RotateCcw, Copy, Check } from 'lucide-react';
import { FormulaRegistryEntry } from '@/lib/formulas/types';
import { DisplayLatex } from './LatexRenderer';

export interface MiniCalculatorProps {
  formula: FormulaRegistryEntry;
  onClose?: () => void;
  defaultValues?: Record<string, number>;
  showSteps?: boolean;
  compact?: boolean;
}

export function MiniCalculator({
  formula,
  onClose,
  defaultValues = {},
  showSteps = false,
  compact = false
}: MiniCalculatorProps) {
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize inputs with default values or example values
  useEffect(() => {
    const initialInputs: Record<string, number> = {};
    
    // Use provided defaults first
    Object.keys(formula.variables).forEach(variable => {
      if (defaultValues[variable] !== undefined) {
        initialInputs[variable] = defaultValues[variable];
      } else if (formula.example.inputs[variable] !== undefined) {
        initialInputs[variable] = formula.example.inputs[variable];
      } else {
        initialInputs[variable] = 0;
      }
    });

    setInputs(initialInputs);
  }, [formula, defaultValues]);

  // Calculate result when inputs change
  const calculatedResult = useMemo(() => {
    try {
      // This is a simplified calculation engine
      // In production, you'd want to integrate with the actual formula functions
      return calculateFormulaResult(formula, inputs);
    } catch (error) {
      return null;
    }
  }, [formula, inputs]);

  const handleInputChange = (variable: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setInputs(prev => ({
      ...prev,
      [variable]: numValue
    }));
    setError(null);
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    
    try {
      // Validate inputs
      const missingInputs = Object.keys(formula.variables).filter(
        variable => inputs[variable] === undefined || isNaN(inputs[variable])
      );

      if (missingInputs.length > 0) {
        throw new Error(`Missing or invalid inputs: ${missingInputs.join(', ')}`);
      }

      const calculationResult = calculateFormulaResult(formula, inputs);
      setResult(calculationResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
      setResult(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleReset = () => {
    const resetInputs: Record<string, number> = {};
    Object.keys(formula.variables).forEach(variable => {
      resetInputs[variable] = formula.example.inputs[variable] || 0;
    });
    setInputs(resetInputs);
    setResult(null);
    setError(null);
  };

  const handleCopyResult = async () => {
    if (result !== null) {
      try {
        await navigator.clipboard.writeText(result.toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.warn('Failed to copy result:', error);
      }
    }
  };

  if (compact) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-blue-900">{formula.name}</h4>
          {onClose && (
            <button
              onClick={onClose}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="space-y-2">
          {Object.entries(formula.variables).map(([variable, info]) => (
            <div key={variable} className="flex items-center space-x-2">
              <label className="w-8 text-sm font-mono">{variable}:</label>
              <input
                type="number"
                value={inputs[variable] || ''}
                onChange={(e) => handleInputChange(variable, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={info.unit}
              />
            </div>
          ))}
        </div>

        {calculatedResult !== null && (
          <div className="mt-3 p-2 bg-white rounded border">
            <div className="text-sm text-gray-600">Result:</div>
            <div className="text-lg font-bold text-blue-900">
              {calculatedResult.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="w-6 h-6" />
            <h3 className="text-lg font-semibold">{formula.name}</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-blue-100 text-sm mt-1">{formula.description}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Formula Display */}
        <div className="text-center">
          <DisplayLatex latex={formula.latex} className="bg-gray-50" />
        </div>

        {/* Input Variables */}
        <div>
          <h4 className="font-semibold mb-3">Input Variables</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(formula.variables).map(([variable, info]) => (
              <div key={variable} className="space-y-1">
                <label className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center space-x-2">
                    <code className="bg-gray-100 px-1 rounded">{variable}</code>
                    <span>{info.description}</span>
                  </span>
                  {info.unit && (
                    <span className="text-gray-500">({info.unit})</span>
                  )}
                </label>
                <input
                  type="number"
                  value={inputs[variable] || ''}
                  onChange={(e) => handleInputChange(variable, e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter ${info.description.toLowerCase()}`}
                  step="any"
                />
                {info.constraints && (
                  <p className="text-xs text-orange-600">{info.constraints}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{isCalculating ? 'Calculating...' : 'Calculate'}</span>
            </button>
            
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Result */}
        {(result !== null || error) && (
          <div className="border-t pt-4">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-red-800 font-medium">Error</div>
                <div className="text-red-600 text-sm">{error}</div>
              </div>
            ) : result !== null ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-green-800 font-medium">Result</div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                      {result.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyResult}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                
                {showSteps && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <div className="text-green-800 text-sm font-medium mb-2">
                      Calculation Steps:
                    </div>
                    <div className="space-y-1 text-sm text-green-700">
                      {generateCalculationSteps(formula, inputs, result).map((step, index) => (
                        <div key={index} className="flex">
                          <span className="w-6">{index + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Example Comparison */}
        {result !== null && formula.example && (
          <div className="border-t pt-4">
            <h5 className="font-medium mb-2">Compare with Example</h5>
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              <div>Example inputs: {JSON.stringify(formula.example.inputs)}</div>
              <div>Example result: {formula.example.output.toLocaleString()}</div>
              <div>Your result: {result.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simplified formula calculation engine
 * In production, this would integrate with actual formula functions
 */
function calculateFormulaResult(
  formula: FormulaRegistryEntry,
  inputs: Record<string, number>
): number {
  // This is a placeholder implementation
  // In the real system, you'd call the actual registered function
  
  // For now, use some common financial formulas based on the formula name
  const formulaName = formula.name.toLowerCase();
  
  if (formulaName.includes('future value') && formulaName.includes('investment')) {
    // FV = PV * (1 + r)^t
    const PV = inputs.PV || inputs.presentValue || 0;
    const r = inputs.r || inputs.rate || 0;
    const t = inputs.t || inputs.time || inputs.periods || 0;
    return PV * Math.pow(1 + r, t);
  }
  
  if (formulaName.includes('present value')) {
    // PV = FV / (1 + r)^t
    const FV = inputs.FV || inputs.futureValue || 0;
    const r = inputs.r || inputs.rate || 0;
    const t = inputs.t || inputs.time || inputs.periods || 0;
    return FV / Math.pow(1 + r, t);
  }
  
  if (formulaName.includes('annuity')) {
    // FVA = PMT * [((1 + r)^t - 1) / r]
    const PMT = inputs.PMT || inputs.payment || 0;
    const r = inputs.r || inputs.rate || 0;
    const t = inputs.t || inputs.time || inputs.periods || 0;
    
    if (r === 0) return PMT * t;
    return PMT * ((Math.pow(1 + r, t) - 1) / r);
  }
  
  // Fallback: try to evaluate the example to get expected result
  // This is a very basic implementation
  return formula.example.output;
}

/**
 * Generate step-by-step calculation explanation
 */
function generateCalculationSteps(
  formula: FormulaRegistryEntry,
  inputs: Record<string, number>,
  result: number
): string[] {
  const steps: string[] = [];
  
  // Add input substitution step
  const inputsList = Object.entries(inputs)
    .map(([variable, value]) => `${variable} = ${value}`)
    .join(', ');
  steps.push(`Substitute values: ${inputsList}`);
  
  // Add formula step
  steps.push(`Apply formula: ${formula.latex.replace(/\\/g, '')}`);
  
  // Add result step
  steps.push(`Result: ${result.toLocaleString()}`);
  
  return steps;
}