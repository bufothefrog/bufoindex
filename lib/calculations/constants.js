/**
 * Financial Constants
 * Centralized constants for retirement calculator
 */

class FinancialConstants {
    // Core Financial Rules
    static WITHDRAWAL_RATE = 0.04;                  // 4% withdrawal rule
    static SAFE_WITHDRAWAL_RATE = 0.035;            // Conservative 3.5% withdrawal rate
    
    // Age Limits
    static MIN_STARTING_AGE = 18;
    static MAX_RETIREMENT_AGE = 100;
    static MIN_RETIREMENT_AGE = 30;
    static DEFAULT_LIFE_EXPECTANCY = 85;
    static MAX_LIFE_EXPECTANCY = 110;
    
    // Savings Rates
    static MAX_SAVINGS_RATE = 0.80;                 // 80% maximum realistic savings rate
    static DEFAULT_SAVINGS_RATE = 0.15;             // 15% default savings rate
    static MIN_SAVINGS_RATE = 0.01;                 // 1% minimum savings rate
    
    // Return Rates (annual)
    static MIN_RETURN_RATE = -0.50;                 // -50% minimum return (market crash)
    static MAX_RETURN_RATE = 0.30;                  // 30% maximum return
    static DEFAULT_ACCUMULATION_RETURN = 0.08;      // 8% default accumulation return
    static DEFAULT_RETIREMENT_RETURN = 0.06;        // 6% default retirement return
    
    // Inflation
    static MIN_INFLATION_RATE = 0.00;               // 0% minimum inflation
    static MAX_INFLATION_RATE = 0.20;               // 20% maximum inflation
    static DEFAULT_INFLATION_RATE = 0.03;           // 3% default inflation
    static HEALTHCARE_INFLATION_DEFAULT = 0.05;     // 5% healthcare inflation
    
    // Income Limits
    static MIN_INCOME = 1000;                       // $1,000 minimum annual income
    static MAX_INCOME = 10000000;                   // $10M maximum income
    static DEFAULT_CURRENT_INCOME = 80000;          // $80,000 default current income
    static DEFAULT_TARGET_INCOME = 120000;          // $120,000 default target income
    
    // Starting Balance
    static MIN_STARTING_BALANCE = 0;                // $0 minimum starting balance
    static DEFAULT_STARTING_BALANCE = 100000;       // $100,000 default starting balance
    
    // Volatility
    static MIN_VOLATILITY = 0.00;                   // 0% minimum volatility
    static MAX_VOLATILITY = 0.50;                   // 50% maximum volatility
    static DEFAULT_VOLATILITY = 0.15;               // 15% default volatility
    
    // Monte Carlo Simulation - Smart Defaults
    static MONTE_CARLO_SIMPLE = 1000;               // Simple scenarios (1-2 retirement ages)
    static MONTE_CARLO_STANDARD = 2000;             // Standard scenarios (3 retirement ages)
    static MONTE_CARLO_COMPLEX = 3000;              // Complex scenarios (high volatility/long timeframes)
    static MONTE_CARLO_MAX_SAFE = 3000;             // Maximum safe runs to prevent browser freezing
    
    // Social Security
    static MIN_SS_AGE = 62;                         // Earliest SS claiming age
    static MAX_SS_AGE = 70;                         // Latest SS claiming age
    static DEFAULT_SS_AGE = 67;                     // Full retirement age
    static MIN_SS_BENEFIT = 0;                      // Minimum SS benefit
    static MAX_SS_BENEFIT = 10000;                  // Maximum monthly SS benefit
    static DEFAULT_SS_BENEFIT = 2000;               // Default monthly SS benefit
    
    // Healthcare
    static MIN_HEALTHCARE_MULTIPLIER = 0.5;         // 50% of average healthcare costs
    static MAX_HEALTHCARE_MULTIPLIER = 3.0;         // 300% of average healthcare costs
    static DEFAULT_HEALTHCARE_MULTIPLIER = 1.0;     // 100% of average healthcare costs
    
    // Tax Rates
    static MIN_TAX_RATE = 0.00;                     // 0% minimum tax rate
    static MAX_TAX_RATE = 0.50;                     // 50% maximum tax rate
    static DEFAULT_CURRENT_TAX_RATE = 0.22;         // 22% default current tax rate
    static DEFAULT_RETIREMENT_TAX_RATE = 0.15;      // 15% default retirement tax rate
    
    // Performance Thresholds
    static HIGH_SUCCESS_RATE = 0.90;                // 90% success rate threshold
    static MEDIUM_SUCCESS_RATE = 0.70;              // 70% success rate threshold
    static LOW_SUCCESS_RATE = 0.50;                 // 50% success rate threshold
    
    // Realism Score Thresholds
    static REALISTIC_SCORE_THRESHOLD = 60;          // 60+ score is considered realistic
    static CHALLENGING_SCORE_THRESHOLD = 40;       // 40-59 is challenging but possible
    static UNREALISTIC_SCORE_THRESHOLD = 20;       // <20 is unrealistic
    
    // UI/UX Constants
    static DEBOUNCE_DELAY_MS = 300;                 // 300ms debounce delay for inputs
    static CHART_UPDATE_DELAY_MS = 100;             // 100ms delay for chart updates
    static CACHE_TIMEOUT_MS = 300000;               // 5 minutes cache timeout
    
    // Chart Data Points
    static CHART_AGE_STEP = 2;                      // 2-year steps for age charts
    static MAX_CHART_POINTS = 50;                   // Maximum data points in charts
    
    // Validation Messages
    static ERROR_MESSAGES = {
        INVALID_AGE: 'Age must be between 18 and 100',
        INVALID_INCOME: 'Income must be at least $1,000',
        INVALID_SAVINGS_RATE: 'Savings rate must be between 0% and 80%',
        INVALID_RETURN_RATE: 'Return rate must be between -50% and 30%',
        IMPOSSIBLE_GOAL: 'Retirement goal is mathematically impossible with these parameters'
    };
    
    /**
     * Get withdrawal rate based on risk preference
     */
    static getWithdrawalRate(riskLevel = 'moderate') {
        switch (riskLevel) {
            case 'conservative': return 0.035;  // 3.5%
            case 'moderate': return 0.04;       // 4%
            case 'aggressive': return 0.045;    // 4.5%
            default: return this.WITHDRAWAL_RATE;
        }
    }
    
    /**
     * Get realistic savings rate bounds based on income and location
     */
    static getSavingsRateBounds(income, costOfLivingTier = 3) {
        const baseCapacity = {
            1: 0.35, // Very High COL: max 35%
            2: 0.40, // High COL: max 40%
            3: 0.45, // Moderate COL: max 45%
            4: 0.50  // Low COL: max 50%
        };
        
        let incomeMultiplier = 1.0;
        if (income < 40000) {
            incomeMultiplier = 0.6;
        } else if (income < 80000) {
            incomeMultiplier = 0.8;
        } else if (income > 150000) {
            incomeMultiplier = Math.min(1.4, 1.0 + (income - 150000) / 500000);
        }
        
        return {
            min: this.MIN_SAVINGS_RATE,
            max: Math.min(this.MAX_SAVINGS_RATE, baseCapacity[costOfLivingTier] * incomeMultiplier),
            recommended: Math.min(0.20, baseCapacity[costOfLivingTier] * incomeMultiplier * 0.6)
        };
    }
    
    /**
     * Validate parameter against constants
     */
    static validateParameter(value, type) {
        switch (type) {
            case 'age':
                return Math.max(this.MIN_STARTING_AGE, Math.min(this.MAX_RETIREMENT_AGE, value));
            case 'savingsRate':
                return Math.max(this.MIN_SAVINGS_RATE, Math.min(this.MAX_SAVINGS_RATE, value));
            case 'returnRate':
                return Math.max(this.MIN_RETURN_RATE, Math.min(this.MAX_RETURN_RATE, value));
            case 'inflationRate':
                return Math.max(this.MIN_INFLATION_RATE, Math.min(this.MAX_INFLATION_RATE, value));
            case 'income':
                return Math.max(this.MIN_INCOME, Math.min(this.MAX_INCOME, value));
            default:
                return value;
        }
    }
}

// Export for use in other modules
window.FinancialConstants = FinancialConstants;