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
            annualReturn: 10
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

        return validated;
    }

    /**
     * Apply parameters to form inputs
     */
    static applyParametersToForm(params) {
        const validated = this.validateParameters(params);

        // Update form inputs
        document.getElementById('startingAge').value = validated.startingAge;
        document.getElementById('retirementAgeA').value = validated.retirementAgeA;
        document.getElementById('retirementAgeB').value = validated.retirementAgeB;
        document.getElementById('retirementAgeC').value = validated.retirementAgeC;
        document.getElementById('targetIncome').value = validated.targetIncome.toLocaleString();
        document.getElementById('startingBalance').value = validated.startingBalance.toLocaleString();
        document.getElementById('inflationRate').value = validated.inflationRate;
        document.getElementById('annualReturn').value = validated.annualReturn;

        return validated;
    }

    /**
     * Collect current parameters from form
     */
    static collectParametersFromForm() {
        return {
            startingAge: parseInt(document.getElementById('startingAge').value),
            retirementAgeA: parseInt(document.getElementById('retirementAgeA').value),
            retirementAgeB: parseInt(document.getElementById('retirementAgeB').value),
            retirementAgeC: parseInt(document.getElementById('retirementAgeC').value),
            targetIncome: FinancialCalculations.parseCurrency(document.getElementById('targetIncome').value),
            startingBalance: FinancialCalculations.parseCurrency(document.getElementById('startingBalance').value),
            inflationRate: parseFloat(document.getElementById('inflationRate').value),
            annualReturn: parseFloat(document.getElementById('annualReturn').value)
        };
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