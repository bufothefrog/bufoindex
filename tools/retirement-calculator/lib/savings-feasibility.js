/**
 * Savings Feasibility Engine
 * Determines realistic savings rates based on income, location, and behavioral factors
 */

class SavingsFeasibility {
    
    /**
     * State cost of living tiers for savings capacity calculation
     */
    static STATE_COL_TIERS = {
        // Very High COL - Tier 1
        'HI': 1, 'CA': 1, 'NY': 1, 'MA': 1, 'AK': 1, 'DC': 1,
        
        // High COL - Tier 2  
        'CT': 2, 'NJ': 2, 'MD': 2, 'WA': 2, 'OR': 2, 'NH': 2, 'VT': 2,
        
        // Moderate COL - Tier 3
        'VA': 3, 'CO': 3, 'FL': 3, 'TX': 3, 'AZ': 3, 'NV': 3, 'NC': 3, 
        'GA': 3, 'UT': 3, 'TN': 3, 'SC': 3, 'RI': 3, 'DE': 3, 'ME': 3,
        
        // Low COL - Tier 4 (default for unlisted states)
        'AL': 4, 'AR': 4, 'ID': 4, 'IN': 4, 'IA': 4, 'KS': 4, 'KY': 4,
        'LA': 4, 'MI': 4, 'MN': 4, 'MS': 4, 'MO': 4, 'MT': 4, 'NE': 4,
        'ND': 4, 'OH': 4, 'OK': 4, 'PA': 4, 'SD': 4, 'WV': 4, 'WI': 4, 'WY': 4
    };

    /**
     * Risk profiles for investment returns
     */
    static RISK_PROFILES = {
        'conservative': {
            name: 'Conservative',
            accumulation: { return: 0.06, volatility: 0.10 },
            retirement: { return: 0.04, volatility: 0.08 }
        },
        'moderate': {
            name: 'Moderate',
            accumulation: { return: 0.08, volatility: 0.12 },
            retirement: { return: 0.06, volatility: 0.10 }
        },
        'aggressive': {
            name: 'Aggressive',
            accumulation: { return: 0.10, volatility: 0.15 },
            retirement: { return: 0.07, volatility: 0.12 }
        },
        'tdf': {
            name: 'Target Date Fund (TDF)',
            accumulation: { return: 0.085, volatility: 0.13 }, // Default values, will be calculated dynamically
            retirement: { return: 0.055, volatility: 0.10 }
        }
    };

    /**
     * Calculate maximum realistic savings rate based on income and location
     * @param {number} income - Annual gross income
     * @param {string} state - Two-letter state code
     * @returns {number} - Maximum realistic savings rate (decimal)
     */
    static calculateMaxRealisticSavings(income, state = 'TX') {
        const colTier = this.STATE_COL_TIERS[state.toUpperCase()] || 4;
        
        // Base savings capacity by COL tier
        const baseCapacity = {
            1: 0.35, // Very High COL: max 35%
            2: 0.40, // High COL: max 40%
            3: 0.45, // Moderate COL: max 45%
            4: 0.50  // Low COL: max 50%
        };
        
        // Income adjustments - higher income allows higher savings rates
        let incomeMultiplier = 1.0;
        if (income < 40000) {
            incomeMultiplier = 0.6; // Much harder to save on low income
        } else if (income < 80000) {
            incomeMultiplier = 0.8; // Moderate difficulty
        } else if (income < 150000) {
            incomeMultiplier = 1.0; // Normal capacity
        } else {
            // High earners can often save more
            incomeMultiplier = Math.min(1.4, 1.0 + (income - 150000) / 500000);
        }
        
        return Math.min(0.70, baseCapacity[colTier] * incomeMultiplier);
    }

    /**
     * Assess the difficulty/realism of increasing savings rate
     * @param {number} currentRate - Current savings rate (decimal)
     * @param {number} targetRate - Target savings rate (decimal)
     * @param {number} income - Annual gross income
     * @param {string} state - Two-letter state code
     * @returns {Object} - Realism assessment with score and rating
     */
    static assessSavingsRateIncrease(currentRate, targetRate, income, state = 'TX') {
        const maxRealistic = this.calculateMaxRealisticSavings(income, state);
        
        // Component 1: Absolute feasibility (can they even save that much?)
        const absoluteScore = targetRate <= maxRealistic ? 100 : 
                             Math.max(0, 100 * (maxRealistic / targetRate));
        
        // Component 2: Behavioral feasibility (how big is the jump?)
        const rateIncrease = Math.max(0, targetRate - currentRate);
        // Non-linear penalty - larger increases are disproportionately harder
        const difficultyMultiplier = Math.pow(rateIncrease / 0.10, 1.5);
        const behavioralScore = Math.max(0, 100 - (difficultyMultiplier * 20));
        
        // Component 3: Income cushion (higher income = easier to adjust)
        const incomeScore = Math.min(100, income / 1000); // Caps at $100k
        
        // Weighted combination
        const totalScore = (absoluteScore * 0.5) + 
                          (behavioralScore * 0.35) + 
                          (incomeScore * 0.15);
        
        return {
            score: totalScore,
            rating: this.getRealismRating(totalScore),
            maxRealistic: maxRealistic,
            components: {
                absolute: absoluteScore,
                behavioral: behavioralScore,
                income: incomeScore
            },
            rateIncrease: rateIncrease
        };
    }

    /**
     * Convert numerical score to text rating
     * @param {number} score - Score from 0-100
     * @returns {string} - Text rating
     */
    static getRealismRating(score) {
        if (score >= 80) return "Highly Realistic";
        if (score >= 60) return "Challenging but Achievable";
        if (score >= 40) return "Unlikely";
        return "Unrealistic";
    }

    /**
     * Get confidence level for display (0-100%)
     * @param {number} score - Realism score
     * @returns {number} - Confidence percentage
     */
    static getConfidenceLevel(score) {
        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Calculate savings rate required to achieve retirement goal
     * @param {Object} params - Retirement goal parameters
     * @returns {number} - Required savings rate (decimal)
     */
    static calculateRequiredSavingsRate(params) {
        const {
            currentAge,
            targetAge,
            targetIncome,
            currentIncome,
            startingBalance,
            inflationRate = 0.03,
            annualReturn = 0.08
        } = params;

        const yearsToRetirement = targetAge - currentAge;
        if (yearsToRetirement <= 0) return 0;

        // Calculate inflation-adjusted target income
        const inflatedTargetIncome = targetIncome * Math.pow(1 + inflationRate, yearsToRetirement);
        
        // Portfolio size needed (4% rule)
        const targetPortfolioSize = inflatedTargetIncome / 0.04;
        
        // Calculate required annual contribution
        let requiredAnnualContribution = 0;
        if (annualReturn === 0) {
            requiredAnnualContribution = (targetPortfolioSize - startingBalance) / yearsToRetirement;
        } else {
            const factor = Math.pow(1 + annualReturn, yearsToRetirement);
            const numerator = targetPortfolioSize - startingBalance * factor;
            const denominator = (factor - 1) / annualReturn;
            requiredAnnualContribution = numerator / denominator;
        }

        // Convert to savings rate (allow negative values for Coast FIRE analysis)
        const requiredSavingsRate = requiredAnnualContribution / currentIncome;
        
        return requiredSavingsRate;
    }

    /**
     * Generate three savings rate scenarios for analysis
     * @param {number} currentSavingsRate - Current savings rate (decimal)
     * @returns {Array} - Array of three scenarios
     */
    static generateSavingsRateScenarios(currentSavingsRate) {
        return [
            {
                label: 'Current',
                rate: currentSavingsRate,
                description: 'Your current savings rate'
            },
            {
                label: 'Moderate',
                rate: currentSavingsRate + 0.10,
                description: 'Current rate + 10% increase'
            },
            {
                label: 'Aggressive',
                rate: currentSavingsRate + 0.20,
                description: 'Current rate + 20% increase'
            }
        ];
    }

    /**
     * Calculate income growth over time
     * @param {number} currentIncome - Current annual income
     * @param {number} currentAge - Current age
     * @param {number} yearsToProject - Number of years to project
     * @returns {Array} - Array of income projections by year
     */
    static calculateIncomeGrowth(currentIncome, currentAge, yearsToProject) {
        const projections = [];
        let income = currentIncome;
        
        for (let year = 0; year < yearsToProject; year++) {
            const age = currentAge + year;
            
            // Base real wage growth: 1% above inflation
            let growthRate = 0.01;
            
            // Career progression boost
            if (age >= 25 && age <= 45) {
                growthRate += 0.02; // +2% for prime career years
            } else if (age > 45 && age <= 55) {
                growthRate += 0.01; // +1% for senior years
            }
            // No additional growth after 55
            
            income = income * (1 + growthRate);
            projections.push({
                year: year,
                age: age,
                income: Math.round(income)
            });
        }
        
        return projections;
    }

    /**
     * Get risk profile data
     * @param {string} profileName - Name of risk profile
     * @param {number} age - Current age (required for TDF calculations)
     * @returns {Object} - Risk profile data
     */
    static getRiskProfile(profileName = 'moderate', age = null) {
        if (profileName === 'tdf' && age !== null) {
            return this.calculateTDFProfile(age);
        }
        return this.RISK_PROFILES[profileName] || this.RISK_PROFILES.moderate;
    }

    /**
     * Calculate Target Date Fund asset allocation based on age
     * Uses modern glide path: aggressive when young, gradually becoming conservative
     * @param {number} age - Current age
     * @returns {Object} - Asset allocation percentages
     */
    static calculateTDFAllocation(age) {
        // Clamp age to reasonable bounds
        const clampedAge = Math.max(18, Math.min(100, age));
        
        // Modern TDF glide path: starts aggressive and gradually becomes conservative
        // At age 25: ~90% stocks, 10% bonds
        // At age 65: ~40% stocks, 60% bonds  
        // At age 85: ~30% stocks, 70% bonds
        
        let stockAllocation;
        if (clampedAge <= 25) {
            stockAllocation = 0.90;
        } else if (clampedAge <= 65) {
            // Linear decrease from 90% to 40% between ages 25-65
            stockAllocation = 0.90 - ((clampedAge - 25) / 40) * 0.50;
        } else {
            // Slower decrease from 40% to 30% between ages 65-85
            const ageAfter65 = Math.min(20, clampedAge - 65);
            stockAllocation = 0.40 - (ageAfter65 / 20) * 0.10;
        }
        
        const bondAllocation = 1 - stockAllocation;
        
        return {
            stocks: stockAllocation,
            bonds: bondAllocation,
            age: clampedAge
        };
    }

    /**
     * Calculate TDF risk profile based on current age
     * @param {number} age - Current age
     * @returns {Object} - Risk profile with age-adjusted returns and volatility
     */
    static calculateTDFProfile(age) {
        const allocation = this.calculateTDFAllocation(age);
        
        // Expected returns: Stocks ~10%, Bonds ~4%
        const stockReturn = 0.10;
        const bondReturn = 0.04;
        
        // Volatility: Stocks ~18%, Bonds ~6%
        const stockVolatility = 0.18;
        const bondVolatility = 0.06;
        
        // Calculate blended returns and volatility
        const blendedReturn = (allocation.stocks * stockReturn) + (allocation.bonds * bondReturn);
        const blendedVolatility = Math.sqrt(
            Math.pow(allocation.stocks * stockVolatility, 2) + 
            Math.pow(allocation.bonds * bondVolatility, 2)
        );
        
        // For retirement phase, use slightly more conservative allocation
        const retirementAge = Math.min(100, age + 30); // Project 30 years ahead
        const retirementAllocation = this.calculateTDFAllocation(retirementAge);
        const retirementReturn = (retirementAllocation.stocks * stockReturn) + (retirementAllocation.bonds * bondReturn);
        const retirementVolatility = Math.sqrt(
            Math.pow(retirementAllocation.stocks * stockVolatility, 2) + 
            Math.pow(retirementAllocation.bonds * bondVolatility, 2)
        );
        
        return {
            name: `Target Date Fund (Age ${age})`,
            accumulation: { 
                return: blendedReturn, 
                volatility: blendedVolatility 
            },
            retirement: { 
                return: retirementReturn, 
                volatility: retirementVolatility 
            },
            allocation: allocation,
            details: {
                currentAllocation: `${Math.round(allocation.stocks * 100)}% stocks, ${Math.round(allocation.bonds * 100)}% bonds`,
                projectedRetirementAllocation: `${Math.round(retirementAllocation.stocks * 100)}% stocks, ${Math.round(retirementAllocation.bonds * 100)}% bonds`
            }
        };
    }

    /**
     * Get all available risk profiles
     * @returns {Object} - All risk profiles
     */
    static getAllRiskProfiles() {
        return this.RISK_PROFILES;
    }

    /**
     * Get state COL tier
     * @param {string} state - Two-letter state code
     * @returns {number} - COL tier (1-4)
     */
    static getStateCOLTier(state) {
        return this.STATE_COL_TIERS[state.toUpperCase()] || 4;
    }

    /**
     * Get all states grouped by COL tier
     * @returns {Object} - States grouped by tier
     */
    static getStatesByTier() {
        const tiers = { 1: [], 2: [], 3: [], 4: [] };
        
        Object.entries(this.STATE_COL_TIERS).forEach(([state, tier]) => {
            tiers[tier].push(state);
        });
        
        return tiers;
    }
}

// Export for use in other modules
window.SavingsFeasibility = SavingsFeasibility;