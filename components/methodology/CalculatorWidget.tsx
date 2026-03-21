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
        <div className="bg-blue-50 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">Try This Formula</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleFullscreen}
                className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
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
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
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
      <div className={`border rounded-lg bg-white shadow-lg overflow-hidden ${className}`}>
        <div className="bg-blue-50 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">Interactive Calculator</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={toggleFullscreen}
                className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleExpanded}
                className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
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
      className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${className}`}
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
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
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
        <div className="text-sm text-gray-600 text-center">
          {activeWidgets.size} of {maxConcurrent} calculators active
        </div>
      )}
    </div>
  );
}