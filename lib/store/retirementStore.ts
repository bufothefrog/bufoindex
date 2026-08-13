import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { RetirementInputs, RetirementResults, annualizeIncome } from '../calculations/retirement';
import { calculateRetirementAnalysis, RetirementInputValidationError } from '../calculations/retirement';
import type { RetirementWorkerRequest, RetirementWorkerResponse } from '../workers/retirementWorker';
import { RetirementConstants } from '../constants/retirement';
import { encodeRetirementToUrlHash, decodeRetirementFromUrlHash } from '../utils/retirementState';
import { DollarDisplayMode, DEFAULT_DOLLAR_DISPLAY_MODE } from '../utils/displayDollars';

// Module-level timeout references to prevent debounce leaks (BUG-13)
let recalculateTimeout: ReturnType<typeof setTimeout> | null = null;
let hashUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

// Map a thrown calculation error onto the store's errors map: validation
// errors surface per-field, anything else lands under 'calculation'.
const toErrorMap = (error: unknown): Record<string, string> =>
  error instanceof RetirementInputValidationError
    ? error.fieldErrors
    : { calculation: error instanceof Error ? error.message : 'Calculation failed' };

// ---------------------------------------------------------------------------
// Off-thread analysis plumbing
// ---------------------------------------------------------------------------
// The ~6-scenario × 1000-path Monte Carlo batch runs in a dedicated Web
// Worker so it never blocks the main thread. The worker is created lazily on
// the first calculation (SSR-safe) and reused across runs. Environments
// without Worker support (SSR, jsdom) or where construction throws fall back
// to a synchronous in-thread call wrapped in a promise, so every caller
// shares one async code path.

let retirementWorker: Worker | null = null;
let workerUnavailable = false;

/** Monotonic id for calculation runs; the store applies only the newest. */
let calculationSeq = 0;

const pendingRequests = new Map<
  number,
  {
    inputs: RetirementInputs; // kept so a broken worker's runs can be retried in-thread
    resolve: (results: RetirementResults) => void;
    reject: (error: unknown) => void;
  }
>();

/** Run the analysis in-thread, mapping a thrown error onto a rejected promise. */
const runInThread = (inputs: RetirementInputs): Promise<RetirementResults> => {
  try {
    return Promise.resolve(calculateRetirementAnalysis(inputs));
  } catch (error) {
    return Promise.reject(error);
  }
};

const getRetirementWorker = (): Worker | null => {
  if (workerUnavailable || typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (retirementWorker) return retirementWorker;

  let worker: Worker;
  try {
    worker = new Worker(new URL('../workers/retirementWorker.ts', import.meta.url));
  } catch {
    // Construction failed (unsupported environment) — remember and stay on
    // the synchronous fallback from now on.
    workerUnavailable = true;
    return null;
  }

  worker.onmessage = (event: MessageEvent<RetirementWorkerResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);
    if (response.ok) {
      pending.resolve(response.results);
    } else if (response.fieldErrors) {
      // Rehydrate the typed validation error so toErrorMap surfaces the
      // per-field messages exactly as the direct-call path does.
      pending.reject(new RetirementInputValidationError(response.fieldErrors));
    } else {
      pending.reject(new Error(response.message ?? 'Calculation failed'));
    }
  };
  worker.onerror = () => {
    // The worker itself broke (e.g. its script failed to load). Retire it,
    // permanently fall back to the synchronous path, and finish the in-flight
    // runs in-thread so the user still gets results. Only a genuine
    // calculation error (thrown by runInThread) reaches the caller's catch.
    const stranded = [...pendingRequests.values()];
    pendingRequests.clear();
    worker.terminate();
    if (retirementWorker === worker) retirementWorker = null;
    workerUnavailable = true;
    for (const { inputs, resolve, reject } of stranded) {
      runInThread(inputs).then(resolve, reject);
    }
  };

  retirementWorker = worker;
  return worker;
};

/**
 * Run the retirement analysis off-thread when possible. Falls back to a
 * synchronous in-thread call (wrapped in a promise) when no worker is
 * available, when construction fails, or when dispatch throws, so SSR guards,
 * test environments and broken workers all share the browser code path.
 */
const runRetirementAnalysis = (inputs: RetirementInputs, id: number): Promise<RetirementResults> => {
  const worker = getRetirementWorker();
  if (!worker) return runInThread(inputs);

  return new Promise<RetirementResults>((resolve, reject) => {
    pendingRequests.set(id, { inputs, resolve, reject });
    const request: RetirementWorkerRequest = { id, inputs };
    try {
      worker.postMessage(request);
    } catch {
      // Dispatch failed (e.g. the payload could not be cloned) — the worker
      // will never answer, so run this one in-thread and stop using it.
      pendingRequests.delete(id);
      workerUnavailable = true;
      runInThread(inputs).then(resolve, reject);
    }
  });
};

/**
 * Hash of the calculation-relevant inputs. Identical inputs (display-mode
 * toggles, focus churn re-emitting the same values) hit the memo cache in
 * the store and skip the Monte Carlo batch entirely. The simulation is
 * seeded, so identical inputs always produce identical results.
 */
const hashInputs = (inputs: RetirementInputs): string => JSON.stringify(inputs);

interface RetirementState {
  // Current calculation data
  inputs: RetirementInputs;
  results: RetirementResults | null;
  /**
   * Hash of the inputs that produced `results` — the memoization key that
   * lets identical inputs skip a recompute. Internal; never persisted
   * (excluded from partialize). Null when results are absent or stale.
   */
  lastCalculationHash: string | null;

  // UI state
  isCalculating: boolean;
  activeSection: string;
  showAdvanced: boolean;
  hasCalculatedOnce: boolean; // Track if user has manually calculated at least once
  displayMode: DollarDisplayMode; // Display-only: today's vs nominal dollars

  // Error handling
  errors: Record<string, string>;

  // Actions
  updateInputs: (updates: Partial<RetirementInputs>) => void;
  calculate: () => Promise<void>;
  loadFromUrl: () => void;
  generateShareUrl: () => string;
  clearErrors: () => void;
  setActiveSection: (section: string) => void;
  toggleAdvanced: () => void;
  setDisplayMode: (mode: DollarDisplayMode) => void;
}

const getDefaultInputs = (): RetirementInputs => ({
  startingAge: 25,
  retirementAge: 60,
  lifeExpectancy: 85, // NEW: User-defined life expectancy
  targetIncome: 80000,
  startingBalance: 10000,
  currentIncome: 100000,
  incomeAmount: 100000,
  incomePeriod: 'yearly' as const,
  monthlySavings: 2000,
  necessaryMonthlyExpenses: 4000,
  accumulationReturn: RetirementConstants.DEFAULT_ACCUMULATION_RETURN,
  retirementReturn: RetirementConstants.DEFAULT_RETIREMENT_RETURN,
  inflationRate: RetirementConstants.DEFAULT_INFLATION_RATE,
  socialSecurityAge: RetirementConstants.SS_FULL_RETIREMENT_AGE,
  socialSecurityBenefit: 30000,
  healthcareCostMultiplier: 1,
  volatility: RetirementConstants.DEFAULT_VOLATILITY,
  filingStatus: 'single',
  state: 'TX', // NEW: Default to Texas (no state income tax)
  riskProfile: 'tdf', // NEW: Default risk profile
  effectiveTaxRate: null,
  estimatedAnnualHealthcareCost: null,
});

export const useRetirementStore = create<RetirementState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - no immediate calculation
        inputs: getDefaultInputs(),
        results: null,
        lastCalculationHash: null,
        isCalculating: false,
        activeSection: 'basic',
        showAdvanced: false,
        hasCalculatedOnce: false,
        displayMode: DEFAULT_DOLLAR_DISPLAY_MODE,
        errors: {},

        // Actions
        updateInputs: (updates) => {
          set((state) => {
            const merged = { ...state.inputs, ...updates };
            // Auto-derive currentIncome when incomeAmount or incomePeriod changes
            if ('incomeAmount' in updates || 'incomePeriod' in updates) {
              merged.currentIncome = annualizeIncome(merged.incomeAmount, merged.incomePeriod);
            }
            return { inputs: merged, errors: {} };
          });
          
          // Only auto-calculate if user has calculated at least once
          const { hasCalculatedOnce } = get();
          if (hasCalculatedOnce) {
            // Clear previous timeout to prevent debounce leak (BUG-13)
            if (recalculateTimeout) clearTimeout(recalculateTimeout);
            recalculateTimeout = setTimeout(() => {
              recalculateTimeout = null;
              const { inputs, displayMode, results, lastCalculationHash } = get();

              // Update URL hash
              try {
                const hash = encodeRetirementToUrlHash(inputs, displayMode);
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', `#${hash}`);
                }
              } catch (error) {
                console.warn('Failed to update URL hash:', error);
              }

              // Auto-recalculate off-thread; skip entirely when the inputs
              // are unchanged (focus churn re-emitting identical values).
              const inputsHash = hashInputs(inputs);
              if (results !== null && inputsHash === lastCalculationHash) return;

              const runId = ++calculationSeq;
              runRetirementAnalysis(inputs, runId)
                .then((calculationResults) => {
                  if (runId !== calculationSeq) return; // superseded — drop stale result
                  set({ results: calculationResults, lastCalculationHash: inputsHash });
                })
                .catch((error: unknown) => {
                  if (runId !== calculationSeq) return; // superseded — drop stale failure
                  console.error('Auto-calculation error:', error);
                  set({ errors: toErrorMap(error), lastCalculationHash: null });
                });
            }, 300); // Shorter debounce for better UX
          } else {
            // Clear previous timeout to prevent debounce leak (BUG-13)
            if (hashUpdateTimeout) clearTimeout(hashUpdateTimeout);
            hashUpdateTimeout = setTimeout(() => {
              const { inputs, displayMode } = get();
              try {
                const hash = encodeRetirementToUrlHash(inputs, displayMode);
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', `#${hash}`);
                }
              } catch (error) {
                console.warn('Failed to update URL hash:', error);
              }
              hashUpdateTimeout = null;
            }, 1000);
          }
        },

        calculate: async () => {
          const { inputs, results, lastCalculationHash } = get();
          const inputsHash = hashInputs(inputs);

          // Memo hit: these exact inputs already produced `results` — skip
          // the Monte Carlo batch entirely.
          if (results !== null && inputsHash === lastCalculationHash) {
            set({ errors: {}, isCalculating: false, hasCalculatedOnce: true });
            return;
          }

          set({ isCalculating: true, errors: {} });
          const runId = ++calculationSeq;

          try {
            const calculationResults = await runRetirementAnalysis(inputs, runId);
            if (runId !== calculationSeq) return; // superseded — drop stale result

            set({
              results: calculationResults,
              lastCalculationHash: inputsHash,
              isCalculating: false,
              hasCalculatedOnce: true // Mark that user has calculated once
            });
          } catch (error) {
            if (runId !== calculationSeq) return; // superseded — drop stale failure
            console.error('Retirement calculation error:', error);
            set({
              errors: toErrorMap(error),
              lastCalculationHash: null,
              isCalculating: false
            });
          }
        },

        loadFromUrl: () => {
          try {
            if (typeof window === 'undefined') return;

            const hash = window.location.hash.slice(1);
            if (!hash) return;
            const decoded = decodeRetirementFromUrlHash(hash);
            if (!decoded) return;

            const urlInputs = decoded.inputs;
            // Migrate old risk profile values to simplified options
            if (urlInputs.riskProfile && !['tdf', 'custom'].includes(urlInputs.riskProfile)) {
              urlInputs.riskProfile = 'custom'; // Convert old profiles to custom
            }

            const inputsHash = hashInputs(urlInputs);
            const { results, lastCalculationHash } = get();
            if (results !== null && inputsHash === lastCalculationHash) {
              // Memo hit — the current results already match the shared link.
              set({
                inputs: urlInputs,
                displayMode: decoded.displayMode,
                hasCalculatedOnce: true
              });
              return;
            }

            // Adopt the shared inputs synchronously so first paint isn't
            // blocked, then run the analysis through the same async path as
            // calculate().
            set({
              inputs: urlInputs,
              displayMode: decoded.displayMode,
              hasCalculatedOnce: true, // URL load counts as initial calculation
              isCalculating: true,
              errors: {}
            });

            const runId = ++calculationSeq;
            runRetirementAnalysis(urlInputs, runId)
              .then((calculationResults) => {
                if (runId !== calculationSeq) return; // superseded — drop stale result
                set({
                  results: calculationResults,
                  lastCalculationHash: inputsHash,
                  isCalculating: false
                });
              })
              .catch((error: unknown) => {
                if (runId !== calculationSeq) return; // superseded — drop stale failure
                console.error('URL calculation error:', error);
                set({
                  errors: toErrorMap(error),
                  lastCalculationHash: null,
                  isCalculating: false
                });
              });
          } catch (error) {
            console.warn('Failed to load from URL:', error);
          }
        },

        generateShareUrl: () => {
          const { inputs, displayMode } = get();
          try {
            const hash = encodeRetirementToUrlHash(inputs, displayMode);
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            return `${baseUrl}#${hash}`;
          } catch (error) {
            console.error('Failed to generate share URL:', error);
            return typeof window !== 'undefined' ? window.location.href : '';
          }
        },

        clearErrors: () => set({ errors: {} }),

        setActiveSection: (section: string) => set({ activeSection: section }),

        toggleAdvanced: () => set((state) => ({ showAdvanced: !state.showAdvanced })),

        setDisplayMode: (mode: DollarDisplayMode) => {
          set({ displayMode: mode });
          // Display mode is part of shareable URL state — reflect it immediately
          try {
            const { inputs } = get();
            const hash = encodeRetirementToUrlHash(inputs, mode);
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', `#${hash}`);
            }
          } catch (error) {
            console.warn('Failed to update URL hash:', error);
          }
        }
      }),
      {
        name: 'retirement-calculator',
        version: 3, // v3: add effectiveTaxRate & estimatedAnnualHealthcareCost
        partialize: (state) => ({
          inputs: state.inputs,
          showAdvanced: state.showAdvanced,
          hasCalculatedOnce: state.hasCalculatedOnce,
          // Missing in older persisted payloads — persist's shallow merge
          // falls back to the default ('today'), so no version bump needed.
          displayMode: state.displayMode
        }),
        migrate: (persistedState: unknown, version: number) => {
          if (typeof persistedState === 'object' && persistedState !== null && 'inputs' in persistedState) {
            const inputs = (persistedState as { inputs: Record<string, unknown> }).inputs;
            // v1->v2: risk profile migration
            if (version < 2 && 'riskProfile' in inputs) {
              if (!['tdf', 'custom'].includes(inputs.riskProfile as string)) {
                inputs.riskProfile = 'custom';
              }
            }
            // v2->v3: add new fields with defaults
            if (version < 3) {
              if (!('effectiveTaxRate' in inputs)) inputs.effectiveTaxRate = null;
              if (!('estimatedAnnualHealthcareCost' in inputs)) inputs.estimatedAnnualHealthcareCost = null;
            }
          }
          return persistedState;
        }
      }
    ),
    { name: 'RetirementStore' }
  )
);

// Selector hooks for specific parts of state
export const useRetirementInputs = () => useRetirementStore(state => state.inputs);
export const useRetirementResults = () => useRetirementStore(state => state.results);
export const useRetirementDisplayMode = () => useRetirementStore(state => state.displayMode);
export const useRetirementCalculating = () => useRetirementStore(state => state.isCalculating);
export const useRetirementErrors = () => useRetirementStore(state => state.errors);