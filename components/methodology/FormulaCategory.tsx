/**
 * Formula Category Component
 * Groups and displays formulas by category with filtering and search
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { FormulaRegistryEntry, type FormulaCategory } from '@/lib/formulas/types';
import { FormulaDisplay } from './FormulaDisplay';

export interface FormulaCategoryProps {
  title: string;
  category: FormulaCategory;
  formulas: FormulaRegistryEntry[];
  defaultExpanded?: boolean;
  compact?: boolean;
  showSearch?: boolean;
  onFormulaClick?: (formula: FormulaRegistryEntry) => void;
  onMiniCalculatorOpen?: (formula: FormulaRegistryEntry) => void;
}

const CATEGORY_DESCRIPTIONS: Record<FormulaCategory, string> = {
  core: 'Fundamental mathematical formulas that form the foundation of financial calculations',
  intermediate: 'More complex formulas that build upon core concepts for practical applications',
  advanced: 'Sophisticated calculations involving multiple variables and complex logic',
  assumptions: 'Constants, rates, and assumptions used throughout the calculations'
};

const CATEGORY_COLORS: Record<FormulaCategory, string> = {
  core: 'bg-blue-50 border-blue-200 text-blue-800',
  intermediate: 'bg-green-50 border-green-200 text-green-800',
  advanced: 'bg-purple-50 border-purple-200 text-purple-800',
  assumptions: 'bg-orange-50 border-orange-200 text-orange-800'
};

export function FormulaCategory({
  title,
  category,
  formulas,
  defaultExpanded = true,
  compact = false,
  showSearch = true,
  onFormulaClick,
  onMiniCalculatorOpen
}: FormulaCategoryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'complexity'>('name');

  // Filter and sort formulas
  const filteredFormulas = useMemo(() => {
    let filtered = formulas;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(formula =>
        formula.name.toLowerCase().includes(query) ||
        formula.description.toLowerCase().includes(query) ||
        formula.purpose.toLowerCase().includes(query)
      );
    }

    // Sort formulas
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        // Sort by complexity (number of variables as proxy)
        const aComplexity = Object.keys(a.variables || {}).length;
        const bComplexity = Object.keys(b.variables || {}).length;
        return aComplexity - bComplexity;
      }
    });
  }, [formulas, searchQuery, sortBy]);

  if (formulas.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Category Header */}
      <div className={`p-4 border-b ${CATEGORY_COLORS[category]}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold">{title}</h2>
            <span className="px-2 py-1 bg-background/50 rounded-full text-sm">
              {formulas.length} {formulas.length === 1 ? 'formula' : 'formulas'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {expanded ? (
              <ChevronUp className="w-5 h-5 group-hover:text-current transition-colors" />
            ) : (
              <ChevronDown className="w-5 h-5 group-hover:text-current transition-colors" />
            )}
          </div>
        </button>
        
        <p className="mt-2 text-sm opacity-90">
          {CATEGORY_DESCRIPTIONS[category]}
        </p>

        {/* Search and Filter Controls */}
        {expanded && showSearch && formulas.length > 3 && (
          <div className="mt-4 flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search formulas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-background/70 border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring placeholder-muted-foreground"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'complexity')}
                className="bg-background/70 border border-border rounded-md px-2 py-1 text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="name">Sort by Name</option>
                <option value="complexity">Sort by Complexity</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Formulas */}
      {expanded && (
        <div className="p-4">
          {filteredFormulas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No formulas found matching your search.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-primary hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className={compact ? 'grid gap-4 md:grid-cols-2' : 'space-y-6'}>
              {filteredFormulas.map((formula) => (
                <div
                  key={formula.id}
                  onClick={() => onFormulaClick?.(formula)}
                  className={onFormulaClick ? 'cursor-pointer' : ''}
                >
                  <FormulaDisplay
                    formula={formula}
                    compact={compact}
                    showExample={!compact}
                    showSources={!compact}
                    showAssumptions={!compact}
                    onMiniCalculatorOpen={onMiniCalculatorOpen}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed Summary */}
      {!expanded && filteredFormulas.length > 0 && (
        <div className="p-4 bg-muted/20">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredFormulas.length} formulas available
            </span>
            <span>
              Click to expand
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Summary component showing category statistics
 */
export interface CategorySummaryProps {
  categories: Array<{
    category: FormulaCategory;
    title: string;
    count: number;
    validated: number;
  }>;
}

export function CategorySummary({ categories }: CategorySummaryProps) {
  const totalFormulas = categories.reduce((sum, cat) => sum + cat.count, 0);
  const totalValidated = categories.reduce((sum, cat) => sum + cat.validated, 0);

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Formula Overview</h3>
        <div className="text-sm text-muted-foreground">
          {totalValidated}/{totalFormulas} validated
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map(({ category, title, count, validated }) => (
          <div
            key={category}
            className={`p-3 rounded-md border ${CATEGORY_COLORS[category]}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-sm font-medium">{title}</div>
            <div className="text-xs opacity-75">
              {validated} validated
            </div>
          </div>
        ))}
      </div>

      {totalFormulas > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span>Validation Progress</span>
          <span>{Math.round((totalValidated / totalFormulas) * 100)}%</span>
        </div>
      )}
    </div>
  );
}