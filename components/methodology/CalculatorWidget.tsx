/**
 * Calculator Widget Component
 * Embeddable calculator widget for methodology pages
 */

'use client';

import React, { useState } from 'react';
import { Calculator, X, Maximize2, Minimize2 } from 'lucide-react';
import { FormulaRegistryEntry } from '@/lib/formulas/types';
import { MiniCalculator } from './MiniCalculator';

export interface CalculatorWidgetProps {
  formula: FormulaRegistryEntry;
  trigger?: 'button' | 'inline' | 'auto';
  defaultExpanded?: boolean;
  showSteps?: boolean;
  className?: string;
}

export function CalculatorWidget({
  formula,
  trigger = 'button',
  defaultExpanded = false,
  showSteps = false,
  className = ''
}: CalculatorWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleExpanded = () => setIsExpanded(!isExpanded);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  if (trigger === 'inline') {
    return (
      <div className={`border rounded-lg overflow-hidden ${className}`}>
        <div className="bg-info/10 border-b border-info/20 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Try This Formula</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleFullscreen}
                className="p-1 text-primary hover:text-primary/80 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <MiniCalculator
            formula={formula}
            compact={true}
            showSteps={showSteps}
          />
        </div>
      </div>
    );
  }

  if (trigger === 'auto' && !isExpanded) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={toggleExpanded}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Calculator className="w-4 h-4" />
          <span>Calculate</span>
        </button>
      </div>
    );
  }

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl max-h-full overflow-auto">
          <MiniCalculator
            formula={formula}
            onClose={toggleFullscreen}
            showSteps={showSteps}
          />
        </div>
      </div>
    );
  }

  // Expandable widget
  if (isExpanded) {
    return (
      <div className={`border rounded-lg bg-background shadow-lg overflow-hidden ${className}`}>
        <div className="bg-info/10 border-b border-info/20 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Interactive Calculator</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleFullscreen}
                className="p-1 text-primary hover:text-primary/80 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleExpanded}
                className="p-1 text-primary hover:text-primary/80 transition-colors"
                title="Close"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <MiniCalculator
            formula={formula}
            compact={false}
            showSteps={showSteps}
          />
        </div>
      </div>
    );
  }

  // Collapsed button trigger
  return (
    <button
      onClick={toggleExpanded}
      className={`flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors ${className}`}
    >
      <Calculator className="w-4 h-4" />
      <span>Try This Formula</span>
    </button>
  );
}

/**
 * Calculator Widget Manager
 * Manages multiple calculator widgets on a page
 */
export interface CalculatorWidgetManagerProps {
  formulas: FormulaRegistryEntry[];
  maxConcurrent?: number;
  className?: string;
}

export function CalculatorWidgetManager({
  formulas,
  maxConcurrent = 3,
  className = ''
}: CalculatorWidgetManagerProps) {
  const [activeWidgets, setActiveWidgets] = useState<Set<string>>(new Set());

  const toggleWidget = (formulaId: string) => {
    setActiveWidgets(prev => {
      const newSet = new Set(prev);
      
      if (newSet.has(formulaId)) {
        newSet.delete(formulaId);
      } else {
        // Check if we've reached the max concurrent limit
        if (newSet.size >= maxConcurrent) {
          // Remove the first (oldest) widget
          const firstWidget = Array.from(newSet)[0];
          newSet.delete(firstWidget);
        }
        newSet.add(formulaId);
      }
      
      return newSet;
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Widget Triggers */}
      <div className="flex flex-wrap gap-2">
        {formulas.map(formula => (
          <button
            key={formula.id}
            onClick={() => toggleWidget(formula.id)}
            className={`
              flex items-center space-x-2 px-3 py-2 text-sm rounded border transition-colors
              ${activeWidgets.has(formula.id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-primary border-primary hover:bg-info/10'
              }
            `}
          >
            <Calculator className="w-4 h-4" />
            <span>{formula.name}</span>
            {activeWidgets.has(formula.id) && <X className="w-3 h-3" />}
          </button>
        ))}
      </div>

      {/* Active Widgets */}
      <div className="space-y-4">
        {Array.from(activeWidgets).map(formulaId => {
          const formula = formulas.find(f => f.id === formulaId);
          if (!formula) return null;

          return (
            <CalculatorWidget
              key={formulaId}
              formula={formula}
              trigger="inline"
              defaultExpanded={true}
              showSteps={true}
            />
          );
        })}
      </div>

      {/* Status */}
      {activeWidgets.size > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          {activeWidgets.size} of {maxConcurrent} calculators active
        </div>
      )}
    </div>
  );
}