/**
 * URL State Management Utility
 * Handles saving and loading calculator state from URL hash
 */

class URLStateManager {
    /**
     * Save current calculator parameters to URL hash
     */
    static saveState(params) {
        const urlParams = new URLSearchParams();
        
        // Add all parameters to URL
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                urlParams.set(key, params[key]);
            }
        });

        // Update URL hash without triggering page reload
        const newHash = urlParams.toString();
        if (window.location.hash !== '#' + newHash) {
            window.history.replaceState(null, null, '#' + newHash);
        }
    }

    /**
     * Load calculator parameters from URL hash
     */
    static loadState() {
        const hash = window.location.hash.substring(1); // Remove the '#'
        
        if (!hash) {
            return this.getDefaultParameters();
        }

        try {
            const urlParams = new URLSearchParams(hash);
            const params = {};

            // Define expected parameters with default values
            const defaults = this.getDefaultParameters();
            
            // Load each parameter, falling back to defaults
            Object.keys(defaults).forEach(key => {
                const value = urlParams.get(key);
                if (value !== null) {
                    // Parse based on expected type
                    if (typeof defaults[key] === 'number') {
                        params[key] = parseFloat(value) || defaults[key];
                    } else {
                        params[key] = value;
                    }
                } else {
                    params[key] = defaults[key];
                }
            });

            return params;
        } catch (error) {
            console.warn('Error loading state from URL:', error);
            return this.getDefaultParameters();
        }
    }

    /**
     * Get default calculator parameters
     */
    static getDefaultParameters() {
        return {
            startingAge: 30,
            targetRetirementAge: 65,
            currentSavingsRate: 10,
            endAge: 85,
            targetIncome: 80000,
            startingBalance: 80000,
            inflationRate: 3,
            currentIncome: 80000,
            state: 'CA',
            riskProfile: 'tdf',
            // Legacy parameters for compatibility
            retirementAgeA: 40,
            retirementAgeB: 45,
            retirementAgeC: 50,
            accumulationReturn: 10,
            retirementReturn: 7,
            volatility: 15,
            monteCarloRuns: 1000,
            accountType: 'Taxable',
            socialSecurityAge: 67,
            socialSecurityBenefit: 2000,
            healthcareMultiplier: 1.0,
            // Legacy financial modeling parameters
            filingStatus: 'Single',
            expectedSsBenefit: 2000,
            ssStartAge: 67,
            lifeExpectancy: 85,
            currentTaxRate: 22,
            retirementTaxRate: 15,
            healthcareInflation: 5
        };
    }

    /**
     * Validate individual parameter with type checking
     */
    static validateAge(value, min, max, defaultValue) {
        const parsed = parseInt(value);
        if (isNaN(parsed) || parsed < min || parsed > max) {
            return defaultValue;
        }
        return parsed;
    }

    static validateCurrency(value, min, max, defaultValue) {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || parsed < min || (max && parsed > max)) {
            return defaultValue;
        }
        return parsed;
    }

    static validateRate(value, min, max, defaultValue) {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || parsed < min || parsed > max) {
            return defaultValue;
        }
        return parsed;
    }

    /**
     * Validate and sanitize parameters with dependency order
     */
    static validateParameters(params) {
        // Create defensive copy
        const validated = JSON.parse(JSON.stringify(params || {}));

        // Validate in dependency order to prevent race conditions
        validated.startingAge = this.validateAge(validated.startingAge, 18, 100, 25);
        validated.targetRetirementAge = this.validateAge(
            validated.targetRetirementAge, 
            validated.startingAge + 1, 
            100, 
            Math.max(45, validated.startingAge + 10)
        );
        validated.endAge = this.validateAge(validated.endAge, 65, 110, 85);
        
        // Savings rate validation
        validated.currentSavingsRate = this.validateRate(validated.currentSavingsRate, 0, 80, 15);
        
        // Legacy age validations (for backward compatibility)
        validated.retirementAgeA = this.validateAge(validated.retirementAgeA, validated.startingAge + 1, 100, 40);
        validated.retirementAgeB = this.validateAge(validated.retirementAgeB, validated.startingAge + 1, 100, 45);
        validated.retirementAgeC = this.validateAge(validated.retirementAgeC, validated.startingAge + 1, 100, 50);

        // Financial validations using helper methods
        validated.targetIncome = this.validateCurrency(validated.targetIncome, 1000, null, 120000);
        validated.startingBalance = this.validateCurrency(validated.startingBalance, 0, null, 100000);
        validated.inflationRate = this.validateRate(validated.inflationRate, 0, 20, 3);

        // Enhanced parameter validations using helper methods
        validated.currentIncome = this.validateCurrency(validated.currentIncome, 1000, null, 80000);
        validated.accumulationReturn = this.validateRate(validated.accumulationReturn, 0, 30, 10);
        validated.retirementReturn = this.validateRate(validated.retirementReturn, 0, 20, 7);
        validated.volatility = this.validateRate(validated.volatility, 0, 50, 15);
        validated.monteCarloRuns = this.validateAge(validated.monteCarloRuns, 100, 10000, 1000);
        validated.socialSecurityAge = this.validateAge(validated.socialSecurityAge, 62, 70, 67);
        validated.socialSecurityBenefit = this.validateCurrency(validated.socialSecurityBenefit, 0, 10000, 2000);
        validated.healthcareMultiplier = this.validateRate(validated.healthcareMultiplier, 0.5, 3.0, 1.0);
        
        // Legacy parameter validations (for backwards compatibility)
        validated.expectedSsBenefit = Math.max(0, Math.min(5000, validated.expectedSsBenefit || validated.socialSecurityBenefit));
        validated.ssStartAge = Math.max(62, Math.min(70, validated.ssStartAge || validated.socialSecurityAge));
        validated.lifeExpectancy = Math.max(70, Math.min(100, validated.lifeExpectancy || 85));
        validated.currentTaxRate = Math.max(0, Math.min(50, validated.currentTaxRate || 22));
        validated.retirementTaxRate = Math.max(0, Math.min(50, validated.retirementTaxRate || 15));
        validated.healthcareInflation = Math.max(0, Math.min(20, validated.healthcareInflation || 5));

        // NEW: Risk profile validation
        const validRiskProfiles = ['conservative', 'moderate', 'aggressive', 'high_risk', 'ultra_high_risk', 'tdf', 'custom'];
        if (!validRiskProfiles.includes(validated.riskProfile)) {
            validated.riskProfile = 'tdf';
        }
        
        // String validations with defaults
        const validAccountTypes = ['Taxable', 'Traditional 401k/IRA', 'Roth'];
        if (!validAccountTypes.includes(validated.accountType)) {
            validated.accountType = 'Taxable';
        }

        // Accept any state code for now (we have all 50 states)
        if (!validated.state || validated.state.length !== 2) {
            validated.state = 'TX';
        }

        const validFilingStatuses = ['Single', 'Married Filing Jointly'];
        if (!validFilingStatuses.includes(validated.filingStatus)) {
            validated.filingStatus = 'Single';
        }

        return validated;
    }

    /**
     * Apply parameters to form inputs
     */
    static applyParametersToForm(params) {
        const validated = this.validateParameters(params);

        // Update NEW form inputs
        this.setInputValue('startingAge', validated.startingAge);
        this.setInputValue('targetRetirementAge', validated.targetRetirementAge);
        this.setInputValue('currentSavingsRate', validated.currentSavingsRate);
        this.setInputValue('targetIncome', validated.targetIncome.toLocaleString());
        this.setInputValue('startingBalance', validated.startingBalance.toLocaleString());
        this.setInputValue('currentIncome', validated.currentIncome.toLocaleString());
        // Handle state with custom dropdown
        this.setSelectValue('state', validated.state);
        const stateInput = document.getElementById('stateInput');
        if (stateInput && validated.state) {
            // Find the state name from the hidden select
            const stateSelect = document.getElementById('state');
            const stateOption = stateSelect?.querySelector(`option[value="${validated.state}"]`);
            if (stateOption) {
                stateInput.value = stateOption.textContent;
            }
        }
        
        this.setSelectValue('riskProfile', validated.riskProfile);
        
        // Handle custom risk profile - show the custom option if it was selected
        if (validated.riskProfile === 'custom') {
            const riskProfileSelect = document.getElementById('riskProfile');
            const customOption = riskProfileSelect?.querySelector('option[value="custom"]');
            if (customOption) {
                customOption.style.display = 'block';
            }
        }
        
        this.setInputValue('inflationRate', validated.inflationRate);
        this.setInputValue('endAge', validated.endAge);

        // Update legacy parameters (for backward compatibility)
        this.setInputValue('retirementAgeA', validated.retirementAgeA);
        this.setInputValue('retirementAgeB', validated.retirementAgeB);
        this.setInputValue('retirementAgeC', validated.retirementAgeC);
        this.setInputValue('accumulationReturn', validated.accumulationReturn);
        this.setInputValue('retirementReturn', validated.retirementReturn);
        this.setInputValue('volatility', validated.volatility);
        this.setSelectValue('monteCarloRuns', validated.monteCarloRuns);
        this.setSelectValue('accountType', validated.accountType);
        this.setInputValue('socialSecurityAge', validated.socialSecurityAge);
        this.setInputValue('socialSecurityBenefit', validated.socialSecurityBenefit.toLocaleString());
        this.setSelectValue('healthcareMultiplier', validated.healthcareMultiplier);

        // Apply financial modeling parameters (if form elements exist)
        this.setSelectValue('filingStatus', validated.filingStatus);
        this.setInputValue('expectedSsBenefit', validated.expectedSsBenefit);
        this.setInputValue('ssStartAge', validated.ssStartAge);
        this.setInputValue('lifeExpectancy', validated.lifeExpectancy);
        this.setInputValue('currentTaxRate', validated.currentTaxRate);
        this.setInputValue('retirementTaxRate', validated.retirementTaxRate);
        this.setInputValue('healthcareInflation', validated.healthcareInflation);

        return validated;
    }

    /**
     * Helper to safely set input value
     */
    static setInputValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    /**
     * Helper to safely set select value
     */
    static setSelectValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    /**
     * Collect current parameters from form
     */
    static collectParametersFromForm() {
        return {
            // NEW: Primary parameters for savings-focused approach
            startingAge: this.getIntValue('startingAge'),
            targetRetirementAge: this.getIntValue('targetRetirementAge'),
            currentSavingsRate: this.getFloatValue('currentSavingsRate'),
            targetIncome: this.getCurrencyValue('targetIncome'),
            startingBalance: this.getCurrencyValue('startingBalance'),
            currentIncome: this.getCurrencyValue('currentIncome'),
            state: this.getSelectValue('state'),
            riskProfile: this.getSelectValue('riskProfile'),
            inflationRate: this.getFloatValue('inflationRate'),
            endAge: this.getIntValue('endAge'),
            
            // Legacy parameters for backward compatibility
            retirementAgeA: this.getIntValue('retirementAgeA') || 40,
            retirementAgeB: this.getIntValue('retirementAgeB') || 45,
            retirementAgeC: this.getIntValue('retirementAgeC') || 50,
            accumulationReturn: this.getFloatValue('accumulationReturn'),
            retirementReturn: this.getFloatValue('retirementReturn'),
            volatility: this.getFloatValue('volatility'),
            monteCarloRuns: this.getIntValue('monteCarloRuns'),
            accountType: this.getSelectValue('accountType'),
            socialSecurityAge: this.getIntValue('socialSecurityAge'),
            socialSecurityBenefit: this.getCurrencyValue('socialSecurityBenefit'),
            healthcareMultiplier: this.getFloatValue('healthcareMultiplier'),
            
            // Financial modeling parameters for tax and optimization calculations
            filingStatus: this.getSelectValue('filingStatus'),
            expectedSsBenefit: this.getCurrencyValue('expectedSsBenefit'),
            ssStartAge: this.getIntValue('ssStartAge'),
            lifeExpectancy: this.getIntValue('lifeExpectancy'),
            currentTaxRate: this.getFloatValue('currentTaxRate'),
            retirementTaxRate: this.getFloatValue('retirementTaxRate'),
            healthcareInflation: this.getFloatValue('healthcareInflation')
        };
    }

    /**
     * Helper methods for safe value extraction
     */
    static getIntValue(id) {
        const element = document.getElementById(id);
        return element ? parseInt(element.value) || 0 : 0;
    }

    static getFloatValue(id) {
        const element = document.getElementById(id);
        return element ? parseFloat(element.value) || 0 : 0;
    }

    static getCurrencyValue(id) {
        const element = document.getElementById(id);
        return element ? FinancialCalculations.parseCurrency(element.value) : 0;
    }

    static getSelectValue(id) {
        const element = document.getElementById(id);
        return element ? element.value : '';
    }

    /**
     * Set up automatic state saving on form changes
     */
    static setupAutoSave() {
        const inputs = document.querySelectorAll('.retirement-calculator input');
        
        // Debounce function to limit URL updates
        let timeout;
        const debouncedSave = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const params = this.collectParametersFromForm();
                this.saveState(params);
            }, 500); // Save state 500ms after user stops typing
        };

        // Add event listeners to all inputs
        inputs.forEach(input => {
            input.addEventListener('input', debouncedSave);
            input.addEventListener('change', debouncedSave);
        });
    }

    /**
     * Listen for browser back/forward navigation
     */
    static setupPopstateListener(updateCallback) {
        window.addEventListener('popstate', () => {
            const params = this.loadState();
            this.applyParametersToForm(params);
            if (updateCallback) {
                updateCallback();
            }
        });
    }
}

// Export for use in other modules
window.URLStateManager = URLStateManager;