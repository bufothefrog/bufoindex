'use client';

/**
 * The compact account list (renderer id 'accounts', the shared ACCOUNTS
 * field of lib/fields/shared.ts), used by the retirement, portfolio and
 * leverage forms and every intake that asks the accounts screen.
 *
 * - Each account is one line: kind label, name (when set) and value. The
 *   value is an inline balance input while the account's holdings are worth
 *   0, otherwise read-only ("$10,050 from 2 holdings"). An account that
 *   holds the emergency fund carries the tag "Emergency fund"; a suggested
 *   account (an answered yes with no account of its kind yet) shows a blank
 *   balance input.
 * - Edit reveals the kind, the name, the emergency fund tick (brokerage
 *   only), "List holdings instead" or "Use one balance instead", and Remove.
 * - Add account appends an account of the chosen kind.
 *
 * Every change goes through the pure account actions of
 * lib/calculators/portfolio/accountWrites.ts, which write whole lists; the
 * store or the wizard then marks the written lists answered. The get passed
 * in is derived (useCalculatorValues or the wizard), so the emergency fund
 * the actions copy is the value the visitor sees.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldMessages, fieldMessageIds } from '@/components/ui/FieldMessages';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/inputs';
import { SelectInput } from '@/components/shared/inputs/SelectInput';
import type { CustomRendererProps, CustomRenderers } from '@/components/fields/types';
import {
  addAccountRow,
  listHoldingsInstead,
  removeAccountRow,
  setAccountBalance,
  setAccountField,
  setHoldsEmergencyFund,
  // Not a React hook: renamed so the hooks lint rule does not read it as one.
  useOneBalanceInstead as oneBalanceWrites,
} from '@/lib/calculators/portfolio/accountWrites';
import { HAS_401K, HSA_ELIGIBLE, IRA_ROTH, IRA_TRADITIONAL } from '@/lib/calculators/paycheck/fields';
import { ACCOUNT_KIND_LABELS, ACCOUNT_KIND_OPTIONS } from '@/lib/constants/labels';
import { ACCOUNTS_RENDERER, TAXABLE_MONTHLY } from '@/lib/fields/shared';
import type { Get, Write } from '@/lib/fields/types';
import { formatCount, formatCurrency } from '@/lib/format';
import {
  ACCOUNT_PATHS,
  accountDisplayName,
  accountLabels,
  accountsInEffect,
  answeredPaths,
  holdingsOf,
  holdingsValue,
  isEmergencyFundAccount,
  type AccountKind,
  type AccountRow,
} from '@/lib/profile/accounts';
import { cn } from '@/lib/utils';

/** The answer whose Yes suggests an account of each kind (lib/profile/accounts.ts, section 3 of the PR 4 contract). */
const SEED_LABEL: Readonly<Partial<Record<AccountKind, string>>> = {
  '401k': HAS_401K.label,
  'roth-401k': HAS_401K.label,
  'traditional-ira': IRA_TRADITIONAL.label,
  'roth-ira': IRA_ROTH.label,
  hsa: HSA_ELIGIBLE.label,
  brokerage: TAXABLE_MONTHLY.label,
};

/** The 401(k) kinds share one suggestion. */
function kindGroup(kind: AccountKind): readonly AccountKind[] {
  return kind === '401k' || kind === 'roth-401k' ? ['401k', 'roth-401k'] : [kind];
}

/** A get that reads `writes` over `get`, with the written lists answered (as the store and the wizard mark them). */
function getAfter(get: Get, writes: readonly Write[]): Get {
  const written = new Map(writes.map((w) => [w.path, w.value]));
  return (path) => {
    if (path === ACCOUNT_PATHS.provided) return [...answeredPaths(get), ...written.keys()];
    return written.has(path) ? written.get(path) : get(path);
  };
}

/**
 * The confirm text of Remove: "Delete <name>? Its holdings will be removed
 * too.", plus, when an empty account of the same kind would be suggested
 * again (its answer is still Yes), the sentence that says so.
 */
export function removeAccountMessage(get: Get, account: AccountRow, writes: readonly Write[]): string {
  const base = `Delete ${accountDisplayName(account)}? Its holdings will be removed too.`;
  const group = kindGroup(account.kind);
  const suggested = accountsInEffect(getAfter(get, writes)).suggested.find((row) => group.includes(row.kind));
  const seed = suggested ? SEED_LABEL[suggested.kind] : undefined;
  if (!suggested || !seed) return base;
  return `${base} An empty ${ACCOUNT_KIND_LABELS[suggested.kind]} row stays while you answer Yes to '${seed}'.`;
}

const KIND_CHOICES = ACCOUNT_KIND_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

function holdingsText(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'holding' : 'holdings'}`;
}

interface AccountLineProps {
  account: AccountRow;
  /** The row's name for its controls' accessible names, distinct across the list (accountLabels). */
  label: string;
  suggested: boolean;
  get: Get;
  onWrite(writes: Write[]): void;
  open: boolean;
  onToggle(): void;
  onRemoved(): void;
  idPrefix: string;
  large: boolean;
}

/** One account: the compact line, and its editor while open. */
function AccountLine({ account, label, suggested, get, onWrite, open, onToggle, onRemoved, idPrefix, large }: AccountLineProps) {
  const name = accountDisplayName(account);
  const kindLabel = ACCOUNT_KIND_LABELS[account.kind];
  const ownName = account.name.trim();
  const count = holdingsOf(get, account.id).length;
  const held = holdingsValue(get, account.id);
  const editorId = `${idPrefix}-${account.id}-edit`;
  const write = (writes: Write[]) => {
    if (writes.length > 0) onWrite(writes);
  };

  const remove = () => {
    const writes = removeAccountRow(get, account.id);
    if (writes.length > 0 && window.confirm(removeAccountMessage(get, account, writes))) {
      onWrite(writes);
      onRemoved();
    }
  };
  const oneBalance = () => {
    if (window.confirm(`Remove the holdings of ${name}? Its balance is used again.`)) {
      write(oneBalanceWrites(get, account.id));
    }
  };

  return (
    <li className="space-y-3 rounded-lg border border-border bg-background p-3" data-testid={`account-${account.id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <p className={cn(large ? 'text-base' : 'text-sm', 'font-medium text-foreground')}>{kindLabel}</p>
          {ownName && <p className="truncate text-sm text-muted-foreground">{ownName}</p>}
          {isEmergencyFundAccount(account) && (
            <span className="mt-1 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Emergency fund
            </span>
          )}
        </div>
        <div className="w-full min-w-0 sm:w-44">
          {held > 0 ? (
            <p className="text-sm font-medium tabular-nums text-foreground">{`${formatCurrency(held)} from ${holdingsText(count)}`}</p>
          ) : (
            <MoneyInput
              name={`${idPrefix}-${account.id}-balance`}
              label=""
              ariaLabel={`${label} balance`}
              value={suggested ? null : account.balance}
              showZero={!suggested}
              onChange={(value) => write(setAccountBalance(get, account.id, value))}
              min={0}
              size={large ? 'lg' : 'md'}
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={editorId}
          aria-label={`${open ? 'Done editing' : 'Edit'} ${label}`}
          className="min-h-11 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {open ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
          {open ? 'Done' : 'Edit'}
        </Button>
      </div>

      {open && (
        <div id={editorId} className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <SelectInput
            name={`${idPrefix}-${account.id}-kind`}
            label="Kind"
            value={account.kind}
            // An account with holdings cannot become cash (setAccountField refuses it), so cash is not offered.
            options={KIND_CHOICES.filter((option) => count === 0 || option.value !== 'cash')}
            onChange={(kind) => write(setAccountField(get, account.id, { kind: kind as AccountKind }))}
          />
          <div className="space-y-2">
            <label htmlFor={`${idPrefix}-${account.id}-name`} className="text-sm font-medium leading-none">
              Account name
            </label>
            <Input
              id={`${idPrefix}-${account.id}-name`}
              value={account.name}
              maxLength={40}
              onChange={(event) => write(setAccountField(get, account.id, { name: event.target.value }))}
              data-testid={`account-name-${account.id}`}
            />
          </div>
          {account.kind === 'brokerage' && (
            <Checkbox
              name={`${idPrefix}-${account.id}-fund`}
              label="Holds my emergency fund"
              checked={account.holdsEmergencyFund}
              onChange={(on) => write(setHoldsEmergencyFund(get, account.id, on))}
              className="sm:col-span-2"
            />
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {count > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={oneBalance} className="min-h-11">
                Use one balance instead
              </Button>
            ) : (
              account.kind !== 'cash' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => write(listHoldingsInstead(get, account.id))}
                  className="min-h-11"
                >
                  List holdings instead
                </Button>
              )
            )}
            {!suggested && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                aria-label={`Remove ${label}`}
                className="min-h-11 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** The account list: one compact line per account in effect, then the suggested ones, and Add account. */
function AccountsEditor({ spec, get, onWrite, error, size }: CustomRendererProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const { describedBy } = fieldMessageIds(id, undefined, error);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<AccountKind>('brokerage');
  const large = size === 'lg';

  // The latest get, for an add that opens the new row's editor.
  const latest = useRef(get);
  useEffect(() => {
    latest.current = get;
  });

  const { rows, suggested } = accountsInEffect(get);
  const labels = accountLabels(get);
  const lines = [...rows.map((account) => ({ account, suggested: false })), ...suggested.map((account) => ({ account, suggested: true }))];

  const add = () => {
    const { writes, id: added } = addAccountRow(latest.current, newKind);
    onWrite(writes);
    setOpenId(added);
  };

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="space-y-3">
      <p id={labelId} className={cn(large ? 'text-base' : 'text-sm', 'font-medium leading-none')}>
        {spec.label}
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts yet.</p>
      ) : (
        <ul className="space-y-2" aria-labelledby={labelId}>
          {lines.map(({ account, suggested: isSuggested }) => (
            <AccountLine
              key={account.id}
              account={account}
              label={labels.get(account.id) ?? accountDisplayName(account)}
              suggested={isSuggested}
              get={get}
              onWrite={onWrite}
              open={openId === account.id}
              onToggle={() => setOpenId(openId === account.id ? null : account.id)}
              onRemoved={() => setOpenId(null)}
              idPrefix={id}
              large={large}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <SelectInput
            name={`${id}-new-kind`}
            label="New account kind"
            value={newKind}
            options={KIND_CHOICES}
            onChange={(kind) => setNewKind(kind as AccountKind)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add} className="min-h-10 gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {spec.addLabel ?? 'Add account'}
        </Button>
      </div>
      <FieldMessages id={id} error={error} />
    </div>
  );
}

/** The accounts renderer, spread into the retirement, portfolio and leverage renderers. */
export const ACCOUNTS_RENDERERS: CustomRenderers = {
  [ACCOUNTS_RENDERER]: AccountsEditor,
};
