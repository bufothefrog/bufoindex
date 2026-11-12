'use client';

import React, { useEffect, useId, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { joinPath } from '@/lib/fields/paths';
import { isFieldVisible, listRows, resolveText, rowGet } from '@/lib/fields/runtime';
import type { FieldErrors, FieldSpec, Write } from '@/lib/fields/types';
import {
  PROFILE_LIST_PATHS,
  applyProfileWrites,
  getDefaultFinancialProfile,
  getProfileValue,
} from '@/lib/profile/defaults';
import { cn } from '@/lib/utils';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { CustomSlot } from './CustomSlot';
import { FieldMessages, fieldMessageIds } from '@/components/ui/FieldMessages';
import type { FieldInputProps, FieldListProps } from './types';

export interface FieldListBaseProps extends FieldListProps {
  /**
   * Renders one row field. FieldInput passes itself, so this module never
   * imports FieldInput (lists hold fields and fields hold lists; injecting
   * the renderer keeps that recursion out of the import graph).
   */
  renderField: React.ComponentType<FieldInputProps>;
}

/** '{i}' in a test id pattern becomes the row index. */
function rowTestId(pattern: string | undefined, index: number): string | undefined {
  return pattern?.split('{i}').join(String(index));
}

/** The errors under one row, keyed relative to it ('debts.0.balance' -> 'balance'). */
function rowErrors(errors: FieldErrors, rowPath: string): FieldErrors {
  const prefix = `${rowPath}.`;
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    if (path.startsWith(prefix)) out[path.slice(prefix.length)] = message;
  }
  return out;
}

/** A row's React key: its id when it has one (ids are unique), else its index. */
function rowKey(row: Record<string, unknown>, index: number): string {
  return typeof row.id === 'string' && row.id !== '' ? row.id : `row-${index}`;
}

/**
 * A row id no current row has: '<last path segment>-<n>'. Used when the spec
 * has no newRow, so Add still gives the profile store a row it accepts
 * (rows of lists such as debts and portfolio accounts need a non-empty id).
 */
function freshRowId(listPath: string, rows: readonly Record<string, unknown>[]): string {
  const base = listPath.split('.').pop() ?? 'row';
  const taken = new Set(rows.map((row) => row.id));
  let n = rows.length + 1;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const bareRowAccepted = new Map<string, boolean>();

/**
 * Whether the profile store keeps a row that has only an id at `listPath`.
 * Rows of debts, accounts, securities and custom asset classes take their
 * other fields from the row defaults; holdings (accountId, securityId) and
 * class targets (assetClass) need more, so a bare row would be dropped.
 * Paths outside the profile's lists are not checked.
 */
function acceptsBareRow(listPath: string): boolean {
  if (!(PROFILE_LIST_PATHS as readonly string[]).includes(listPath)) return true;
  let accepted = bareRowAccepted.get(listPath);
  if (accepted === undefined) {
    const { profile } = applyProfileWrites(getDefaultFinancialProfile(), [{ path: listPath, value: [{ id: 'row-1' }] }]);
    accepted = (getProfileValue(profile, listPath) as unknown[]).length === 1;
    bareRowAccepted.set(listPath, accepted);
  }
  return accepted;
}

/**
 * An editable list of rows (debts, portfolio accounts). Use FieldList
 * (exported from FieldInput.tsx and the components/fields index), which
 * renders row fields through FieldInput. Row fields are FieldSpecs relative
 * to the row; each row renders them through renderField with a row-scoped
 * Get, and their writes are rewritten to absolute paths.
 *
 * Writes (all through one onWrite call each):
 * - a row field change: '<list>.<i>.<field>', then the row spec's onChange
 *   writes, which are relative to the row like its Get;
 * - add: '<list>.<n>' = spec.newRow(get), appended at the end. newRow must
 *   give the row an id no other row has, or the profile store refuses the
 *   write. Without newRow the row is { id: freshRowId(...) }; the profile
 *   store fills the other fields from the list's row defaults (and drops the
 *   id for a list whose rows have none). A profile list whose rows need more
 *   than an id (portfolio.holdings, portfolio.classTargets) must have newRow:
 *   without it the list shows an alert in place of Add, a schema bug made
 *   visible as CustomSlot does for a missing renderer;
 * - remove: '<list>' = the rows without that one (indices stay canonical),
 *   then spec.removeRow(get, i), whose Get still sees the row being removed
 *   so a cascade can read its id.
 */
export function FieldListBase({
  spec,
  get,
  onWrite,
  errors,
  renderers,
  size = 'md',
  idPrefix = 'field',
  renderField: RowField,
}: FieldListBaseProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAdd = useRef(false);
  const rows = listRows(get(spec.path));
  const help = resolveText(spec.help, get);
  const error = errors[spec.path];
  const { describedBy } = fieldMessageIds(id, help, error);
  const minRows = spec.minRows ?? 0;
  const canAdd = spec.maxRows === undefined || rows.length < spec.maxRows;
  const canRemove = rows.length > minRows;
  const large = size === 'lg';
  const missingNewRow = !spec.newRow && !acceptsBareRow(spec.path);

  const add = () => {
    onWrite([{ path: joinPath(spec.path, rows.length), value: spec.newRow?.(get) ?? { id: freshRowId(spec.path, rows) } }]);
  };

  const remove = (index: number) => {
    const prompt = spec.confirmRemove?.(rows[index], index);
    if (prompt && !window.confirm(prompt)) return;
    onWrite([
      { path: spec.path, value: rows.filter((_, i) => i !== index) },
      ...(spec.removeRow?.(get, index) ?? []),
    ]);
    focusAdd.current = true;
  };

  // The removed row's button is gone; once the list re-renders without it,
  // focus moves to the add button (enabled again if maxRows had disabled it).
  useEffect(() => {
    if (!focusAdd.current) return;
    focusAdd.current = false;
    addRef.current?.focus();
  });

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="space-y-3">
      <p
        id={labelId}
        className={cn(large ? 'text-base' : 'text-sm', 'font-medium leading-none', error && 'text-destructive')}
      >
        {spec.label}
      </p>

      {rows.length === 0 && spec.emptyText && (
        <p className="text-sm text-muted-foreground">{spec.emptyText}</p>
      )}

      {rows.map((row, index) => {
        const rowPath = joinPath(spec.path, index);
        const scope = rowGet(get, spec.path, index);
        const scoped = rowErrors(errors, rowPath);
        const rowWrite = (writes: Write[]) =>
          onWrite(writes.map((w) => ({ path: joinPath(rowPath, w.path), value: w.value })));
        const rowLabel = spec.itemLabel?.(row, index) || `${spec.label} ${index + 1}`;
        return (
          <div
            key={rowKey(row, index)}
            role="group"
            aria-label={rowLabel}
            data-testid={rowTestId(spec.testId, index)}
            className="space-y-4 rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{rowLabel}</span>
              <div className="flex shrink-0 items-center gap-2">
                {spec.rowAdornment && (
                  <CustomSlot
                    rendererId={spec.rowAdornment}
                    renderers={renderers}
                    spec={spec}
                    get={scope}
                    value={row}
                    onWrite={rowWrite}
                    size={size}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={!canRemove}
                  aria-label={spec.removeLabel?.(row, index) ?? `Remove ${rowLabel}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(spec.row ?? []).map((rowSpec: FieldSpec) =>
                isFieldVisible(rowSpec, scope) ? (
                  <RowField
                    key={rowSpec.path}
                    spec={rowSpec.testId ? { ...rowSpec, testId: rowTestId(rowSpec.testId, index) } : rowSpec}
                    get={scope}
                    onWrite={rowWrite}
                    error={scoped[rowSpec.path]}
                    errors={scoped}
                    size={size}
                    renderers={renderers}
                    idPrefix={`${idPrefix}-${rowPath}`}
                  />
                ) : null
              )}
            </div>
          </div>
        );
      })}

      {spec.footer && (
        <CustomSlot
          rendererId={spec.footer}
          renderers={renderers}
          spec={spec}
          get={get}
          value={rows}
          onWrite={onWrite}
          size={size}
        />
      )}

      {missingNewRow ? (
        <StatusAlert tone="negative" appearance="tinted" role="alert" title="Missing newRow">
          {`The list "${spec.path}" needs a newRow: a row with only an id is not a valid row there.`}
        </StatusAlert>
      ) : (
        <Button
          ref={addRef}
          type="button"
          variant="outline"
          onClick={add}
          disabled={!canAdd}
          className={cn('gap-2', large && 'h-12 w-full text-base')}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {spec.addLabel ?? `Add to ${spec.label.toLowerCase()}`}
        </Button>
      )}

      <FieldMessages id={id} help={help} error={error} />
    </div>
  );
}

export default FieldListBase;
