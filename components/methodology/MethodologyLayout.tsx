/**
 * Methodology Layout Component
 * Main layout for displaying calculator methodology with navigation
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calculator, 
  Search, 
  Filter,
  Download,
  Share,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { FormulaRegistryEntry, FormulaCategory } from '@/lib/formulas/types';
import { FormulaCategory as FormulaCategoryComponent, CategorySummary } from './FormulaCategory';

export interface MethodologyLayoutProps {
  calculatorName: string;
  title: string;
  description?: string;
  formulas: {
    core: FormulaRegistryEntry[];
    intermediate: FormulaRegistryEntry[];
    advanced: FormulaRegistryEntry[];
    assumptions: FormulaRegistryEntry[];
  };
  metadata?: {
    totalFormulas: number;
    lastUpdated: string;
    validationStatus: {
      validated: number;
      total: number;
    };
  };
  onFormulaSelect?: (formula: FormulaRegistryEntry) => void;
  onMiniCalculatorOpen?: (formula: FormulaRegistryEntry) => void;
  onBackToCalculator?: () => void;
}

const CATEGORY_INFO: Record<FormulaCategory, { title: string; order: number }> = {
  core: { title: 'Core Formulas', order: 1 },
  intermediate: { title: 'Intermediate Calculations', order: 2 },
  advanced: { title: 'Advanced Models', order: 3 },
  assumptions: { title: 'Constants & Assumptions', order: 4 }
};

export function MethodologyLayout({
  calculatorName,
  title,
  description,
  formulas,
  metadata,
  onFormulaSelect,
  onMiniCalculatorOpen,
  onBackToCalculator
}: MethodologyLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FormulaCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');

  // Calculate totals
  const totalFormulas = Object.values(formulas).reduce((sum, categoryFormulas) => 
    sum + categoryFormulas.length, 0
  );

  // Filter formulas based on search and category
  const filteredFormulas = React.useMemo(() => {
    const allFormulas = Object.entries(formulas).flatMap(([category, categoryFormulas]) =>
      categoryFormulas.map(formula => ({ ...formula, category: category as FormulaCategory }))
    );

    let filtered = allFormulas;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(formula =>
        formula.name.toLowerCase().includes(query) ||
        formula.description.toLowerCase().includes(query) ||
        formula.purpose.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(formula => formula.category === selectedCategory);
    }

    // Group back by category
    const grouped = {
      core: filtered.filter(f => f.category === 'core'),
      intermediate: filtered.filter(f => f.category === 'intermediate'),
      advanced: filtered.filter(f => f.category === 'advanced'),
      assumptions: filtered.filter(f => f.category === 'assumptions')
    };

    return grouped;
  }, [formulas, searchQuery, selectedCategory]);

  // Category summary data
  const categorySummary = Object.entries(CATEGORY_INFO)
    .sort(([,a], [,b]) => a.order - b.order)
    .map(([category, info]) => ({
      category: category as FormulaCategory,
      title: info.title,
      count: formulas[category as FormulaCategory]?.length || 0,
      validated: formulas[category as FormulaCategory]?.filter(f => f.validated).length || 0
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
            
            {description && (
              <p className="text-gray-700 mb-4 max-w-3xl">{description}</p>
            )}

            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4" />
                <span>{totalFormulas} formulas</span>
              </div>
              
              {metadata?.validationStatus && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>
                    {metadata.validationStatus.validated}/{metadata.validationStatus.total} validated
                  </span>
                </div>
              )}
              
              {metadata?.lastUpdated && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Updated {new Date(metadata.lastUpdated).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {onBackToCalculator && (
              <button
                onClick={onBackToCalculator}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Calculator className="w-4 h-4" />
                <span>Back to Calculator</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Summary */}
      <CategorySummary categories={categorySummary} />

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search formulas, variables, or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FormulaCategory | 'all')}
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_INFO)
                .sort(([,a], [,b]) => a.order - b.order)
                .map(([category, info]) => (
                  <option key={category} value={category}>
                    {info.title}
                  </option>
                ))
              }
            </select>
          </div>

          {/* View Mode */}
          <div className="flex items-center space-x-2 border rounded-lg p-1">
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'compact'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Compact
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {(searchQuery || selectedCategory !== 'all') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {Object.values(filteredFormulas).reduce((sum, arr) => sum + arr.length, 0)} results
              {searchQuery && ` for "${searchQuery}"`}
              {selectedCategory !== 'all' && ` in ${CATEGORY_INFO[selectedCategory].title}`}
            </span>
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Formula Categories */}
      <div className="space-y-6">
        {Object.entries(CATEGORY_INFO)
          .sort(([,a], [,b]) => a.order - b.order)
          .map(([category, info]) => {
            const categoryFormulas = filteredFormulas[category as FormulaCategory];
            
            if (categoryFormulas.length === 0 && (searchQuery || selectedCategory !== 'all')) {
              return null; // Hide empty categories when filtering
            }

            return (
              <FormulaCategoryComponent
                key={category}
                title={info.title}
                category={category as FormulaCategory}
                formulas={categoryFormulas}
                defaultExpanded={selectedCategory === category || selectedCategory === 'all'}
                compact={viewMode === 'compact'}
                showSearch={false} // We have global search
                onFormulaClick={onFormulaSelect}
                onMiniCalculatorOpen={onMiniCalculatorOpen}
              />
            );
          })
        }
      </div>

      {/* No Results */}
      {Object.values(filteredFormulas).every(arr => arr.length === 0) && (searchQuery || selectedCategory !== 'all') && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No formulas found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search terms or category filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Show All Formulas
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t pt-6 mt-12">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            This methodology page is automatically generated from the calculator&apos;s source code.
          </div>
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 hover:text-gray-900 transition-colors">
              <Share className="w-4 h-4" />
              <span>Share</span>
            </button>
            <button className="flex items-center space-x-2 hover:text-gray-900 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}