/**
 * Formula Display Component
 * Complete display of formula with metadata, variables, and examples
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, BookOpen } from 'lucide-react';
import { FormulaRegistryEntry, ExampleData } from '@/lib/formulas/types';
import { DisplayLatex, InlineLatex } from './LatexRenderer';

export interface FormulaDisplayProps {
  formula: FormulaRegistryEntry;
  showExample?: boolean;
  showSources?: boolean;
  showAssumptions?: boolean;
  compact?: boolean;
  onMiniCalculatorOpen?: (formula: FormulaRegistryEntry) => void;
}

export function FormulaDisplay({
  formula,
  showExample = true,
  showSources = true,
  showAssumptions = true,
  compact = false,
  onMiniCalculatorOpen
}: FormulaDisplayProps) {
  const [expandedSections, setExpandedSections] = useState({
    variables: !compact,
    example: !compact,
    sources: false,
    assumptions: false,
    limitations: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyFormula = async () => {
    try {
      await navigator.clipboard.writeText(formula.latex);
      // Could add toast notification here
    } catch (error) {
      console.warn('Failed to copy formula:', error);
    }
  };

  if (compact) {
    return (
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-lg">{formula.name}</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyFormula}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy LaTeX"
            >
              <Copy className="w-4 h-4" />
            </button>
            {onMiniCalculatorOpen && (
              <button
                onClick={() => onMiniCalculatorOpen(formula)}
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Calculate
              </button>
            )}
          </div>
        </div>
        
        <DisplayLatex latex={formula.latex} className="mb-2" />
        
        <p className="text-sm text-muted-foreground">{formula.description}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{formula.name}</h3>
            <p className="text-muted-foreground mb-2">{formula.description}</p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className="px-2 py-1 bg-background rounded-full border">
                {formula.category}
              </span>
              {formula.lastUpdated && (
                <span>Updated: {new Date(formula.lastUpdated).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={copyFormula}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy LaTeX formula"
            >
              <Copy className="w-4 h-4" />
            </button>
            {onMiniCalculatorOpen && (
              <button
                onClick={() => onMiniCalculatorOpen(formula)}
                className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Try Calculator
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Formula */}
        <div>
          <h4 className="font-semibold mb-2">Formula</h4>
          <DisplayLatex latex={formula.latex} />
        </div>

        {/* Purpose */}
        <div>
          <h4 className="font-semibold mb-2">Purpose</h4>
          <p className="text-sm">{formula.purpose}</p>
        </div>

        {/* Variables */}
        <div>
          <button
            onClick={() => toggleSection('variables')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="font-semibold">Variables</h4>
            {expandedSections.variables ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSections.variables && (
            <div className="mt-2 space-y-2">
              {Object.entries(formula.variables).map(([symbol, variable]) => (
                <div key={symbol} className="flex items-center space-x-3 text-sm">
                  <InlineLatex 
                    latex={variable.symbol} 
                    className="font-mono bg-muted px-1 rounded"
                  />
                  <span className="text-muted-foreground">=</span>
                  <span>{variable.description}</span>
                  {variable.unit && (
                    <span className="text-muted-foreground">({variable.unit})</span>
                  )}
                  {variable.constraints && (
                    <span className="text-xs text-warning italic">
                      {variable.constraints}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Example */}
        {showExample && formula.example && (
          <div>
            <button
              onClick={() => toggleSection('example')}
              className="flex items-center justify-between w-full text-left"
            >
              <h4 className="font-semibold">Example</h4>
              {expandedSections.example ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {expandedSections.example && (
              <div className="mt-2">
                <ExampleDisplay example={formula.example} />
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {showSources && formula.sources?.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('sources')}
              className="flex items-center justify-between w-full text-left"
            >
              <h4 className="font-semibold">Sources</h4>
              {expandedSections.sources ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {expandedSections.sources && (
              <div className="mt-2 space-y-1">
                {formula.sources.map((source, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span>{source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assumptions */}
        {showAssumptions && formula.assumptions?.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('assumptions')}
              className="flex items-center justify-between w-full text-left"
            >
              <h4 className="font-semibold">Assumptions</h4>
              {expandedSections.assumptions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {expandedSections.assumptions && (
              <div className="mt-2">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {formula.assumptions.map((assumption, index) => (
                    <li key={index} className="flex items-start">
                      <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mt-1.5 mr-2 shrink-0"></span>
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Limitations */}
        {formula.limitations?.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('limitations')}
              className="flex items-center justify-between w-full text-left"
            >
              <h4 className="font-semibold">Limitations</h4>
              {expandedSections.limitations ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {expandedSections.limitations && (
              <div className="mt-2">
                <ul className="space-y-1 text-sm text-warning">
                  {formula.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start">
                      <span className="inline-block w-2 h-2 rounded-full bg-warning mt-1.5 mr-2 shrink-0"></span>
                      {limitation}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example display component
 */
function ExampleDisplay({ example }: { example: ExampleData }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
      <div>
        <h5 className="font-medium mb-2">Input Values:</h5>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(example.inputs).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="font-mono">{key}:</span>
              <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h5 className="font-medium mb-2">Result:</h5>
        <div className="text-lg font-semibold text-primary">
          {typeof example.output === 'number' ? example.output.toLocaleString() : example.output}
        </div>
      </div>
      
      <div>
        <h5 className="font-medium mb-2">Explanation:</h5>
        <p className="text-sm text-muted-foreground">{example.explanation}</p>
      </div>

      {example.stepByStep && (
        <div>
          <h5 className="font-medium mb-2">Step by Step:</h5>
          <ol className="text-sm space-y-1 text-muted-foreground">
            {example.stepByStep.map((step, index) => (
              <li key={index} className="flex">
                <span className="mr-2 font-medium">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}