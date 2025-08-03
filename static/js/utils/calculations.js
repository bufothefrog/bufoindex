/**
 * Financial Calculations Utility
 * Core mathematical functions for retirement planning
 */

class FinancialCalculations {
    /**
     * Format number as currency without symbol (for terminal display)
     */
    static formatCurrency(amount) {
        return Math.round(amount).toLocaleString();
    }

    /**
     * Parse currency input (handles $ symbols and commas)
     */
    static parseCurrency(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace(/[$,]/g, '')) || 0;
        }
        return value || 0;
    }

    /**
     * Calculate future value with compound interest
     */
    static futureValue(presentValue, rate, periods) {
        return presentValue * Math.pow(1 + rate, periods);
    }

    /**
     * Calculate present value (reverse of future value)
     */
    static presentValue(futureValue, rate, periods) {
        return futureValue / Math.pow(1 + rate, periods);
    }

    /**
     * Calculate required payment (PMT) using the annuity formula
     * PMT = (FV - PV * (1 + r)^n) / (((1 + r)^n - 1) / r)
     */
    static calculateRequiredPayment(presentValue, futureValue, rate, periods) {
        if (periods <= 0) return 0;
        
        if (rate === 0) {
            return (futureValue - presentValue) / periods;
        }
        
        const factor = Math.pow(1 + rate, periods);
        const numerator = futureValue - presentValue * factor;
        const denominator = (factor - 1) / rate;
        return numerator / denominator;
    }

    /**
     * Calculate inflation-adjusted income
     */
    static inflationAdjustedIncome(baseIncome, inflationRate, years) {
        return baseIncome * Math.pow(1 + inflationRate, years);
    }

    /**
     * Calculate portfolio size needed for 4% withdrawal rule
     */
    static portfolioSizeForWithdrawal(annualIncome, withdrawalRate = 0.04) {
        return annualIncome / withdrawalRate;
    }

    /**
     * Calculate a single retirement scenario
     */
    static calculateScenario(params) {
        const {
            startingAge,
            retirementAge,
            targetIncome,
            startingBalance,
            inflationRate,
            annualReturn
        } = params;

        const yearsUntilRetirement = retirementAge - startingAge;
        
        if (yearsUntilRetirement <= 0) {
            return {
                yearsUntilRetirement: 0,
                targetPortfolioSize: 0,
                monthlyContribution: 0,
                inflatedTargetIncome: targetIncome,
                valid: false
            };
        }
        
        // Calculate inflation-adjusted target income at retirement
        const inflatedTargetIncome = this.inflationAdjustedIncome(
            targetIncome, 
            inflationRate, 
            yearsUntilRetirement
        );
        
        // Portfolio size needed (using 4% withdrawal rule)
        const targetPortfolioSize = this.portfolioSizeForWithdrawal(inflatedTargetIncome);
        
        // Calculate required annual contribution
        const annualContribution = this.calculateRequiredPayment(
            startingBalance, 
            targetPortfolioSize, 
            annualReturn, 
            yearsUntilRetirement
        );
        
        const monthlyContribution = annualContribution / 12;

        return {
            yearsUntilRetirement,
            targetPortfolioSize,
            monthlyContribution: Math.max(0, monthlyContribution),
            inflatedTargetIncome,
            annualContribution: Math.max(0, annualContribution),
            valid: true
        };
    }

    /**
     * Generate net worth progression over time
     */
    static generateNetWorthProgression(scenario, params) {
        const { startingAge, startingBalance, annualReturn, inflationRate } = params;
        const { retirementAge, targetPortfolioSize, inflatedTargetIncome, annualContribution } = scenario;
        
        const progression = [];
        
        // Generate data from starting age to 100
        for (let age = startingAge; age <= 100; age++) {
            let netWorth = 0;
            
            if (age < retirementAge) {
                // Accumulation phase
                const yearsFromStart = age - startingAge;
                netWorth = startingBalance;
                
                // Apply compound growth and annual contributions
                for (let year = 0; year < yearsFromStart; year++) {
                    netWorth = netWorth * (1 + annualReturn) + annualContribution;
                }
            } else {
                // Retirement phase - start with target portfolio size
                netWorth = targetPortfolioSize;
                
                // Apply withdrawals and growth for each year since retirement
                const yearsInRetirement = age - retirementAge;
                for (let year = 0; year < yearsInRetirement; year++) {
                    const thisYearWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, year);
                    netWorth = (netWorth - thisYearWithdrawal) * (1 + annualReturn);
                    netWorth = Math.max(0, netWorth);
                }
            }
            
            progression.push({ age, netWorth });
        }
        
        return progression;
    }

    /**
     * Generate withdrawal amounts over time
     */
    static generateWithdrawalProgression(scenario, params) {
        const { retirementAge, inflatedTargetIncome } = scenario;
        const { inflationRate } = params;
        
        const progression = [];
        
        // Generate withdrawals from retirement age to 100
        for (let age = retirementAge; age <= 100; age++) {
            const yearsFromRetirement = age - retirementAge;
            const nominalWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, yearsFromRetirement);
            progression.push({ age, withdrawal: nominalWithdrawal });
        }
        
        return progression;
    }
}

// Export for use in other modules
window.FinancialCalculations = FinancialCalculations;