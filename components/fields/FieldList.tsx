'use client';

/**
 * FieldList
 * Renders a 'list' FieldSpec: one card per row with the row's fields, a
 * remove button (with an inline confirmation when spec.confirmRemove returns
 * a message), an add button, the empty text, and optional row adornment and
 * footer renderers.
 *
 * Row fields are rendered with a row-scoped reader (relative paths such as
 * 'balance' resolve against 'debts.0'), and their writes are re-addressed to
 * absolute paths ('debts.0.balance'). Row errors are read from `errors` by
 * absolute path. Removing a row writes the shortened list first, then
 * spec.removeRow's cascading writes (computed against the values before the
 * removal).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTestId, joinPath, rowFieldPath, rowGet } from '@/lib/fields/paths';
import type { FieldErrors, FieldSpec, Get, Write } from '@/lib/fields/types';
import { cn } from '@/lib/utils';
import { FieldInput, fieldElementId } from './FieldInput';
import type { CustomRenderers, FieldSize } from './types';

export interface FieldListProps {
  spec: FieldSpec;
  get: Get;
  onWrite: (writes: Write[]) => void;
  errors: FieldErrors;
  renderers?: CustomRenderers;
  size?: FieldSize;
  /** Prefix for element ids (default 'field'). */
  idPrefix?: string;
  /** Visually hide the list heading (a screen heading already names it). */
  hideLabel?: boolean;
}

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function rowKey(row: Row, index: number): string {
  return typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : `row-${index}`;
}

/** Writes relative to a row are re-addressed to the row ('balance' -> 'debts.0.balance'). */
function rowWrites(listPath: string, index: number, writes: readonly Write[]): Write[] {
  return writes.map((write) => ({ path: joinPath(listPath, index, write.path), value: write.value }));
}

export function FieldList({
  spec,
  get,
  onWrite,
  errors,
  renderers,
  size = 'md',
  idPrefix = 'field',
  hideLabel = false,
}: FieldListProps) {
  const rows = asRows(get(spec.path));
  const listId = fieldElementId(idPrefix, spec.path);
  const headingId = `${listId}-heading`;
  const [confirming, setConfirming] = useState<number | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const canAdd = spec.maxRows === undefined || rows.length < spec.maxRows;
  const canRemove = spec.minRows === undefined || rows.length > spec.minRows;
  const listError = errors[spec.path];

  // After adding a row, move focus to its first control once it renders.
  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    const container = rowRefs.current[index];
    if (!container) return;
    pendingFocus.current = null;
    container.querySelector<HTMLElement>('input, select, button[role="radio"]')?.focus();
  });

  const addRow = () => {
    const row = spec.newRow ? spec.newRow(get) : {};
    onWrite([{ path: spec.path, value: [...rows, row] }]);
    pendingFocus.current = rows.length;
  };

  const removeRow = (index: number) => {
    setConfirming(null);
    const cascade = spec.removeRow ? spec.removeRow(get, index) : [];
    onWrite([{ path: spec.path, value: rows.filter((_row, i) => i !== index) }, ...cascade]);
  };

  const requestRemove = (index: number) => {
    const message = spec.confirmRemove?.(rows[index], index) ?? null;
    if (message) setConfirming(index);
    else removeRow(index);
  };

  const adornment = spec.rowAdornment ? renderers?.[spec.rowAdornment] : undefined;
  const footer = spec.footer ? renderers?.[spec.footer] : undefined;

  return (
    <section aria-labelledby={headingId} className="space-y-3" data-testid={spec.testId?.includes('{i}') ? undefined : spec.testId}>
      <h3
        id={headingId}
        className={cn('font-medium', size === 'lg' ? 'text-base' : 'text-sm', hideLabel && 'sr-only')}
      >
        {spec.label}
      </h3>

      {rows.length === 0 && spec.emptyText && (
        <p className="text-sm text-muted-foreground">{spec.emptyText}</p>
      )}

      {rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((row, index) => {
            const label = spec.itemLabel ? spec.itemLabel(row, index) : `${spec.label} ${index + 1}`;
            const getRow = rowGet(get, spec.path, index);
            const writeRow = (writes: Write[]) => onWrite(rowWrites(spec.path, index, writes));
            const rowPrefix = `${listId}-${index}`;
            const rowTestId = spec.testId?.includes('{i}') ? formatTestId(spec.testId, index) : undefined;
            return (
              <li
                key={rowKey(row, index)}
                ref={(node) => {
                  rowRefs.current[index] = node;
                }}
                aria-label={label}
                data-testid={rowTestId}
                className="space-y-3 rounded-lg border border-border bg-background p-3 sm:p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
                  {canRemove && confirming !== index && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => requestRemove(index)}
                      aria-label={`Remove ${label}`}
                      className="min-h-11 min-w-11 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                {confirming === index && (
                  <div role="alert" className="space-y-2 rounded-md border border-border bg-muted/50 p-3">
                    <p className="text-sm text-foreground">{spec.confirmRemove?.(row, index)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="destructive" size="sm" className="min-h-11" onClick={() => removeRow(index)}>
                        Remove
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(spec.row ?? []).map((rowSpec) => (
                    <FieldInput
                      key={rowSpec.path}
                      spec={rowSpec.testId ? { ...rowSpec, testId: formatTestId(rowSpec.testId, index) } : rowSpec}
                      get={getRow}
                      onWrite={writeRow}
                      error={errors[rowFieldPath(spec.path, index, rowSpec.path)]}
                      errors={errors}
                      size={size}
                      renderers={renderers}
                      idPrefix={rowPrefix}
                    />
                  ))}
                </div>

                {adornment &&
                  React.createElement(adornment, {
                    spec,
                    get,
                    value: row,
                    onWrite,
                    errors,
                    size,
                    idPrefix: rowPrefix,
                    rowIndex: index,
                  })}
              </li>
            );
          })}
        </ol>
      )}

      {listError && (
        <p className="text-xs text-destructive" role="alert">
          {listError}
        </p>
      )}

      {canAdd && (
        <Button type="button" variant="outline" onClick={addRow} className="min-h-11 w-full sm:w-auto">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {spec.addLabel ?? 'Add'}
        </Button>
      )}

      {footer && React.createElement(footer, { spec, get, value: rows, onWrite, errors, size, idPrefix: listId })}
    </section>
  );
}

export default FieldList;
