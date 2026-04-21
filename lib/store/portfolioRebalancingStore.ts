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
  SetupMode,
  ValidationError,
  rebalancePortfolioV2,
  validateRebalanceInputsV2,
} from '@/lib/calculations/portfolioRebalancing';
import {
  decodeRebalancingFromUrlHash,
  encodeRebalancingToUrlHash,
} from '@/lib/utils/portfolioRebalancingState';

// ---------------------------------------------------------------------------
// Identifiers — short, collision-safe, prefixed so debug tools can distinguish.
// ---------------------------------------------------------------------------

function makeId(prefix: 'sec' | 'acc' | 'hld'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Default factories
// ---------------------------------------------------------------------------

/** A brand-new, blank v2 inputs object — nothing selected, no entries. */
function emptyInputs(): RebalanceInputsV2 {
  return {
    setupMode: 'single',
    securities: [],
    classTargets: [],
    accounts: [],
    holdings: [],
    allowTaxableSelling: false,
    showPlacementAdvice: false,
    mode: 'whole',
  };
}

function makeAccount(name: string, accountType: AccountType = DEFAULT_ACCOUNT_TYPE): Account {
  return { id: makeId('acc'), name, accountType, deposit: 0 };
}

function defaultsForMode(mode: SetupMode): RebalanceInputsV2 {
  const base = emptyInputs();
  base.setupMode = mode;

  if (mode === 'single') {
    base.accounts = [makeAccount('Brokerage')];
  } else {
    // multi-shared and multi-unique both start with two blank accounts so the
    // user has something to edit immediately.
    base.accounts = [makeAccount('Account 1'), makeAccount('Account 2')];
  }

  return base;
}

// ---------------------------------------------------------------------------
// Hash-update debounce (reused Phase 1 pattern)
// ---------------------------------------------------------------------------

let hashUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

function clearUrlHash() {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

function scheduleHashUpdate(inputs: RebalanceInputsV2, wizardDone: boolean) {
  if (typeof window === 'undefined') return;
  if (hashUpdateTimeout) clearTimeout(hashUpdateTimeout);

  // Mid-wizard state is not shareable.
  if (!wizardDone) return;

  hashUpdateTimeout = setTimeout(() => {
    const hash = encodeRebalancingToUrlHash(inputs);
    if (hash) {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, 300);
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export type WizardStep = 'mode' | 'targets-style' | 'done';

interface StoreStateV2 {
  // Wizard
  setupMode: SetupMode | null;
  wizardStep: WizardStep;
  setSetupMode: (mode: SetupMode) => void;
  setWizardStep: (step: WizardStep) => void;
  completeWizard: () => void;
  restartWizard: () => void;

  // Data
  inputs: RebalanceInputsV2;
  result: RebalanceResultV2 | null;
  errors: ValidationError[];
  hasCalculatedOnce: boolean;

  // Securities
  addSecurity: () => void;
  updateSecurity: (id: string, patch: Partial<Omit<Security, 'id'>>) => void;
  removeSecurity: (id: string) => void;

  // Accounts
  addAccount: () => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void;
  removeAccount: (id: string) => void;

  // Holdings
  addHolding: (accountId?: string) => void;
  updateHolding: (id: string, patch: Partial<Omit<Holding, 'id'>>) => void;
  removeHolding: (id: string) => void;

  // Class targets
  setClassTarget: (accountId: string | null, assetClass: AssetClass, target: number) => void;

  // Top-level toggles
  setAllowTaxableSelling: (value: boolean) => void;
  setShowPlacementAdvice: (value: boolean) => void;
  setMode: (mode: RebalanceMode) => void;

  // Lifecycle
  calculate: () => void;
  loadFromUrl: () => void;
  reset: () => void;
}

/**
 * After every state-mutating action we optionally recompute the result (only
 * once the user has hit "Calculate" at least once) and debounce-write the URL.
 */
function postMutate(get: () => StoreStateV2) {
  const { hasCalculatedOnce, wizardStep, setupMode, inputs } = get();
  if (hasCalculatedOnce) get().calculate();
  scheduleHashUpdate(inputs, wizardStep === 'done' && setupMode !== null);
}

function clamp01(value: number): number {
  if (!isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const usePortfolioRebalancingStore = create<StoreStateV2>()(
  devtools(
    (set, get) => ({
      setupMode: null,
      wizardStep: 'mode',

      inputs: emptyInputs(),
      result: null,
      errors: [],
      hasCalculatedOnce: false,

      // ---- Wizard ---------------------------------------------------------
      setSetupMode: (mode) => {
        const seeded = defaultsForMode(mode);
        set({
          setupMode: mode,
          inputs: seeded,
          result: null,
          errors: [],
          hasCalculatedOnce: false,
        });
        // Wizard not complete yet; no hash write.
      },

      setWizardStep: (step) => {
        set({ wizardStep: step });
      },

      completeWizard: () => {
        set({ wizardStep: 'done' });
        // Now that state is shareable, seed the URL hash.
        scheduleHashUpdate(get().inputs, true);
      },

      restartWizard: () => {
        if (hashUpdateTimeout) {
          clearTimeout(hashUpdateTimeout);
          hashUpdateTimeout = null;
        }
        set({
          setupMode: null,
          wizardStep: 'mode',
          inputs: emptyInputs(),
          result: null,
          errors: [],
          hasCalculatedOnce: false,
        });
        clearUrlHash();
      },

      // ---- Securities -----------------------------------------------------
      addSecurity: () => {
        set(state => ({
          inputs: {
            ...state.inputs,
            securities: [
              ...state.inputs.securities,
              {
                id: makeId('sec'),
                ticker: '',
                price: 0,
                assetClass: DEFAULT_ASSET_CLASS,
              },
            ],
          },
        }));
        postMutate(get);
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
            // Cascade: drop holdings referencing this security.
            holdings: state.inputs.holdings.filter(h => h.securityId !== id),
          },
        }));
        postMutate(get);
      },

      // ---- Accounts -------------------------------------------------------
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
        set(state => ({
          inputs: {
            ...state.inputs,
            accounts: state.inputs.accounts.filter(a => a.id !== id),
            // Cascade: drop holdings in this account...
            holdings: state.inputs.holdings.filter(h => h.accountId !== id),
            // ...and any per-account class targets pointing at it.
            classTargets: state.inputs.classTargets.filter(t => t.accountId !== id),
          },
        }));
        postMutate(get);
      },

      // ---- Holdings -------------------------------------------------------
      addHolding: (accountId) => {
        set(state => {
          const resolvedAccountId = accountId ?? state.inputs.accounts[0]?.id ?? '';
          return {
            inputs: {
              ...state.inputs,
              holdings: [
                ...state.inputs.holdings,
                {
                  id: makeId('hld'),
                  accountId: resolvedAccountId,
                  securityId: '',
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
        set(state => ({
          inputs: {
            ...state.inputs,
            holdings: state.inputs.holdings.filter(h => h.id !== id),
          },
        }));
        postMutate(get);
      },

      // ---- Class targets --------------------------------------------------
      setClassTarget: (accountId, assetClass, target) => {
        const clamped = clamp01(target);
        set(state => {
          const existing = state.inputs.classTargets.findIndex(
            t => t.accountId === accountId && t.assetClass === assetClass,
          );
          const next: ClassTarget[] = [...state.inputs.classTargets];
          if (existing >= 0) {
            next[existing] = { accountId, assetClass, target: clamped };
          } else {
            next.push({ accountId, assetClass, target: clamped });
          }
          return { inputs: { ...state.inputs, classTargets: next } };
        });
        postMutate(get);
      },

      // ---- Toggles --------------------------------------------------------
      setAllowTaxableSelling: (value) => {
        set(state => ({
          inputs: { ...state.inputs, allowTaxableSelling: value },
        }));
        postMutate(get);
      },

      setShowPlacementAdvice: (value) => {
        set(state => ({
          inputs: { ...state.inputs, showPlacementAdvice: value },
        }));
        postMutate(get);
      },

      setMode: (mode) => {
        set(state => ({ inputs: { ...state.inputs, mode } }));
        postMutate(get);
      },

      // ---- Lifecycle ------------------------------------------------------
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
          setupMode: decoded.setupMode,
          wizardStep: 'done',
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
          setupMode: null,
          wizardStep: 'mode',
          inputs: emptyInputs(),
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

// Suppress unused-import warnings for types that are re-exported implicitly via
// the public hook signature.
export type { RebalanceInputsV2, RebalanceResultV2, Security, Account, Holding, ClassTarget };
