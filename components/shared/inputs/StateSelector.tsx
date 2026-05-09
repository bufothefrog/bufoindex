'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StateOption {
  code: string;
  name: string;
  hasIncomeTax: boolean;
  rate: number; // Marginal rate for middle income earners
}

// Complete list of US states and DC with 2025 tax rates
export const US_STATES: StateOption[] = [
  { code: 'AL', name: 'Alabama', hasIncomeTax: true, rate: 0.05 },
  { code: 'AK', name: 'Alaska', hasIncomeTax: false, rate: 0 },
  { code: 'AZ', name: 'Arizona', hasIncomeTax: true, rate: 0.042 },
  { code: 'AR', name: 'Arkansas', hasIncomeTax: true, rate: 0.055 },
  { code: 'CA', name: 'California', hasIncomeTax: true, rate: 0.093 },
  { code: 'CO', name: 'Colorado', hasIncomeTax: true, rate: 0.044 },
  { code: 'CT', name: 'Connecticut', hasIncomeTax: true, rate: 0.06 },
  { code: 'DE', name: 'Delaware', hasIncomeTax: true, rate: 0.052 },
  { code: 'DC', name: 'District of Columbia', hasIncomeTax: true, rate: 0.06 },
  { code: 'FL', name: 'Florida', hasIncomeTax: false, rate: 0 },
  { code: 'GA', name: 'Georgia', hasIncomeTax: true, rate: 0.0575 },
  { code: 'HI', name: 'Hawaii', hasIncomeTax: true, rate: 0.075 },
  { code: 'ID', name: 'Idaho', hasIncomeTax: true, rate: 0.058 },
  { code: 'IL', name: 'Illinois', hasIncomeTax: true, rate: 0.0495 },
  { code: 'IN', name: 'Indiana', hasIncomeTax: true, rate: 0.032 },
  { code: 'IA', name: 'Iowa', hasIncomeTax: true, rate: 0.0648 },
  { code: 'KS', name: 'Kansas', hasIncomeTax: true, rate: 0.057 },
  { code: 'KY', name: 'Kentucky', hasIncomeTax: true, rate: 0.045 },
  { code: 'LA', name: 'Louisiana', hasIncomeTax: true, rate: 0.0425 },
  { code: 'ME', name: 'Maine', hasIncomeTax: true, rate: 0.0715 },
  { code: 'MD', name: 'Maryland', hasIncomeTax: true, rate: 0.051 },
  { code: 'MA', name: 'Massachusetts', hasIncomeTax: true, rate: 0.05 },
  { code: 'MI', name: 'Michigan', hasIncomeTax: true, rate: 0.0425 },
  { code: 'MN', name: 'Minnesota', hasIncomeTax: true, rate: 0.0785 },
  { code: 'MS', name: 'Mississippi', hasIncomeTax: true, rate: 0.04 },
  { code: 'MO', name: 'Missouri', hasIncomeTax: true, rate: 0.054 },
  { code: 'MT', name: 'Montana', hasIncomeTax: true, rate: 0.0675 },
  { code: 'NE', name: 'Nebraska', hasIncomeTax: true, rate: 0.0564 },
  { code: 'NV', name: 'Nevada', hasIncomeTax: false, rate: 0 },
  { code: 'NH', name: 'New Hampshire', hasIncomeTax: false, rate: 0 },
  { code: 'NJ', name: 'New Jersey', hasIncomeTax: true, rate: 0.0637 },
  { code: 'NM', name: 'New Mexico', hasIncomeTax: true, rate: 0.049 },
  { code: 'NY', name: 'New York', hasIncomeTax: true, rate: 0.065 },
  { code: 'NC', name: 'North Carolina', hasIncomeTax: true, rate: 0.0475 },
  { code: 'ND', name: 'North Dakota', hasIncomeTax: true, rate: 0.0227 },
  { code: 'OH', name: 'Ohio', hasIncomeTax: true, rate: 0.0399 },
  { code: 'OK', name: 'Oklahoma', hasIncomeTax: true, rate: 0.05 },
  { code: 'OR', name: 'Oregon', hasIncomeTax: true, rate: 0.087 },
  { code: 'PA', name: 'Pennsylvania', hasIncomeTax: true, rate: 0.0307 },
  { code: 'RI', name: 'Rhode Island', hasIncomeTax: true, rate: 0.0475 },
  { code: 'SC', name: 'South Carolina', hasIncomeTax: true, rate: 0.06 },
  { code: 'SD', name: 'South Dakota', hasIncomeTax: false, rate: 0 },
  { code: 'TN', name: 'Tennessee', hasIncomeTax: false, rate: 0 },
  { code: 'TX', name: 'Texas', hasIncomeTax: false, rate: 0 },
  { code: 'UT', name: 'Utah', hasIncomeTax: true, rate: 0.0495 },
  { code: 'VT', name: 'Vermont', hasIncomeTax: true, rate: 0.066 },
  { code: 'VA', name: 'Virginia', hasIncomeTax: true, rate: 0.0575 },
  { code: 'WA', name: 'Washington', hasIncomeTax: false, rate: 0 },
  { code: 'WV', name: 'West Virginia', hasIncomeTax: true, rate: 0.054 },
  { code: 'WI', name: 'Wisconsin', hasIncomeTax: true, rate: 0.0627 },
  { code: 'WY', name: 'Wyoming', hasIncomeTax: false, rate: 0 }
];

interface StateSelectorProps {
  name?: string;
  label?: string;
  value: string;
  onChange: (stateCode: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  help?: string;
  error?: string;
}

export function StateSelector({ 
  name = "state",
  label,
  value, 
  onChange, 
  className, 
  placeholder = "Select state...",
  required = false,
  help,
  error
}: StateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedState = US_STATES.find(state => state.code === value);
  const displayValue = selectedState ? selectedState.name : '';

  // Filter states based on search term (prioritize exact code matches)
  const filteredStates = React.useMemo(() => {
    if (!searchTerm) return US_STATES;
    
    const term = searchTerm.toLowerCase();
    const exactCodeMatch = US_STATES.find(state => state.code.toLowerCase() === term);
    
    if (exactCodeMatch) {
      // If exact code match, show it first
      return [
        exactCodeMatch,
        ...US_STATES.filter(state => 
          state.code !== exactCodeMatch.code && (
            state.name.toLowerCase().includes(term) ||
            state.code.toLowerCase().includes(term)
          )
        )
      ];
    }
    
    // Otherwise, filter by both name and code
    return US_STATES.filter(state =>
      state.name.toLowerCase().includes(term) ||
      state.code.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(-1);
    
    // If exact match found, don't clear selection immediately
    const exactStateMatch = US_STATES.find(state => 
      state.name.toLowerCase() === term.toLowerCase() ||
      state.code.toLowerCase() === term.toLowerCase()
    );
    
    if (exactStateMatch) {
      onChange(exactStateMatch.code);
    } else if (term !== displayValue) {
      // Only clear if user is typing something different
      if (term.length > 0 && !displayValue.toLowerCase().includes(term.toLowerCase())) {
        onChange('');
      }
    }
  };

  // Handle state selection
  const handleStateSelect = (state: StateOption) => {
    onChange(state.code);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStates.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredStates.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredStates[highlightedIndex]) {
          handleStateSelect(filteredStates[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset search term when not focused
  const handleBlur = () => {
    // Small delay to allow for option clicks
    setTimeout(() => {
      if (!isOpen) {
        setSearchTerm('');
      }
    }, 150);
  };

  // Show search term or selected state name
  const inputValue = isOpen ? searchTerm : displayValue;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setSearchTerm('');
            }
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "w-full h-10 pl-10 pr-10 py-2 border border-input bg-background rounded-md text-sm",
            "focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring",
            "hover:border-ring/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-invalid={!!error}
        />
        <ChevronDown className={cn(
          "absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground transition-transform",
          isOpen && "rotate-180"
        )} aria-hidden="true" />
      </div>

      {isOpen && (
        <div
          className="absolute w-full mt-1 bg-popover border border-border rounded shadow-lg max-h-60 overflow-auto z-9999"
          onMouseDown={(e) => {
            // Prevent input blur when clicking dropdown
            e.preventDefault();
          }}
        >
          {filteredStates.length > 0 ? (
            <div role="listbox" id={listboxId}>
              {filteredStates.map((state, index) => (
                <button
                  key={state.code}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-sage-50 focus:bg-sage-50 focus:outline-hidden flex items-center justify-between transition-colors",
                    index === highlightedIndex && "bg-sage-100",
                    selectedState?.code === state.code && "bg-sage-200 text-sage-900 font-medium"
                  )}
                  onClick={() => handleStateSelect(state)}
                  role="option"
                  aria-selected={selectedState?.code === state.code}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="flex items-center space-x-2">
                    <span>{state.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({state.code})</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {state.hasIncomeTax ? `${(state.rate * 100).toFixed(1)}%` : 'No tax'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground italic">
              No states found matching &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      )}
      
      {help && !error && (
        <p className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
    </div>
  );
}