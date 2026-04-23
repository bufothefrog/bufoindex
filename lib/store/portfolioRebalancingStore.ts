import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Account,
  AccountType,
  AssetClass,
  ClassTarget,
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_ASSET_CLASS,
  Holding,
  RebalanceInputsV2,
  RebalanceMode,
  RebalanceResultV2,
  Security,
  ValidationError,
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
} from '@/lib/calculations/portfolioRebalancing';
import {
  decodeRebalancingFromUrlHash,
  encodeRebalancingToUrlHash,
} from '@/lib/utils/portfolioRebalancingState';

function makeId(prefix: 'sec' | 'acc' | 'hld'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAccount(name: string, accountType: AccountType = DEFAULT_ACCOUNT_TYPE): Account {
  return { id: makeId('acc'), name, accountType, deposit: 0 };
}

/**
 * Worked-example seed state. A cold visitor lands on a realistic three-fund
 * portfolio split across a Roth IRA and a taxable brokerage, with classic
 * 60/25/15 targets. Users can edit every field or delete holdings/accounts
 * outright — the point is that the form is non-empty on arrival so the flow
 * is self-explanatory.
 *
 * Stable string ids keep SSR and hydration consistent; dynamically-added
 * accounts/holdings/securities still use `makeId` so their ids are unique.
 */
function defaultInputs(): RebalanceInputsV2 {
  return {
    setupMode: 'multi-shared',
    securities: [
      { id: 'sec-vti', ticker: 'VTI', name: 'Vanguard Total US Stock', price: 250, assetClass: 'us-stock' },
      { id: 'sec-vxus', ticker: 'VXUS', name: 'Vanguard Total Intl Stock', price: 60, assetClass: 'intl-stock' },
      { id: 'sec-bnd', ticker: 'BND', name: 'Vanguard Total Bond', price: 75, assetClass: 'bonds' },
    ],
    accounts: [
      { id: 'acc-roth', name: 'Roth IRA', accountType: 'tax-free', deposit: 500 },
      { id: 'acc-brok', name: 'Brokerage', accountType: 'taxable', deposit: 1500 },
    ],
    holdings: [
      { id: 'hld-roth-vti', accountId: 'acc-roth', securityId: 'sec-vti', shares: 10 },
      { id: 'hld-roth-bnd', accountId: 'acc-roth', securityId: 'sec-bnd', shares: 5 },
      { id: 'hld-brok-vti', accountId: 'acc-brok', securityId: 'sec-vti', shares: 20 },
      { id: 'hld-brok-vxus', accountId: 'acc-brok', securityId: 'sec-vxus', shares: 15 },
    ],
    classTargets: [
      { accountId: null, assetClass: 'us-stock', target: 0.6 },
      { accountId: null, assetClass: 'intl-stock', target: 0.25 },
      { accountId: null, assetClass: 'bonds', target: 0.15 },
    ],
    allowTaxableSelling: false,
    showPlacementAdvice: true,
    mode: 'whole',
  };
}

let hashUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

function clearUrlHash() {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

function scheduleHashUpdate(inputs: RebalanceInputsV2) {
  if (typeof window === 'undefined') return;
  if (hashUpdateTimeout) clearTimeout(hashUpdateTimeout);

  hashUpdateTimeout = setTimeout(() => {
    const hash = encodeRebalancingToUrlHash(inputs);
    if (hash) {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, 300);
}

interface StoreState {
  inputs: RebalanceInputsV2;
  result: RebalanceResultV2 | null;
  errors: ValidationError[];
  hasCalculatedOnce: boolean;

  addSecurity: () => string;
  updateSecurity: (id: string, patch: Partial<Omit<Security, 'id'>>) => void;
  removeSecurity: (id: string) => void;

  addAccount: () => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void;
  removeAccount: (id: string) => void;

  addHolding: (accountId?: string) => void;
  updateHolding: (id: string, patch: Partial<Omit<Holding, 'id'>>) => void;
  removeHolding: (id: string) => void;

  setClassTarget: (assetClass: AssetClass, target: number) => void;

  setAllowTaxableSelling: (value: boolean) => void;
  setMode: (mode: RebalanceMode) => void;

  calculate: () => void;
  loadFromUrl: () => void;
  reset: () => void;
}

function postMutate(get: () => StoreState) {
  const { hasCalculatedOnce, inputs } = get();
  if (hasCalculatedOnce) get().calculate();
  scheduleHashUpdate(inputs);
}

function clamp01(value: number): number {
  if (!isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const usePortfolioRebalancingStore = create<StoreState>()(
  devtools(
    (set, get) => ({
      inputs: defaultInputs(),
      result: null,
      errors: [],
      hasCalculatedOnce: false,

      addSecurity: () => {
        const id = makeId('sec');
        set(state => ({
          inputs: {
            ...state.inputs,
            securities: [
              ...state.inputs.securities,
              {
                id,
                ticker: '',
                price: 0,
                assetClass: DEFAULT_ASSET_CLASS,
              },
            ],
          },
        }));
        postMutate(get);
        return id;
      },

      updateSecurity: (id, patch) => {
        set(state => ({
          inputs: {
            ...state.inputs,
            securities: state.inputs.securities.map(s =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          },
        }));
        postMutate(get);
      },

      removeSecurity: (id) => {
        set(state => ({
          inputs: {
            ...state.inputs,
            securities: state.inputs.securities.filter(s => s.id !== id),
            holdings: state.inputs.holdings.filter(h => h.securityId !== id),
          },
        }));
        postMutate(get);
      },

      addAccount: () => {
        set(state => {
          const n = state.inputs.accounts.length + 1;
          return {
            inputs: {
              ...state.inputs,
              accounts: [...state.inputs.accounts, makeAccount(`Account ${n}`)],
            },
          };
        });
        postMutate(get);
      },

      updateAccount: (id, patch) => {
        set(state => ({
          inputs: {
            ...state.inputs,
            accounts: state.inputs.accounts.map(a =>
              a.id === id ? { ...a, ...patch } : a,
            ),
          },
        }));
        postMutate(get);
      },

      removeAccount: (id) => {
        set(state => {
          const remainingHoldings = state.inputs.holdings.filter(h => h.accountId !== id);
          // Garbage-collect securities no longer referenced by any holding.
          const referencedSecurities = new Set(remainingHoldings.map(h => h.securityId));
          return {
            inputs: {
              ...state.inputs,
              accounts: state.inputs.accounts.filter(a => a.id !== id),
              holdings: remainingHoldings,
              securities: state.inputs.securities.filter(s => referencedSecurities.has(s.id)),
            },
          };
        });
        postMutate(get);
      },

      addHolding: (accountId) => {
        set(state => {
          const resolvedAccountId = accountId ?? state.inputs.accounts[0]?.id ?? '';
          const securityId = makeId('sec');
          return {
            inputs: {
              ...state.inputs,
              securities: [
                ...state.inputs.securities,
                {
                  id: securityId,
                  ticker: '',
                  price: 0,
                  assetClass: DEFAULT_ASSET_CLASS,
                },
              ],
              holdings: [
                ...state.inputs.holdings,
                {
                  id: makeId('hld'),
                  accountId: resolvedAccountId,
                  securityId,
                  shares: 0,
                },
              ],
            },
          };
        });
        postMutate(get);
      },

      updateHolding: (id, patch) => {
        set(state => ({
          inputs: {
            ...state.inputs,
            holdings: state.inputs.holdings.map(h =>
              h.id === id ? { ...h, ...patch } : h,
            ),
          },
        }));
        postMutate(get);
      },

      removeHolding: (id) => {
        set(state => {
          const removed = state.inputs.holdings.find(h => h.id === id);
          const remainingHoldings = state.inputs.holdings.filter(h => h.id !== id);
          // Garbage-collect a security when its last referring holding is gone.
          let securities = state.inputs.securities;
          if (removed) {
            const stillReferenced = remainingHoldings.some(h => h.securityId === removed.securityId);
            if (!stillReferenced) {
              securities = securities.filter(s => s.id !== removed.securityId);
            }
          }
          return {
            inputs: {
              ...state.inputs,
              holdings: remainingHoldings,
              securities,
            },
          };
        });
        postMutate(get);
      },

      setClassTarget: (assetClass, target) => {
        const clamped = clamp01(target);
        set(state => {
          const existing = state.inputs.classTargets.findIndex(
            t => t.accountId === null && t.assetClass === assetClass,
          );
          const next: ClassTarget[] = [...state.inputs.classTargets];
          if (existing >= 0) {
            next[existing] = { accountId: null, assetClass, target: clamped };
          } else {
            next.push({ accountId: null, assetClass, target: clamped });
          }
          return { inputs: { ...state.inputs, classTargets: next } };
        });
        postMutate(get);
      },

      setAllowTaxableSelling: (value) => {
        set(state => ({
          inputs: { ...state.inputs, allowTaxableSelling: value },
        }));
        postMutate(get);
      },

      setMode: (mode) => {
        set(state => ({ inputs: { ...state.inputs, mode } }));
        postMutate(get);
      },

      calculate: () => {
        const { inputs } = get();
        const errors = validateRebalanceInputsV2(inputs);
        if (errors.length > 0) {
          set({ errors, result: null, hasCalculatedOnce: true });
          return;
        }
        try {
          const result = rebalancePortfolioV2(inputs);
          set({ result, errors: [], hasCalculatedOnce: true });
        } catch (e) {
          set({
            errors: [
              {
                field: 'calculation',
                message: e instanceof Error ? e.message : 'Calculation failed.',
              },
            ],
            result: null,
            hasCalculatedOnce: true,
          });
        }
      },

      loadFromUrl: () => {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash;
        if (!hash) return;
        const decoded = decodeRebalancingFromUrlHash(hash);
        if (!decoded) return;
        set({
          inputs: decoded,
          result: null,
          errors: [],
          hasCalculatedOnce: false,
        });
      },

      reset: () => {
        if (hashUpdateTimeout) {
          clearTimeout(hashUpdateTimeout);
          hashUpdateTimeout = null;
        }
        set({
          inputs: defaultInputs(),
          result: null,
          errors: [],
          hasCalculatedOnce: false,
        });
        clearUrlHash();
      },
    }),
    { name: 'portfolio-rebalancing-store-v2' },
  ),
);

export type { RebalanceInputsV2, RebalanceResultV2, Security, Account, Holding, ClassTarget };
