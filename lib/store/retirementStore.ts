import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { RetirementInputs, RetirementResults, annualizeIncome } from '../calculations/retirement';
import { calculateRetirementAnalysis, RetirementInputValidationError } from '../calculations/retirement';
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

interface RetirementState {
  // Current calculation data
  inputs: RetirementInputs;
  results: RetirementResults | null;
  
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
            recalculateTimeout = setTimeout(async () => {
              const { inputs, displayMode } = get();

              // Update URL hash
              try {
                const hash = encodeRetirementToUrlHash(inputs, displayMode);
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', `#${hash}`);
                }
              } catch (error) {
                console.warn('Failed to update URL hash:', error);
              }

              // Auto-calculate with minimal delay
              try {
                const calculationResults = calculateRetirementAnalysis(inputs);
                set({ results: calculationResults });
              } catch (error) {
                console.error('Auto-calculation error:', error);
                set({ errors: toErrorMap(error) });
              }
              recalculateTimeout = null;
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
          set({ isCalculating: true, errors: {} });

          try {
            const { inputs } = get();
            const calculationResults = calculateRetirementAnalysis(inputs);

            set({
              results: calculationResults,
              isCalculating: false,
              hasCalculatedOnce: true // Mark that user has calculated once
            });
          } catch (error) {
            console.error('Retirement calculation error:', error);
            set({
              errors: toErrorMap(error),
              isCalculating: false
            });
          }
        },

        loadFromUrl: () => {
          try {
            if (typeof window === 'undefined') return;
            
            const hash = window.location.hash.slice(1);
            if (hash) {
              const decoded = decodeRetirementFromUrlHash(hash);
              if (decoded) {
                const urlInputs = decoded.inputs;
                // Migrate old risk profile values to simplified options
                if (urlInputs.riskProfile && !['tdf', 'custom'].includes(urlInputs.riskProfile)) {
                  urlInputs.riskProfile = 'custom'; // Convert old profiles to custom
                }

                // Calculate results immediately when loading from URL and mark as calculated
                try {
                  const calculationResults = calculateRetirementAnalysis(urlInputs);
                  set({
                    inputs: urlInputs,
                    results: calculationResults,
                    displayMode: decoded.displayMode,
                    hasCalculatedOnce: true // URL load counts as initial calculation
                  });
                } catch (error) {
                  console.error('URL calculation error:', error);
                  set({
                    inputs: urlInputs,
                    displayMode: decoded.displayMode,
                    errors: toErrorMap(error)
                  });
                }
              }
            }
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