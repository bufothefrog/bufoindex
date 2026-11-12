'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TickerOption {
  id: string;
  ticker: string;
  price: number;
}

interface TickerComboboxProps {
  /** Current ticker string to show when the input isn't being edited. */
  value: string;
  /** Existing tickers the user can pick from. */
  options: TickerOption[];
  /** User clicked (or keyboard-selected) an existing option. */
  onSelectExisting: (id: string) => void;
  /**
   * User typed a ticker and committed (blur or Enter with no exact match).
   * The normalized (uppercased, trimmed) ticker is passed.
   */
  onCommitNewTicker: (ticker: string) => void;
  /** Id of the security currently linked to this holding, to hide it from the list. */
  currentId?: string;
  id?: string;
  testId?: string;
  placeholder?: string;
}

/**
 * Ticker input with an attached dropdown of existing securities. Clicking the
 * field opens the list; typing filters it; clicking an option links the
 * holding to that security and shows its ticker at once; Enter on a
 * highlighted option does the same. Typing a new ticker and leaving the field
 * (blur, Enter with nothing highlighted, or a click outside) creates a new
 * one (or renames the current security when it has no other references).
 * Each edit is reported once: the deferred blur commit is skipped after a
 * pick or an Enter.
 */
export function TickerCombobox({
  value,
  options,
  onSelectExisting,
  onCommitNewTicker,
  currentId,
  id,
  testId,
  placeholder = 'VTI',
}: TickerComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `ticker-combobox-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  // Focus stays on the input, so the highlighted option is announced through
  // aria-activedescendant rather than by moving focus into the list.
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Set when a pick or an Enter has already reported this edit. The deferred
  // blur commit reads it so it does not report the edit a second time with
  // the text its closure captured (which may be stale or partly typed).
  const handledRef = useRef(false);

  // Keep the visible text in sync with the external value when not editing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(value);
    }
  }, [value]);

  // Close when clicking outside. The draft is left alone: the blur that
  // follows the click commits a typed ticker (or reverts an empty one).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const query = draft.trim().toUpperCase();
  // If the draft still matches the external value, the user hasn't started
  // editing — treat focus as "browse mode" and show all other options.
  const effectiveQuery = query === value.trim().toUpperCase() ? '' : query;
  const filtered = options.filter(opt => {
    if (opt.id === currentId) return false;
    if (!effectiveQuery) return true;
    return opt.ticker.toUpperCase().includes(effectiveQuery);
  });

  const commit = () => {
    const normalized = draft.trim().toUpperCase();
    if (!normalized) {
      // Empty → revert.
      setDraft(value);
      return;
    }
    // If the typed ticker exactly matches an existing (other) option, treat
    // as an explicit select so callers don't double-handle renames.
    const exact = options.find(
      opt => opt.id !== currentId && opt.ticker.toUpperCase() === normalized,
    );
    if (exact) {
      onSelectExisting(exact.id);
    } else if (normalized !== value.toUpperCase()) {
      onCommitNewTicker(normalized);
    }
  };

  /** Show the picked ticker at once, report the pick, and close the list. */
  const selectOption = (opt: TickerOption) => {
    handledRef.current = true;
    setDraft(opt.ticker);
    setOpen(false);
    onSelectExisting(opt.id);
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
        commit();
        handledRef.current = true;
        setOpen(false);
      }
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlighted] ? optionId(highlighted) : undefined
        }
        value={draft}
        onFocus={() => {
          handledRef.current = false;
          setOpen(true);
        }}
        onChange={e => {
          handledRef.current = false;
          setDraft(e.target.value.toUpperCase());
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Defer so clicks on dropdown options fire first.
          setTimeout(() => {
            if (!wrapperRef.current) return;
            if (wrapperRef.current.contains(document.activeElement)) return;
            if (handledRef.current) {
              handledRef.current = false;
              return;
            }
            commit();
            setOpen(false);
          }, 120);
        }}
        placeholder={placeholder}
        maxLength={10}
        data-testid={testId}
        className={cn(
          'w-full border bg-background rounded-md text-sm transition-colors',
          'focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-ring',
          'border-input hover:border-ring/50',
          'h-10 pl-3 pr-3 uppercase font-mono tabular-nums',
        )}
      />
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute z-20 mt-1 w-full max-h-56 overflow-auto',
            'rounded-md border border-border bg-popover shadow-md',
            'text-sm py-1',
          )}
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt.id}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === highlighted}
              onMouseDown={e => {
                // mousedown fires before blur; preventDefault keeps focus on
                // the input, and selectOption marks the edit as reported so
                // the later blur does not commit again.
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              data-testid={`ticker-option-${opt.ticker.toLowerCase()}`}
              className={cn(
                'flex items-center justify-between px-3 py-1.5 cursor-pointer',
                'font-mono tabular-nums',
                idx === highlighted
                  ? 'bg-sage-100 text-sage-800 dark:bg-sage-700/40 dark:text-sage-100'
                  : 'text-foreground',
              )}
            >
              <span>{opt.ticker}</span>
              <span className="text-xs text-muted-foreground">
                ${opt.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
