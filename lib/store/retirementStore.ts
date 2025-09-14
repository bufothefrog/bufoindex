import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { RetirementInputs, RetirementResults } from '../calculations/retirement';
import { calculateRetirementAnalysis } from '../calculations/retirement';
import { RetirementConstants } from '../constants/retirement';
import { encodeRetirementToUrlHash, decodeRetirementFromUrlHash } from '../utils/retirementState';

interface RetirementState {
  // Current calculation data
  inputs: RetirementInputs;
  results: RetirementResults | null;
  
  // UI state
  isCalculating: boolean;
  activeSection: string;
  showAdvanced: boolean;
  hasCalculatedOnce: boolean; // Track if user has manually calculated at least once
  
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
}

const getDefaultInputs = (): RetirementInputs => ({
  startingAge: 25,
  retirementAge: 60,
  lifeExpectancy: 85, // NEW: User-defined life expectancy
  targetIncome: 80000,
  startingBalance: 10000,
  currentIncome: 100000,
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
  wealthGoal: 'balanced' // NEW: Default wealth goal
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
        errors: {},

        // Actions
        updateInputs: (updates) => {
          set((state) => ({
            inputs: { ...state.inputs, ...updates },
            errors: {} // Clear errors when inputs change
          }));
          
          // Only auto-calculate if user has calculated at least once
          const { hasCalculatedOnce } = get();
          if (hasCalculatedOnce) {
            // Automatically recalculate when inputs change (debounced)
            const timeoutId = setTimeout(async () => {
              const { inputs } = get();
              
              // Update URL hash
              try {
                const hash = encodeRetirementToUrlHash(inputs);
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
                set({ 
                  errors: { 
                    calculation: error instanceof Error ? error.message : 'Calculation failed' 
                  }
                });
              }
            }, 300); // Shorter debounce for better UX

            return () => clearTimeout(timeoutId);
          } else {
            // Just update URL hash without calculating
            const timeoutId = setTimeout(() => {
              const { inputs } = get();
              try {
                const hash = encodeRetirementToUrlHash(inputs);
                if (typeof window !== 'undefined') {
                  window.history.replaceState(null, '', `#${hash}`);
                }
              } catch (error) {
                console.warn('Failed to update URL hash:', error);
              }
            }, 1000);

            return () => clearTimeout(timeoutId);
          }
        },

        calculate: async () => {
          set({ isCalculating: true, errors: {} });
          
          try {
            // Simulate calculation time for UX
            await new Promise(resolve => setTimeout(resolve, 500));
            
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
              errors: { 
                calculation: error instanceof Error ? error.message : 'Calculation failed' 
              },
              isCalculating: false 
            });
          }
        },

        loadFromUrl: () => {
          try {
            if (typeof window === 'undefined') return;
            
            const hash = window.location.hash.slice(1);
            if (hash) {
              const urlInputs = decodeRetirementFromUrlHash(hash);
              if (urlInputs) {
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
                    hasCalculatedOnce: true // URL load counts as initial calculation
                  });
                } catch (error) {
                  console.error('URL calculation error:', error);
                  set({ 
                    inputs: urlInputs,
                    errors: { 
                      calculation: error instanceof Error ? error.message : 'Calculation failed' 
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.warn('Failed to load from URL:', error);
          }
        },

        generateShareUrl: () => {
          const { inputs } = get();
          try {
            const hash = encodeRetirementToUrlHash(inputs);
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            return `${baseUrl}#${hash}`;
          } catch (error) {
            console.error('Failed to generate share URL:', error);
            return typeof window !== 'undefined' ? window.location.href : '';
          }
        },

        clearErrors: () => set({ errors: {} }),
        
        setActiveSection: (section: string) => set({ activeSection: section }),
        
        toggleAdvanced: () => set((state) => ({ showAdvanced: !state.showAdvanced }))
      }),
      {
        name: 'retirement-calculator',
        version: 2, // Increment version to handle risk profile migration
        partialize: (state) => ({
          inputs: state.inputs,
          showAdvanced: state.showAdvanced,
          hasCalculatedOnce: state.hasCalculatedOnce
        }),
        migrate: (persistedState: unknown, version: number) => {
          // Migrate from version 1 to version 2: simplify risk profiles
          if (version === 1 && 
              typeof persistedState === 'object' && 
              persistedState !== null &&
              'inputs' in persistedState &&
              typeof persistedState.inputs === 'object' &&
              persistedState.inputs !== null &&
              'riskProfile' in persistedState.inputs) {
            const inputs = persistedState.inputs as { riskProfile: string };
            const oldProfile = inputs.riskProfile;
            if (!['tdf', 'custom'].includes(oldProfile)) {
              inputs.riskProfile = 'custom'; // Convert old profiles to custom
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
export const useRetirementCalculating = () => useRetirementStore(state => state.isCalculating);
export const useRetirementErrors = () => useRetirementStore(state => state.errors);