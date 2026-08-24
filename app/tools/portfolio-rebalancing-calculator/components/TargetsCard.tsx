'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Target as TargetIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputCard } from '@/components/ui/cards/BaseCard';
import { PercentInput } from '@/components/ui/inputs';
import { usePortfolioRebalancingStore } from '@/lib/store/portfolioRebalancingStore';
import {
  AssetClass,
  BUILTIN_ASSET_CLASS_LABELS,
  BUILTIN_ASSET_CLASSES,
  ClassTarget,
  CustomAssetClass,
  Holding,
  Security,
  getAssetClassLabel,
} from '@/lib/calculations/portfolioRebalancing';
import { cn } from '@/lib/utils';

const DEFAULT_VISIBLE_CLASSES: AssetClass[] = ['us-stock', 'intl-stock', 'bonds', 'cash'];

/**
 * Asset classes to render rows for, in stable order:
 *   1. Built-in defaults (US / Intl / Bonds / Cash) — always visible.
 *   2. Any other built-in or custom class with an explicit class-target row
 *      OR a holding referencing it OR matching a registered custom class.
 *
 * Classes appear once each, with built-ins first (in their canonical order),
 * then customs (in registration order).
 */
function relevantClasses(
  holdings: Holding[],
  securities: Security[],
  classTargets: ClassTarget[],
  customAssetClasses: CustomAssetClass[],
): AssetClass[] {
  const securityClass = new Map(securities.map(s => [s.id, s.assetClass]));
  const shown = new Set<AssetClass>(DEFAULT_VISIBLE_CLASSES);

  holdings.forEach(h => {
    const cls = securityClass.get(h.securityId);
    if (cls) shown.add(cls);
  });

  classTargets.forEach(t => {
    if (t.accountId === null) shown.add(t.assetClass);
  });

  // Stable order: built-ins first, then customs in registration order.
  const ordered: AssetClass[] = [];
  for (const cls of BUILTIN_ASSET_CLASSES) {
    if (shown.has(cls)) ordered.push(cls);
  }
  for (const c of customAssetClasses) {
    if (shown.has(c.id) && !ordered.includes(c.id)) ordered.push(c.id);
  }
  // Catch-all for any straggler (e.g. orphan classTarget referencing a class
  // that's no longer registered as a custom).
  for (const cls of shown) {
    if (!ordered.includes(cls)) ordered.push(cls);
  }
  return ordered;
}

export function TargetsCard() {
  const securities = usePortfolioRebalancingStore(s => s.inputs.securities);
  const holdings = usePortfolioRebalancingStore(s => s.inputs.holdings);
  const classTargets = usePortfolioRebalancingStore(s => s.inputs.classTargets);
  const customAssetClasses = usePortfolioRebalancingStore(
    s => s.inputs.customAssetClasses ?? [],
  );
  const setClassTarget = usePortfolioRebalancingStore(s => s.setClassTarget);
  const removeAssetClass = usePortfolioRebalancingStore(s => s.removeAssetClass);

  const classes = useMemo(
    () => relevantClasses(holdings, securities, classTargets, customAssetClasses),
    [holdings, securities, classTargets, customAssetClasses],
  );

  const targetFor = (cls: AssetClass): number =>
    classTargets.find(t => t.accountId === null && t.assetClass === cls)?.target ?? 0;

  const sum = classes.reduce((acc, cls) => acc + targetFor(cls), 0);
  const sumPercent = sum * 100;
  const isBalanced = Math.abs(sum - 1) < 0.0001;

  const isClassRemovable = (cls: AssetClass): boolean => {
    // Don't allow removing a class that has live holdings — the user would
    // lose track of where those holdings are categorized.
    const hasHolding = holdings.some(h => {
      const sec = securities.find(s => s.id === h.securityId);
      return sec?.assetClass === cls;
    });
    return !hasHolding;
  };

  return (
    <InputCard title="Target Allocation" icon={TargetIcon}>
      <div className="space-y-3">
        <div className="space-y-2">
          {classes.map(cls => (
            <div
              key={cls}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 p-2.5 rounded border border-border/60 bg-background"
              data-testid={`target-row-portfolio-${cls}`}
            >
              <span className="text-sm font-medium">
                {getAssetClassLabel(cls, customAssetClasses)}
              </span>
              <div className="w-32" data-testid={`target-portfolio-${cls}`}>
                <PercentInput
                  name={`target-portfolio-${cls}`}
                  label=""
                  ariaLabel={`${getAssetClassLabel(cls, customAssetClasses)} target`}
                  value={targetFor(cls)}
                  onChange={value => setClassTarget(cls, value)}
                  min={0}
                  max={1}
                  precision={1}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const label = getAssetClassLabel(cls, customAssetClasses);
                  if (window.confirm(`Remove ${label} from your target allocation?`)) {
                    removeAssetClass(cls);
                  }
                }}
                disabled={!isClassRemovable(cls)}
                aria-label={`Remove ${getAssetClassLabel(cls, customAssetClasses)}`}
                data-testid={`target-remove-${cls}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <AddAssetClassControl shownClasses={classes} />

        <div
          className={cn(
            'flex items-center gap-2 text-sm font-medium tabular-nums pt-1',
            isBalanced ? 'text-sage-600 dark:text-sage-300' : 'text-destructive',
          )}
          data-testid="target-sum-portfolio"
        >
          {isBalanced ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          Targets total: {sumPercent.toFixed(1)}%
          {!isBalanced && (
            <span className="text-xs font-normal">(must equal 100%)</span>
          )}
        </div>
      </div>
    </InputCard>
  );
}

interface AddAssetClassControlProps {
  shownClasses: AssetClass[];
}

interface AssetClassOption {
  id: AssetClass;
  label: string;
  /** True for registered custom classes — useful if we ever distinguish styling. */
  custom: boolean;
}

/**
 * Combobox-style input for adding a new asset class to the target allocation.
 * Mirrors the ticker selector: clicking opens a list of available built-in
 * + custom classes; typing filters; pressing Enter (or blurring) on an
 * unmatched query creates a new custom class with that label.
 */
function AddAssetClassControl({ shownClasses }: AddAssetClassControlProps) {
  const customAssetClasses = usePortfolioRebalancingStore(
    s => s.inputs.customAssetClasses ?? [],
  );
  const ensureAssetClassVisible = usePortfolioRebalancingStore(
    s => s.ensureAssetClassVisible,
  );
  const addCustomAssetClass = usePortfolioRebalancingStore(s => s.addCustomAssetClass);

  const generatedId = useId();
  const inputId = `add-asset-class-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  // Focus stays on the input, so the highlighted option is announced through
  // aria-activedescendant rather than by moving focus into the list.
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available options: built-ins not yet shown + custom classes not yet shown.
  const availableOptions: AssetClassOption[] = useMemo(() => {
    const shown = new Set(shownClasses);
    const builtins: AssetClassOption[] = BUILTIN_ASSET_CLASSES
      .filter(c => !shown.has(c))
      .map(c => ({ id: c, label: BUILTIN_ASSET_CLASS_LABELS[c], custom: false }));
    const customs: AssetClassOption[] = customAssetClasses
      .filter(c => !shown.has(c.id))
      .map(c => ({ id: c.id, label: c.label, custom: true }));
    return [...builtins, ...customs];
  }, [shownClasses, customAssetClasses]);

  const query = draft.trim();
  const lowerQuery = query.toLowerCase();
  const filtered = query
    ? availableOptions.filter(o => o.label.toLowerCase().includes(lowerQuery))
    : availableOptions;

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const reset = () => {
    setDraft('');
    setOpen(false);
    setHighlighted(0);
  };

  const selectOption = (option: AssetClassOption) => {
    ensureAssetClassVisible(option.id);
    reset();
    inputRef.current?.blur();
  };

  const commitDraft = () => {
    if (!query) {
      reset();
      return;
    }
    // If the typed text exactly matches an existing option (built-in or
    // custom), pick that. Case-insensitive match against the label.
    const exact = availableOptions.find(o => o.label.toLowerCase() === lowerQuery);
    if (exact) {
      ensureAssetClassVisible(exact.id);
    } else {
      addCustomAssetClass(query);
    }
    reset();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted(h => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlighted]) {
        selectOption(filtered[highlighted]);
      } else {
        commitDraft();
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      reset();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="pt-1" ref={wrapperRef} data-testid="add-asset-class">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label="Add asset class"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[highlighted] ? optionId(highlighted) : undefined
          }
          value={draft}
          placeholder="Add asset class…"
          onFocus={() => setOpen(true)}
          onChange={e => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Defer so clicks on dropdown options fire first.
            setTimeout(() => {
              if (!wrapperRef.current) return;
              if (wrapperRef.current.contains(document.activeElement)) return;
              if (draft.trim()) {
                commitDraft();
              } else {
                setOpen(false);
              }
            }, 120);
          }}
          maxLength={40}
          data-testid="add-asset-class-input"
          className={cn(
            'w-full border bg-background rounded-md text-sm transition-colors',
            'focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring',
            'border-input hover:border-ring/50',
            'h-10 pl-9 pr-3',
          )}
        />
        <Plus className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        {open && (
          <ul
            id={listboxId}
            role="listbox"
            className={cn(
              'absolute z-20 mt-1 w-full max-h-56 overflow-auto',
              'rounded-md border border-border bg-popover shadow-md',
              'text-sm py-1',
            )}
          >
            {filtered.length === 0 && query && (
              <li
                role="option"
                aria-selected="true"
                onMouseDown={e => {
                  e.preventDefault();
                  commitDraft();
                }}
                data-testid="add-asset-class-create-option"
                className="px-3 py-1.5 cursor-pointer bg-sage-100 text-sage-800 dark:bg-sage-700/40 dark:text-sage-100"
              >
                Add custom class &ldquo;{query}&rdquo;
              </li>
            )}
            {filtered.length === 0 && !query && (
              <li className="px-3 py-1.5 text-muted-foreground">
                No more classes — type to add a custom one.
              </li>
            )}
            {filtered.map((opt, idx) => (
              <li
                key={opt.id}
                id={optionId(idx)}
                role="option"
                aria-selected={idx === highlighted}
                onMouseDown={e => {
                  e.preventDefault();
                  selectOption(opt);
                }}
                onMouseEnter={() => setHighlighted(idx)}
                data-testid={`add-asset-class-option-${opt.id}`}
                className={cn(
                  'flex items-center justify-between px-3 py-1.5 cursor-pointer',
                  idx === highlighted
                    ? 'bg-sage-100 text-sage-800 dark:bg-sage-700/40 dark:text-sage-100'
                    : 'text-foreground',
                )}
              >
                <span>{opt.label}</span>
                {opt.custom && (
                  <span className="text-xs text-muted-foreground">Custom</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
