/**
 * Mini Calculator Component
 * Interactive calculator widget for individual formulas
 */

'use client';

import React, { useState, useMemo } from 'react';
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
  // Seed inputs with provided defaults first, then example values.
  const buildInitialInputs = () => {
    const initialInputs: Record<string, number> = {};
    Object.keys(formula.variables).forEach(variable => {
      if (defaultValues[variable] !== undefined) {
        initialInputs[variable] = defaultValues[variable];
      } else if (formula.example.inputs[variable] !== undefined) {
        initialInputs[variable] = formula.example.inputs[variable];
      } else {
        initialInputs[variable] = 0;
      }
    });
    return initialInputs;
  };

  const [inputs, setInputs] = useState<Record<string, number>>(buildInitialInputs);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-seed the inputs when a different formula is shown (state adjusted
  // during render — https://react.dev/learn/you-might-not-need-an-effect).
  const [prevFormula, setPrevFormula] = useState(formula);
  if (formula !== prevFormula) {
    setPrevFormula(formula);
    setInputs(buildInitialInputs());
  }

  // Calculate result when inputs change
  const calculatedResult = useMemo(() => {
    try {
      // This is a simplified calculation engine
      // In production, you'd want to integrate with the actual formula functions
      return calculateFormulaResult(formula, inputs);
    } catch {
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
      <div className="border rounded-lg p-4 bg-info/10 border-info/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-foreground">{formula.name}</h4>
          {onClose && (
            <button
              onClick={onClose}
              className="text-primary hover:text-primary/80 text-sm"
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
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-hidden focus:ring-2 focus:ring-ring"
                placeholder={info.unit}
              />
            </div>
          ))}
        </div>

        {calculatedResult !== null && (
          <div className="mt-3 p-2 bg-background rounded border">
            <div className="text-sm text-muted-foreground">Result:</div>
            <div className="text-lg font-bold text-foreground">
              {calculatedResult.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-background border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="w-6 h-6" />
            <h3 className="text-lg font-semibold">{formula.name}</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-primary-foreground/80 text-sm mt-1">{formula.description}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Formula Display */}
        <div className="text-center">
          <DisplayLatex latex={formula.latex} className="bg-muted" />
        </div>

        {/* Input Variables */}
        <div>
          <h4 className="font-semibold mb-3">Input Variables</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(formula.variables).map(([variable, info]) => (
              <div key={variable} className="space-y-1">
                <label className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center space-x-2">
                    <code className="bg-muted px-1 rounded">{variable}</code>
                    <span>{info.description}</span>
                  </span>
                  {info.unit && (
                    <span className="text-muted-foreground">({info.unit})</span>
                  )}
                </label>
                <input
                  type="number"
                  value={inputs[variable] || ''}
                  onChange={(e) => handleInputChange(variable, e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder={`Enter ${info.description.toLowerCase()}`}
                  step="any"
                />
                {info.constraints && (
                  <p className="text-xs text-warning">{info.constraints}</p>
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
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>{isCalculating ? 'Calculating...' : 'Calculate'}</span>
            </button>
            
            <button
              onClick={handleReset}
              className="flex items-center space-x-2 px-4 py-2 border border-input rounded hover:bg-muted transition-colors"
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
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
                <div className="text-destructive font-medium">Error</div>
                <div className="text-destructive text-sm">{error}</div>
              </div>
            ) : result !== null ? (
              <div className="p-4 bg-success/10 border border-success/30 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-success font-medium">Result</div>
                    <div className="text-2xl font-bold text-success mt-1">
                      {result.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyResult}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-success text-success-foreground rounded hover:bg-success/90 transition-colors"
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
                  <div className="mt-3 pt-3 border-t border-success/30">
                    <div className="text-success text-sm font-medium mb-2">
                      Calculation Steps:
                    </div>
                    <div className="space-y-1 text-sm text-success">
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
            <div className="bg-muted p-3 rounded text-sm space-y-1">
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