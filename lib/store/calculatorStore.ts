import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { PaycheckProfile, AllocationResult, ExportableData } from '../types';
import { calculateOptimalAllocation, getDefaultProfile, updateLegacyIncomeFields } from '../calculations/core';
import { encodeToUrlHash, decodeFromUrlHash } from '../utils';
import { DollarDisplayMode, DEFAULT_DOLLAR_DISPLAY_MODE } from '../utils/displayDollars';

interface CalculatorState {
  // Current calculation data
  profile: PaycheckProfile;
  result: AllocationResult | null;

  // UI state
  isCalculating: boolean;
  activeSection: string;
  showAdvanced: boolean;
  displayMode: DollarDisplayMode; // Display-only: today's vs nominal dollars for projections

  // Error handling
  errors: Record<string, string>;
  
  // Actions
  updateProfile: (updates: Partial<PaycheckProfile>) => void;
  updateIncome: (income: Partial<PaycheckProfile['income']>) => void;
  updateTaxes: (taxes: Partial<PaycheckProfile['taxes']>) => void;
  updateBenefits: (benefits: Partial<PaycheckProfile['benefits']>) => void;
  updatePreferences: (preferences: Partial<PaycheckProfile['preferences']>) => void;
  addDebt: (debt: PaycheckProfile['debts'][0]) => void;
  updateDebt: (index: number, debt: Partial<PaycheckProfile['debts'][0]>) => void;
  removeDebt: (index: number) => void;
  
  calculate: () => Promise<void>;
  setActiveSection: (section: string) => void;
  setShowAdvanced: (show: boolean) => void;
  setDisplayMode: (mode: DollarDisplayMode) => void;
  reset: () => void;
  setErrors: (errors: Record<string, string>) => void;
  clearErrors: () => void;
  
  // Future data sharing hooks
  exportData: () => ExportableData;
  importData: (data: ExportableData) => void;
  
  // URL sharing functionality
  generateShareUrl: () => string;
  loadFromUrl: () => void;
}

export const useCalculatorStore = create<CalculatorState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        profile: getDefaultProfile(),
        result: null,
        isCalculating: false,
        activeSection: 'income',
        showAdvanced: false,
        displayMode: DEFAULT_DOLLAR_DISPLAY_MODE,
        errors: {},

        // Profile update actions
        updateProfile: (updates) =>
          set((state) => ({
            profile: { 
              ...state.profile, 
              ...updates, 
              lastUpdated: Date.now() 
            },
            errors: {}, // Clear errors on update
          })),
        
        updateIncome: (income) =>
          set((state) => {
            const updatedIncome = { ...state.profile.income, ...income };
            // Automatically update legacy fields from paycheck-based inputs
            const incomeWithLegacyFields = updateLegacyIncomeFields(updatedIncome);
            
            return {
              profile: {
                ...state.profile,
                income: incomeWithLegacyFields,
                lastUpdated: Date.now(),
              },
              errors: {},
            };
          }),
        
        updateTaxes: (taxes) =>
          set((state) => ({
            profile: {
              ...state.profile,
              taxes: { ...state.profile.taxes, ...taxes },
              lastUpdated: Date.now(),
            },
            errors: {},
          })),
        
        updateBenefits: (benefits) =>
          set((state) => ({
            profile: {
              ...state.profile,
              benefits: { ...state.profile.benefits, ...benefits },
              lastUpdated: Date.now(),
            },
            errors: {},
          })),
        
        updatePreferences: (preferences) =>
          set((state) => ({
            profile: {
              ...state.profile,
              preferences: { ...state.profile.preferences, ...preferences },
              lastUpdated: Date.now(),
            },
            errors: {},
          })),
        
        addDebt: (debt) =>
          set((state) => ({
            profile: {
              ...state.profile,
              debts: [...state.profile.debts, debt],
              lastUpdated: Date.now(),
            },
          })),
        
        updateDebt: (index, debtUpdates) =>
          set((state) => ({
            profile: {
              ...state.profile,
              debts: state.profile.debts.map((debt, i) =>
                i === index ? { ...debt, ...debtUpdates } : debt
              ),
              lastUpdated: Date.now(),
            },
          })),
        
        removeDebt: (index) =>
          set((state) => ({
            profile: {
              ...state.profile,
              debts: state.profile.debts.filter((_, i) => i !== index),
              lastUpdated: Date.now(),
            },
          })),
        
        // Calculation action
        calculate: async () => {
          set({ isCalculating: true, errors: {} });
          
          try {
            const { profile } = get();
            
            // Add a small delay to show loading state
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const result = calculateOptimalAllocation(profile);
            
            set({ 
              result, 
              isCalculating: false,
              profile: { ...profile, lastUpdated: Date.now() }
            });
          } catch (error) {
            console.error('Calculation error:', error);
            set({ 
              isCalculating: false,
              errors: { calculation: 'An error occurred during calculation. Please check your inputs.' }
            });
          }
        },
        
        // UI actions
        setActiveSection: (section) => set({ activeSection: section }),
        setShowAdvanced: (show) => set({ showAdvanced: show }),
        setDisplayMode: (mode) => set({ displayMode: mode }),
        
        // Error handling
        setErrors: (errors) => set({ errors }),
        clearErrors: () => set({ errors: {} }),
        
        // Reset
        reset: () => set({
          profile: getDefaultProfile(),
          result: null,
          isCalculating: false,
          activeSection: 'income',
          showAdvanced: false,
          displayMode: DEFAULT_DOLLAR_DISPLAY_MODE,
          errors: {},
        }),
        
        // Data export/import for future cross-calculator functionality
        exportData: () => {
          const { profile, result } = get();
          return {
            version: '1.0',
            timestamp: Date.now(),
            profile,
            result: result || undefined,
            metadata: {
              source: 'paycheck-allocator',
              calculatorVersion: '1.0',
            },
          };
        },
        
        importData: (data) => {
          if (data.version === '1.0' && data.profile) {
            set({
              profile: { ...data.profile, lastUpdated: Date.now() },
              result: data.result || null,
              errors: {},
            });
          }
        },
        
        // URL sharing functionality
        generateShareUrl: () => {
          const { profile, result, displayMode } = get();
          const shareData = { profile, result, displayMode };
          const hash = encodeToUrlHash(shareData);
          
          if (hash) {
            const currentUrl = new URL(window.location.href);
            currentUrl.hash = hash;
            return currentUrl.toString();
          }
          
          return window.location.href;
        },
        
        loadFromUrl: () => {
          if (typeof window !== 'undefined') {
            const hash = window.location.hash;
            if (hash) {
              const decodedData = decodeFromUrlHash(hash);
              if (decodedData && (decodedData as Record<string, unknown>).profile) {
                const decodedMode = (decodedData as Record<string, unknown>).displayMode;
                set({
                  profile: Object.assign({}, (decodedData as Record<string, unknown>).profile, { source: 'shared', lastUpdated: Date.now() }) as PaycheckProfile,
                  result: null, // Will need to recalculate
                  displayMode: decodedMode === 'nominal' ? 'nominal' : DEFAULT_DOLLAR_DISPLAY_MODE,
                  errors: {},
                });
                
                // Auto-calculate if we have enough data
                const profile = (decodedData as Record<string, unknown>).profile;
                if ((profile as Record<string, unknown>)?.income && (profile as Record<string, unknown>)?.preferences) {
                  // Trigger calculation asynchronously
                  setTimeout(() => {
                    get().calculate();
                  }, 100);
                }
              }
            }
          }
        },
      }),
      {
        name: 'paycheck-allocator-storage',
        partialize: (state) => ({
          profile: state.profile,
          showAdvanced: state.showAdvanced,
          activeSection: state.activeSection,
          // Missing in older persisted payloads — persist's shallow merge
          // falls back to the default ('today').
          displayMode: state.displayMode,
        }),
      }
    ),
    { name: 'PaycheckCalculator' }
  )
);

// Selector hooks for better performance
export const useProfile = () => useCalculatorStore((state) => state.profile);
export const useResult = () => useCalculatorStore((state) => state.result);
export const useIsCalculating = () => useCalculatorStore((state) => state.isCalculating);
export const useErrors = () => useCalculatorStore((state) => state.errors);
export const useActiveSection = () => useCalculatorStore((state) => state.activeSection);
export const useShowAdvanced = () => useCalculatorStore((state) => state.showAdvanced);
export const useDisplayMode = () => useCalculatorStore((state) => state.displayMode);