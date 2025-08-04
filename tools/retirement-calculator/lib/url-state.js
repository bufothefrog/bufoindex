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
            startingAge: 25,
            retirementAgeA: 40,
            retirementAgeB: 45,
            retirementAgeC: 50,
            targetIncome: 120000,
            startingBalance: 100000,
            inflationRate: 3,
            annualReturn: 10,
            // New enhanced parameters
            currentIncome: 80000,
            accumulationReturn: 10,
            retirementReturn: 7,
            volatility: 15,
            monteCarloRuns: 1000,
            accountType: 'Traditional 401k/IRA',
            state: 'California',
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
     * Validate and sanitize parameters
     */
    static validateParameters(params) {
        const validated = { ...params };

        // Age validations
        validated.startingAge = Math.max(18, Math.min(100, validated.startingAge));
        validated.retirementAgeA = Math.max(30, Math.min(100, validated.retirementAgeA));
        validated.retirementAgeB = Math.max(30, Math.min(100, validated.retirementAgeB));
        validated.retirementAgeC = Math.max(30, Math.min(100, validated.retirementAgeC));

        // Ensure retirement ages are after starting age
        validated.retirementAgeA = Math.max(validated.startingAge + 1, validated.retirementAgeA);
        validated.retirementAgeB = Math.max(validated.startingAge + 1, validated.retirementAgeB);
        validated.retirementAgeC = Math.max(validated.startingAge + 1, validated.retirementAgeC);

        // Financial validations
        validated.targetIncome = Math.max(1000, validated.targetIncome);
        validated.startingBalance = Math.max(0, validated.startingBalance);
        validated.inflationRate = Math.max(0, Math.min(20, validated.inflationRate));
        validated.annualReturn = Math.max(0, Math.min(30, validated.annualReturn));

        // Enhanced parameter validations
        validated.currentIncome = Math.max(1000, validated.currentIncome || 80000);
        validated.accumulationReturn = Math.max(0, Math.min(30, validated.accumulationReturn || validated.annualReturn));
        validated.retirementReturn = Math.max(0, Math.min(20, validated.retirementReturn || (validated.annualReturn * 0.7)));
        validated.volatility = Math.max(0, Math.min(50, validated.volatility || 15));
        validated.monteCarloRuns = Math.max(100, Math.min(10000, validated.monteCarloRuns || 1000));
        validated.socialSecurityAge = Math.max(62, Math.min(70, validated.socialSecurityAge || 67));
        validated.socialSecurityBenefit = Math.max(0, Math.min(10000, validated.socialSecurityBenefit || 2000));
        validated.healthcareMultiplier = Math.max(0.5, Math.min(3.0, validated.healthcareMultiplier || 1.0));
        
        // Legacy parameter validations (for backwards compatibility)
        validated.expectedSsBenefit = Math.max(0, Math.min(5000, validated.expectedSsBenefit || validated.socialSecurityBenefit));
        validated.ssStartAge = Math.max(62, Math.min(70, validated.ssStartAge || validated.socialSecurityAge));
        validated.lifeExpectancy = Math.max(70, Math.min(100, validated.lifeExpectancy || 85));
        validated.currentTaxRate = Math.max(0, Math.min(50, validated.currentTaxRate || 22));
        validated.retirementTaxRate = Math.max(0, Math.min(50, validated.retirementTaxRate || 15));
        validated.healthcareInflation = Math.max(0, Math.min(20, validated.healthcareInflation || 5));

        // String validations with defaults
        const validAccountTypes = ['Traditional 401k/IRA', 'Roth', 'Taxable'];
        if (!validAccountTypes.includes(validated.accountType)) {
            validated.accountType = 'Traditional 401k/IRA';
        }

        const validStates = ['California', 'Federal Only'];
        if (!validStates.includes(validated.state)) {
            validated.state = 'California';
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

        // Update basic form inputs
        this.setInputValue('startingAge', validated.startingAge);
        this.setInputValue('retirementAgeA', validated.retirementAgeA);
        this.setInputValue('retirementAgeB', validated.retirementAgeB);
        this.setInputValue('retirementAgeC', validated.retirementAgeC);
        this.setInputValue('targetIncome', validated.targetIncome.toLocaleString());
        this.setInputValue('startingBalance', validated.startingBalance.toLocaleString());
        this.setInputValue('inflationRate', validated.inflationRate);
        this.setInputValue('annualReturn', validated.annualReturn);

        // Update enhanced parameters
        this.setInputValue('currentIncome', validated.currentIncome.toLocaleString());
        this.setInputValue('accumulationReturn', validated.accumulationReturn);
        this.setInputValue('retirementReturn', validated.retirementReturn);
        this.setInputValue('volatility', validated.volatility);
        this.setSelectValue('monteCarloRuns', validated.monteCarloRuns);
        this.setSelectValue('accountType', validated.accountType);
        this.setSelectValue('state', validated.state);
        this.setInputValue('socialSecurityAge', validated.socialSecurityAge);
        this.setInputValue('socialSecurityBenefit', validated.socialSecurityBenefit.toLocaleString());
        this.setSelectValue('healthcareMultiplier', validated.healthcareMultiplier);

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
            // Basic parameters
            startingAge: this.getIntValue('startingAge'),
            retirementAgeA: this.getIntValue('retirementAgeA'),
            retirementAgeB: this.getIntValue('retirementAgeB'),
            retirementAgeC: this.getIntValue('retirementAgeC'),
            targetIncome: this.getCurrencyValue('targetIncome'),
            startingBalance: this.getCurrencyValue('startingBalance'),
            inflationRate: this.getFloatValue('inflationRate'),
            annualReturn: this.getFloatValue('annualReturn'),
            
            // Enhanced parameters
            currentIncome: this.getCurrencyValue('currentIncome'),
            accumulationReturn: this.getFloatValue('accumulationReturn'),
            retirementReturn: this.getFloatValue('retirementReturn'),
            volatility: this.getFloatValue('volatility'),
            monteCarloRuns: this.getIntValue('monteCarloRuns'),
            accountType: this.getSelectValue('accountType'),
            state: this.getSelectValue('state'),
            socialSecurityAge: this.getIntValue('socialSecurityAge'),
            socialSecurityBenefit: this.getCurrencyValue('socialSecurityBenefit'),
            healthcareMultiplier: this.getFloatValue('healthcareMultiplier')
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