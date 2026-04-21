import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  RebalanceAsset,
  RebalanceInputs,
  RebalanceMode,
  RebalanceResult,
  rebalancePortfolio,
  validateRebalanceInputs,
  ValidationError,
} from '@/lib/calculations/portfolioRebalancing';
import {
  encodeRebalancingToUrlHash,
  decodeRebalancingFromUrlHash,
} from '@/lib/utils/portfolioRebalancingState';

let hashUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

function makeId(): string {
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultAssets(): RebalanceAsset[] {
  return [
    { id: makeId(), ticker: 'VTI', currentShares: 0, price: 0, targetAllocation: 0.6 },
    { id: makeId(), ticker: 'BND', currentShares: 0, price: 0, targetAllocation: 0.4 },
  ];
}

function defaultInputs(): RebalanceInputs {
  return {
    assets: defaultAssets(),
    deposit: 0,
    mode: 'whole',
  };
}

interface StoreState {
  inputs: RebalanceInputs;
  result: RebalanceResult | null;
  errors: ValidationError[];
  hasCalculatedOnce: boolean;

  updateAsset: (id: string, updates: Partial<Omit<RebalanceAsset, 'id'>>) => void;
  addAsset: () => void;
  removeAsset: (id: string) => void;
  setDeposit: (deposit: number) => void;
  setMode: (mode: RebalanceMode) => void;
  calculate: () => void;
  loadFromUrl: () => void;
  reset: () => void;
}

function scheduleHashUpdate(inputs: RebalanceInputs) {
  if (typeof window === 'undefined') return;
  if (hashUpdateTimeout) clearTimeout(hashUpdateTimeout);
  hashUpdateTimeout = setTimeout(() => {
    const hash = encodeRebalancingToUrlHash(inputs);
    if (hash) {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, 300);
}

export const usePortfolioRebalancingStore = create<StoreState>()(
  devtools(
    (set, get) => ({
      inputs: defaultInputs(),
      result: null,
      errors: [],
      hasCalculatedOnce: false,

      updateAsset: (id, updates) => {
        set(state => {
          const inputs: RebalanceInputs = {
            ...state.inputs,
            assets: state.inputs.assets.map(a => (a.id === id ? { ...a, ...updates } : a)),
          };
          return { inputs };
        });
        const { hasCalculatedOnce, inputs } = get();
        if (hasCalculatedOnce) get().calculate();
        scheduleHashUpdate(inputs);
      },

      addAsset: () => {
        set(state => ({
          inputs: {
            ...state.inputs,
            assets: [
              ...state.inputs.assets,
              { id: makeId(), ticker: '', currentShares: 0, price: 0, targetAllocation: 0 },
            ],
          },
        }));
        scheduleHashUpdate(get().inputs);
      },

      removeAsset: (id) => {
        set(state => ({
          inputs: {
            ...state.inputs,
            assets: state.inputs.assets.filter(a => a.id !== id),
          },
        }));
        const { hasCalculatedOnce, inputs } = get();
        if (hasCalculatedOnce) get().calculate();
        scheduleHashUpdate(inputs);
      },

      setDeposit: (deposit) => {
        set(state => ({ inputs: { ...state.inputs, deposit } }));
        const { hasCalculatedOnce, inputs } = get();
        if (hasCalculatedOnce) get().calculate();
        scheduleHashUpdate(inputs);
      },

      setMode: (mode) => {
        set(state => ({ inputs: { ...state.inputs, mode } }));
        const { hasCalculatedOnce, inputs } = get();
        if (hasCalculatedOnce) get().calculate();
        scheduleHashUpdate(inputs);
      },

      calculate: () => {
        const { inputs } = get();
        const errors = validateRebalanceInputs(inputs);
        if (errors.length > 0) {
          set({ errors, result: null, hasCalculatedOnce: true });
          return;
        }
        try {
          const result = rebalancePortfolio(inputs);
          set({ result, errors: [], hasCalculatedOnce: true });
        } catch (e) {
          set({
            errors: [{ field: 'calculation', message: e instanceof Error ? e.message : 'Calculation failed.' }],
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
        if (decoded && decoded.assets.length > 0) {
          set({ inputs: decoded });
        }
      },

      reset: () => {
        set({ inputs: defaultInputs(), result: null, errors: [], hasCalculatedOnce: false });
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      },
    }),
    { name: 'portfolio-rebalancing-store' }
  )
);
