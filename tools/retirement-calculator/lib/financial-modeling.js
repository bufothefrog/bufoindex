/**
 * Advanced Financial Modeling Module
 * Comprehensive tax, Social Security, and healthcare cost calculations
 * for real-world retirement planning scenarios
 */

class FinancialModeling {
    /**
     * 2024 Federal Tax Brackets
     */
    static FEDERAL_TAX_BRACKETS = {
        single: [
            { min: 0, max: 11600, rate: 0.10 },
            { min: 11600, max: 47150, rate: 0.12 },
            { min: 47150, max: 100525, rate: 0.22 },
            { min: 100525, max: 191675, rate: 0.24 },
            { min: 191675, max: 243725, rate: 0.32 },
            { min: 243725, max: 609350, rate: 0.35 },
            { min: 609350, max: Infinity, rate: 0.37 }
        ],
        marriedFilingJointly: [
            { min: 0, max: 23200, rate: 0.10 },
            { min: 23200, max: 94300, rate: 0.12 },
            { min: 94300, max: 201050, rate: 0.22 },
            { min: 201050, max: 383350, rate: 0.24 },
            { min: 383350, max: 487450, rate: 0.32 },
            { min: 487450, max: 731200, rate: 0.35 },
            { min: 731200, max: Infinity, rate: 0.37 }
        ]
    };

    /**
     * 2024 Standard Deductions
     */
    static STANDARD_DEDUCTIONS = {
        single: 14600,
        marriedFilingJointly: 29200,
        marriedFilingSeparately: 14600,
        headOfHousehold: 21900
    };

    /**
     * 2024 California State Tax Brackets
     */
    static CA_TAX_BRACKETS = {
        single: [
            { min: 0, max: 10099, rate: 0.01 },
            { min: 10099, max: 23942, rate: 0.02 },
            { min: 23942, max: 37788, rate: 0.04 },
            { min: 37788, max: 52455, rate: 0.06 },
            { min: 52455, max: 66295, rate: 0.08 },
            { min: 66295, max: 338639, rate: 0.093 },
            { min: 338639, max: 406364, rate: 0.103 },
            { min: 406364, max: 677278, rate: 0.113 },
            { min: 677278, max: Infinity, rate: 0.133 }
        ],
        marriedFilingJointly: [
            { min: 0, max: 20198, rate: 0.01 },
            { min: 20198, max: 47884, rate: 0.02 },
            { min: 47884, max: 75576, rate: 0.04 },
            { min: 75576, max: 104910, rate: 0.06 },
            { min: 104910, max: 132590, rate: 0.08 },
            { min: 132590, max: 677278, rate: 0.093 },
            { min: 677278, max: 812728, rate: 0.103 },
            { min: 812728, max: 1354556, rate: 0.113 },
            { min: 1354556, max: Infinity, rate: 0.133 }
        ]
    };

    /**
     * California Standard Deductions (2024)
     */
    static CA_STANDARD_DEDUCTIONS = {
        single: 5202,
        marriedFilingJointly: 10404,
        marriedFilingSeparately: 5202,
        headOfHousehold: 10726
    };

    /**
     * Capital Gains Tax Rates (2024)
     */
    static CAPITAL_GAINS_RATES = {
        single: [
            { min: 0, max: 47025, rate: 0.00 },
            { min: 47025, max: 518900, rate: 0.15 },
            { min: 518900, max: Infinity, rate: 0.20 }
        ],
        marriedFilingJointly: [
            { min: 0, max: 94050, rate: 0.00 },
            { min: 94050, max: 583750, rate: 0.15 },
            { min: 583750, max: Infinity, rate: 0.20 }
        ]
    };

    /**
     * Social Security Full Retirement Age by Birth Year
     */
    static SS_FULL_RETIREMENT_AGE = {
        1943: 66.0,
        1954: 66.0,
        1955: 66.17, // 66 and 2 months
        1956: 66.33, // 66 and 4 months
        1957: 66.5,  // 66 and 6 months
        1958: 66.67, // 66 and 8 months
        1959: 66.83, // 66 and 10 months
        1960: 67.0,
        default: 67.0 // For those born 1960 and later
    };

    /**
     * Base Healthcare Costs by Age Group (2024 dollars)
     */
    static BASE_HEALTHCARE_COSTS = {
        25: 3000,
        30: 3200,
        35: 3500,
        40: 4000,
        45: 4800,
        50: 5800,
        55: 7200,
        60: 9000,
        65: 12000, // Medicare transition
        70: 14000,
        75: 16000,
        80: 18000,
        85: 20000,
        90: 22000,
        95: 24000
    };

    /**
     * Calculate comprehensive tax-adjusted withdrawal
     * @param {number} grossIncome - Gross income amount
     * @param {string} accountType - 'Traditional 401k/IRA', 'Roth', 'Taxable'
     * @param {string} state - State for tax calculation (currently supports 'California')
     * @param {number} age - Current age
     * @param {string} filingStatus - 'Single' or 'Married Filing Jointly'
     * @returns {Object} - Comprehensive tax analysis
     */
    static calculateTaxAdjustedWithdrawal(grossIncome, accountType, state = 'California', age = 65, filingStatus = 'Single') {
        const result = {
            grossIncome,
            accountType,
            federalTax: 0,
            stateTax: 0,
            totalTax: 0,
            netIncome: grossIncome,
            effectiveRate: 0,
            marginalRate: 0,
            breakdown: {
                ordinaryIncome: 0,
                capitalGains: 0,
                qualifiedDividends: 0
            }
        };

        // Normalize filing status
        const normalizedFilingStatus = filingStatus.toLowerCase().includes('married') ? 'marriedFilingJointly' : 'single';

        switch (accountType) {
            case 'Traditional 401k/IRA':
                // All withdrawals taxed as ordinary income
                result.breakdown.ordinaryIncome = grossIncome;
                result.federalTax = this.calculateFederalIncomeTax(grossIncome, normalizedFilingStatus);
                if (state === 'California') {
                    result.stateTax = this.calculateCaliforniaIncomeTax(grossIncome, normalizedFilingStatus);
                }
                break;

            case 'Roth':
                // No taxes on qualified withdrawals (assume over 59.5 and account > 5 years old)
                result.federalTax = 0;
                result.stateTax = 0;
                break;

            case 'Taxable':
                // Split between capital gains and dividends (assume 70% capital gains, 30% dividends)
                const capitalGainsAmount = grossIncome * 0.7;
                const dividendsAmount = grossIncome * 0.3;
                
                result.breakdown.capitalGains = capitalGainsAmount;
                result.breakdown.qualifiedDividends = dividendsAmount;
                
                result.federalTax = this.calculateCapitalGainsTax(capitalGainsAmount, normalizedFilingStatus) +
                                  this.calculateCapitalGainsTax(dividendsAmount, normalizedFilingStatus); // Qualified dividends use same rates
                
                if (state === 'California') {
                    // California taxes capital gains as ordinary income
                    result.stateTax = this.calculateCaliforniaIncomeTax(grossIncome, normalizedFilingStatus);
                }
                break;
        }

        result.totalTax = result.federalTax + result.stateTax;
        result.netIncome = result.grossIncome - result.totalTax;
        result.effectiveRate = result.grossIncome > 0 ? result.totalTax / result.grossIncome : 0;
        result.marginalRate = this.calculateMarginalTaxRateSimple(result.grossIncome, accountType, normalizedFilingStatus, state);

        return result;
    }

    /**
     * Calculate federal income tax using 2024 brackets
     * @param {number} income - Taxable income
     * @param {string} filingStatus - Filing status
     * @returns {number} - Federal tax owed
     */
    static calculateFederalIncomeTax(income, filingStatus) {
        const brackets = this.FEDERAL_TAX_BRACKETS[filingStatus] || this.FEDERAL_TAX_BRACKETS.single;
        const standardDeduction = this.STANDARD_DEDUCTIONS[filingStatus] || this.STANDARD_DEDUCTIONS.single;
        
        const taxableIncome = Math.max(0, income - standardDeduction);
        return this.calculateTaxFromBrackets(taxableIncome, brackets);
    }

    /**
     * Calculate California state income tax
     * @param {number} income - Taxable income
     * @param {string} filingStatus - Filing status
     * @returns {number} - California tax owed
     */
    static calculateCaliforniaIncomeTax(income, filingStatus) {
        const brackets = this.CA_TAX_BRACKETS[filingStatus] || this.CA_TAX_BRACKETS.single;
        const standardDeduction = this.CA_STANDARD_DEDUCTIONS[filingStatus] || this.CA_STANDARD_DEDUCTIONS.single;
        
        const taxableIncome = Math.max(0, income - standardDeduction);
        return this.calculateTaxFromBrackets(taxableIncome, brackets);
    }

    /**
     * Calculate capital gains tax
     * @param {number} capitalGains - Capital gains amount
     * @param {string} filingStatus - Filing status
     * @returns {number} - Capital gains tax owed
     */
    static calculateCapitalGainsTax(capitalGains, filingStatus) {
        const brackets = this.CAPITAL_GAINS_RATES[filingStatus] || this.CAPITAL_GAINS_RATES.single;
        return this.calculateTaxFromBrackets(capitalGains, brackets);
    }

    /**
     * Generic tax calculation from bracket structure
     * @param {number} income - Income to tax
     * @param {Array} brackets - Tax bracket structure
     * @returns {number} - Tax owed
     */
    static calculateTaxFromBrackets(income, brackets) {
        let tax = 0;
        let remainingIncome = income;

        for (const bracket of brackets) {
            const taxableAtThisBracket = Math.min(remainingIncome, bracket.max - bracket.min);
            if (taxableAtThisBracket <= 0) break;
            
            tax += taxableAtThisBracket * bracket.rate;
            remainingIncome -= taxableAtThisBracket;
            
            if (remainingIncome <= 0) break;
        }

        return tax;
    }

    /**
     * Calculate marginal tax rate (simple version to avoid recursion)
     * @param {number} income - Current income level
     * @param {string} accountType - Account type
     * @param {string} filingStatus - Filing status
     * @param {string} state - State
     * @returns {number} - Marginal tax rate
     */
    static calculateMarginalTaxRateSimple(income, accountType, filingStatus, state = 'California') {
        // For simplicity, calculate marginal rate based on current tax bracket
        // without recursively calling the full withdrawal calculation
        
        if (accountType === 'Roth') {
            return 0; // Roth withdrawals are tax-free
        }
        
        let marginalRate = 0;
        
        if (accountType === 'Traditional 401k/IRA') {
            // Ordinary income tax rates
            marginalRate += this.getMarginalFederalRate(income, filingStatus);
            if (state === 'California') {
                marginalRate += this.getMarginalCaliforniaRate(income, filingStatus);
            }
        } else if (accountType === 'Taxable') {
            // Capital gains rates (simplified - assume all capital gains)
            const capGainsRates = this.CAPITAL_GAINS_RATES[filingStatus] || this.CAPITAL_GAINS_RATES.single;
            for (const bracket of capGainsRates) {
                if (income > bracket.min && income <= bracket.max) {
                    marginalRate = bracket.rate;
                    break;
                }
            }
            // Add California tax (treats capital gains as ordinary income)
            if (state === 'California') {
                marginalRate += this.getMarginalCaliforniaRate(income, filingStatus);
            }
        }
        
        return marginalRate;
    }

    /**
     * Get marginal federal tax rate for a given income
     * @param {number} income - Taxable income
     * @param {string} filingStatus - Filing status
     * @returns {number} - Marginal federal tax rate
     */
    static getMarginalFederalRate(income, filingStatus) {
        const brackets = this.FEDERAL_TAX_BRACKETS[filingStatus] || this.FEDERAL_TAX_BRACKETS.single;
        const standardDeduction = this.STANDARD_DEDUCTIONS[filingStatus] || this.STANDARD_DEDUCTIONS.single;
        const taxableIncome = Math.max(0, income - standardDeduction);
        
        for (const bracket of brackets) {
            if (taxableIncome > bracket.min && taxableIncome <= bracket.max) {
                return bracket.rate;
            }
        }
        
        // If above all brackets, return highest rate
        return brackets[brackets.length - 1].rate;
    }

    /**
     * Get marginal California tax rate for a given income
     * @param {number} income - Taxable income
     * @param {string} filingStatus - Filing status
     * @returns {number} - Marginal California tax rate
     */
    static getMarginalCaliforniaRate(income, filingStatus) {
        const brackets = this.CA_TAX_BRACKETS[filingStatus] || this.CA_TAX_BRACKETS.single;
        const standardDeduction = this.CA_STANDARD_DEDUCTIONS[filingStatus] || this.CA_STANDARD_DEDUCTIONS.single;
        const taxableIncome = Math.max(0, income - standardDeduction);
        
        for (const bracket of brackets) {
            if (taxableIncome > bracket.min && taxableIncome <= bracket.max) {
                return bracket.rate;
            }
        }
        
        // If above all brackets, return highest rate
        return brackets[brackets.length - 1].rate;
    }

    /**
     * Calculate marginal tax rate (full version with recursion protection)
     * @param {number} income - Current income level
     * @param {string} accountType - Account type
     * @param {string} filingStatus - Filing status
     * @param {string} state - State
     * @returns {number} - Marginal tax rate
     */
    static calculateMarginalTaxRate(income, accountType, filingStatus, state = 'California') {
        // Use simple version to avoid recursion
        return this.calculateMarginalTaxRateSimple(income, accountType, filingStatus, state);
    }

    /**
     * Optimize Social Security claiming strategy
     * @param {number} currentAge - Current age
     * @param {number} retirementAge - Planned retirement age
     * @param {number} expectedBenefit - Expected monthly benefit at full retirement age
     * @param {number} lifeExpectancy - Expected life expectancy (default 85)
     * @returns {Object} - Social Security optimization analysis
     */
    static optimizeSocialSecurity(currentAge, retirementAge, expectedBenefit, lifeExpectancy = 85) {
        const birthYear = new Date().getFullYear() - currentAge;
        const fullRetirementAge = this.getFullRetirementAge(birthYear);
        
        const scenarios = [];
        
        // Analyze claiming ages from 62 to 70
        for (let claimingAge = 62; claimingAge <= 70; claimingAge++) {
            const adjustedBenefit = this.calculateSocialSecurityBenefit(expectedBenefit, claimingAge, fullRetirementAge);
            const yearsOfBenefits = Math.max(0, lifeExpectancy - claimingAge);
            const lifetimeValue = adjustedBenefit * 12 * yearsOfBenefits;
            
            scenarios.push({
                claimingAge,
                monthlyBenefit: adjustedBenefit,
                annualBenefit: adjustedBenefit * 12,
                yearsOfBenefits,
                lifetimeValue,
                adjustmentFactor: adjustedBenefit / expectedBenefit
            });
        }

        // Find optimal claiming age (highest lifetime value)
        const optimalScenario = scenarios.reduce((best, current) => 
            current.lifetimeValue > best.lifetimeValue ? current : best
        );

        // Calculate break-even ages
        const fullRetirementScenario = scenarios.find(s => s.claimingAge === Math.floor(fullRetirementAge));
        const breakEvenAnalysis = this.calculateBreakEvenAges(scenarios, fullRetirementScenario);

        return {
            currentAge,
            retirementAge,
            fullRetirementAge,
            expectedBenefit,
            lifeExpectancy,
            optimal: {
                claimingAge: optimalScenario.claimingAge,
                monthlyBenefit: Math.round(optimalScenario.monthlyBenefit),
                lifetimeValue: Math.round(optimalScenario.lifetimeValue),
                breakEvenAge: breakEvenAnalysis[optimalScenario.claimingAge]?.breakEvenAge || null
            },
            allScenarios: scenarios.map(s => ({
                ...s,
                monthlyBenefit: Math.round(s.monthlyBenefit),
                lifetimeValue: Math.round(s.lifetimeValue)
            })),
            breakEvenAnalysis,
            recommendation: this.generateSocialSecurityRecommendation(optimalScenario, fullRetirementAge, retirementAge)
        };
    }

    /**
     * Get full retirement age based on birth year
     * @param {number} birthYear - Birth year
     * @returns {number} - Full retirement age
     */
    static getFullRetirementAge(birthYear) {
        if (birthYear <= 1943) return 66.0;
        if (birthYear <= 1954) return 66.0;
        if (birthYear === 1955) return 66.17;
        if (birthYear === 1956) return 66.33;
        if (birthYear === 1957) return 66.5;
        if (birthYear === 1958) return 66.67;
        if (birthYear === 1959) return 66.83;
        return 67.0; // 1960 and later
    }

    /**
     * Calculate Social Security benefit based on claiming age
     * @param {number} fullBenefit - Benefit at full retirement age
     * @param {number} claimingAge - Age when claiming benefits
     * @param {number} fullRetirementAge - Full retirement age
     * @returns {number} - Adjusted monthly benefit
     */
    static calculateSocialSecurityBenefit(fullBenefit, claimingAge, fullRetirementAge) {
        if (claimingAge < 62) return 0; // Cannot claim before 62
        if (claimingAge > 70) claimingAge = 70; // No additional benefit after 70

        if (claimingAge < fullRetirementAge) {
            // Early claiming reduction
            const monthsEarly = (fullRetirementAge - claimingAge) * 12;
            let reductionFactor = 0;
            
            // First 36 months: 5/9 of 1% per month (6.67% per year)
            const firstReduction = Math.min(36, monthsEarly) * (5/9) * 0.01;
            reductionFactor += firstReduction;
            
            // Additional months: 5/12 of 1% per month (5% per year)
            if (monthsEarly > 36) {
                const additionalReduction = (monthsEarly - 36) * (5/12) * 0.01;
                reductionFactor += additionalReduction;
            }
            
            return fullBenefit * (1 - reductionFactor);
        } else if (claimingAge > fullRetirementAge) {
            // Delayed retirement credits: 8% per year
            const yearsDelayed = claimingAge - fullRetirementAge;
            const delayedCredits = yearsDelayed * 0.08;
            return fullBenefit * (1 + delayedCredits);
        } else {
            // Claiming at full retirement age
            return fullBenefit;
        }
    }

    /**
     * Calculate break-even ages for different claiming strategies
     * @param {Array} scenarios - All claiming scenarios
     * @param {Object} baseScenario - Base scenario for comparison
     * @returns {Object} - Break-even analysis
     */
    static calculateBreakEvenAges(scenarios, baseScenario) {
        const breakEvenAnalysis = {};
        
        scenarios.forEach(scenario => {
            if (scenario.claimingAge === baseScenario.claimingAge) {
                breakEvenAnalysis[scenario.claimingAge] = {
                    breakEvenAge: null,
                    description: 'Base scenario'
                };
                return;
            }

            // Find age where cumulative benefits are equal
            const monthlyDifference = scenario.monthlyBenefit - baseScenario.monthlyBenefit;
            
            if (monthlyDifference === 0) {
                breakEvenAnalysis[scenario.claimingAge] = {
                    breakEvenAge: null,
                    description: 'Same monthly benefit'
                };
                return;
            }

            // Calculate when cumulative benefits equal out
            const claimingAgeDifference = scenario.claimingAge - baseScenario.claimingAge;
            const lostMonths = Math.abs(claimingAgeDifference * 12);
            const lostBenefits = Math.abs(claimingAgeDifference * 12 * baseScenario.monthlyBenefit);
            
            let breakEvenAge = null;
            if (monthlyDifference !== 0) {
                const monthsToBreakEven = lostBenefits / Math.abs(monthlyDifference);
                breakEvenAge = Math.max(scenario.claimingAge, baseScenario.claimingAge) + (monthsToBreakEven / 12);
            }

            breakEvenAnalysis[scenario.claimingAge] = {
                breakEvenAge: breakEvenAge ? Math.round(breakEvenAge * 10) / 10 : null,
                monthlyDifference,
                description: monthlyDifference > 0 ? 'Higher monthly benefit' : 'Lower monthly benefit'
            };
        });

        return breakEvenAnalysis;
    }

    /**
     * Generate Social Security recommendation
     * @param {Object} optimalScenario - Optimal claiming scenario
     * @param {number} fullRetirementAge - Full retirement age
     * @param {number} retirementAge - Planned retirement age
     * @returns {string} - Recommendation text
     */
    static generateSocialSecurityRecommendation(optimalScenario, fullRetirementAge, retirementAge) {
        const claimingAge = optimalScenario.claimingAge;
        
        if (claimingAge < fullRetirementAge) {
            return `Consider claiming at ${claimingAge} for maximum lifetime value, but this reduces monthly benefits by ${Math.round((1 - optimalScenario.adjustmentFactor) * 100)}%. This works best if you have lower life expectancy or immediate financial needs.`;
        } else if (claimingAge > fullRetirementAge) {
            return `Delay claiming until ${claimingAge} to maximize lifetime value with ${Math.round((optimalScenario.adjustmentFactor - 1) * 100)}% higher monthly benefits. This strategy works best with longer life expectancy and other income sources during early retirement.`;
        } else {
            return `Claim at full retirement age (${claimingAge}) for the standard benefit without reductions or increases. This provides a balanced approach between monthly benefit amount and claiming duration.`;
        }
    }

    /**
     * Calculate age-adjusted healthcare costs with inflation
     * @param {number} age - Current age
     * @param {number} baseAmount - Base annual healthcare cost (optional, uses age-based default)
     * @param {number} multiplier - Cost multiplier (1.0-3.0x for different health scenarios)
     * @param {number} inflationRate - Healthcare inflation rate (typically higher than general inflation)
     * @param {number} years - Number of years to project
     * @returns {Object} - Healthcare cost projections
     */
    static calculateHealthcareCosts(age, baseAmount = null, multiplier = 1.0, inflationRate = 0.05, years = 30) {
        const baseAnnualCost = baseAmount || this.getBaseHealthcareCost(age);
        const adjustedBaseCost = baseAnnualCost * multiplier;
        
        const projectedCosts = [];
        let cumulativeCost = 0;
        
        for (let year = 0; year < years; year++) {
            const currentAge = age + year;
            const ageAdjustment = this.getHealthcareAgeAdjustment(currentAge);
            const inflationAdjustment = Math.pow(1 + inflationRate, year);
            
            const annualCost = adjustedBaseCost * ageAdjustment * inflationAdjustment;
            cumulativeCost += annualCost;
            
            projectedCosts.push({
                year: year + 1,
                age: currentAge,
                annualCost: Math.round(annualCost),
                cumulativeCost: Math.round(cumulativeCost),
                inflationFactor: inflationAdjustment,
                ageFactor: ageAdjustment
            });
        }
        
        const avgAnnualCost = cumulativeCost / years;
        const finalYearCost = projectedCosts[projectedCosts.length - 1].annualCost;
        
        return {
            baseAnnualCost: Math.round(adjustedBaseCost),
            multiplier,
            inflationRate,
            years,
            currentAge: age,
            finalAge: age + years - 1,
            averageAnnualCost: Math.round(avgAnnualCost),
            finalYearCost: Math.round(finalYearCost),
            totalCumulativeCost: Math.round(cumulativeCost),
            projectedCosts,
            medicareTransition: age < 65 && age + years > 65 ? {
                transitionAge: 65,
                preMediareCost: this.getBaseHealthcareCost(64) * multiplier,
                postMedicareCost: this.getBaseHealthcareCost(65) * multiplier,
                savings: (this.getBaseHealthcareCost(64) - this.getBaseHealthcareCost(65)) * multiplier
            } : null
        };
    }

    /**
     * Get base healthcare cost for a given age
     * @param {number} age - Age
     * @returns {number} - Base annual healthcare cost
     */
    static getBaseHealthcareCost(age) {
        // Find closest age in our base costs table
        const ages = Object.keys(this.BASE_HEALTHCARE_COSTS).map(Number).sort((a, b) => a - b);
        
        // Find the closest age bracket
        let closestAge = ages[0];
        for (const ageKey of ages) {
            if (Math.abs(age - ageKey) < Math.abs(age - closestAge)) {
                closestAge = ageKey;
            }
        }
        
        return this.BASE_HEALTHCARE_COSTS[closestAge];
    }

    /**
     * Get healthcare cost age adjustment factor
     * @param {number} age - Current age
     * @returns {number} - Age adjustment factor (1.0 = baseline)
     */
    static getHealthcareAgeAdjustment(age) {
        // Healthcare costs typically increase with age
        if (age < 30) return 0.9;
        if (age < 40) return 1.0;
        if (age < 50) return 1.1;
        if (age < 60) return 1.3;
        if (age < 65) return 1.6; // Pre-Medicare higher costs
        if (age < 70) return 1.2; // Medicare helps reduce costs
        if (age < 80) return 1.4;
        if (age < 90) return 1.7;
        return 2.0; // Advanced age care needs
    }

    /**
     * Determine optimal account type for contributions
     * @param {number} currentIncome - Current annual income
     * @param {number} retirementTaxRate - Expected tax rate in retirement
     * @param {number} currentTaxRate - Current marginal tax rate
     * @param {number} yearsToRetirement - Years until retirement
     * @returns {Object} - Account type recommendation
     */
    static determineOptimalAccountType(currentIncome, retirementTaxRate, currentTaxRate, yearsToRetirement = 20) {
        const analysis = {
            currentIncome,
            currentTaxRate,
            retirementTaxRate,
            yearsToRetirement,
            recommendations: []
        };

        // Traditional vs Roth comparison
        const contributionAmount = 20000; // Example annual contribution
        
        // Traditional: Tax deduction now, pay taxes in retirement
        const traditionalTaxSavingsNow = contributionAmount * currentTaxRate;
        const traditionalTaxesInRetirement = contributionAmount * Math.pow(1.07, yearsToRetirement) * retirementTaxRate;
        
        // Roth: No deduction now, no taxes in retirement
        const rothTaxCostNow = contributionAmount * currentTaxRate;
        const rothTaxesInRetirement = 0;
        
        // Net present value comparison
        const traditionalNPV = traditionalTaxSavingsNow - (traditionalTaxesInRetirement / Math.pow(1.03, yearsToRetirement));
        const rothNPV = -rothTaxCostNow; // Negative because it's a cost now
        
        let primaryRecommendation = '';
        let taxSavings = 0;
        
        if (traditionalNPV > rothNPV) {
            primaryRecommendation = 'Traditional 401k/IRA';
            taxSavings = traditionalNPV - rothNPV;
            analysis.recommendations.push({
                type: 'Traditional 401k/IRA',
                reason: 'Lower tax rate expected in retirement',
                immediateImpact: `$${Math.round(traditionalTaxSavingsNow)} tax savings this year`,
                longTermImpact: `Net present value advantage: $${Math.round(taxSavings)}`
            });
        } else {
            primaryRecommendation = 'Roth';
            taxSavings = rothNPV - traditionalNPV;
            analysis.recommendations.push({
                type: 'Roth',
                reason: 'Higher tax rate expected in retirement or tax-free growth priority',
                immediateImpact: `$${Math.round(rothTaxCostNow)} additional taxes this year`,
                longTermImpact: `Net present value advantage: $${Math.round(Math.abs(taxSavings))}`
            });
        }

        // Additional considerations
        if (currentIncome > 100000) {
            analysis.recommendations.push({
                type: 'Taxable Account',
                reason: 'Income limits may restrict Roth contributions',
                immediateImpact: 'No immediate tax benefit',
                longTermImpact: 'Capital gains rates typically lower than ordinary income rates'
            });
        }

        if (yearsToRetirement > 30) {
            analysis.recommendations.push({
                type: 'Mixed Strategy',
                reason: 'Long time horizon allows for tax diversification',
                immediateImpact: 'Partial tax savings now',
                longTermImpact: 'Flexibility to optimize withdrawals in retirement'
            });
        }

        return {
            recommendedType: primaryRecommendation,
            taxSavings: Math.round(Math.abs(taxSavings)),
            analysis,
            strategy: this.generateAccountTypeStrategy(currentTaxRate, retirementTaxRate, currentIncome)
        };
    }

    /**
     * Generate account type strategy recommendation
     * @param {number} currentTaxRate - Current tax rate
     * @param {number} retirementTaxRate - Retirement tax rate
     * @param {number} currentIncome - Current income
     * @returns {string} - Strategy recommendation
     */
    static generateAccountTypeStrategy(currentTaxRate, retirementTaxRate, currentIncome) {
        const rateDifference = currentTaxRate - retirementTaxRate;
        
        if (rateDifference > 0.05) {
            return "Focus on Traditional accounts while in high tax bracket, then transition to Roth during lower-income years or market downturns.";
        } else if (rateDifference < -0.05) {
            return "Prioritize Roth contributions to lock in current lower tax rates. Consider Roth conversions during low-income years.";
        } else {
            return "Tax rates are similar - consider a balanced approach with both Traditional and Roth accounts for maximum flexibility in retirement.";
        }
    }

    /**
     * Calculate comprehensive retirement withdrawal strategy
     * @param {Object} portfolioData - Portfolio balances by account type
     * @param {number} targetWithdrawal - Target annual withdrawal
     * @param {Object} taxParameters - Tax calculation parameters
     * @returns {Object} - Optimized withdrawal strategy
     */
    static calculateOptimalWithdrawalStrategy(portfolioData, targetWithdrawal, taxParameters) {
        const { age, filingStatus, state } = taxParameters;
        const { traditional401k = 0, rothIRA = 0, taxable = 0 } = portfolioData;

        const totalPortfolio = traditional401k + rothIRA + taxable;
        if (totalPortfolio === 0) {
            return {
                error: 'No portfolio balance available',
                totalTax: 0,
                netWithdrawal: 0
            };
        }

        // Test different withdrawal combinations to minimize taxes
        const strategies = [];
        const testCombinations = [
            { traditional: 1.0, roth: 0.0, taxable: 0.0, name: 'Traditional Only' },
            { traditional: 0.0, roth: 1.0, taxable: 0.0, name: 'Roth Only' },
            { traditional: 0.0, roth: 0.0, taxable: 1.0, name: 'Taxable Only' },
            { traditional: 0.5, roth: 0.5, taxable: 0.0, name: '50/50 Traditional/Roth' },
            { traditional: 0.33, roth: 0.33, taxable: 0.34, name: 'Equal Split' },
            { traditional: 0.6, roth: 0.2, taxable: 0.2, name: 'Traditional Heavy' },
            { traditional: 0.2, roth: 0.6, taxable: 0.2, name: 'Roth Heavy' }
        ];

        testCombinations.forEach(combo => {
            const traditionalWithdrawal = Math.min(targetWithdrawal * combo.traditional, traditional401k);
            const rothWithdrawal = Math.min(targetWithdrawal * combo.roth, rothIRA);
            const taxableWithdrawal = Math.min(targetWithdrawal * combo.taxable, taxable);
            
            const actualWithdrawal = traditionalWithdrawal + rothWithdrawal + taxableWithdrawal;
            
            if (actualWithdrawal < targetWithdrawal * 0.95) return; // Skip if can't meet 95% of target

            // Calculate taxes for each withdrawal type
            const traditionalTaxResult = traditionalWithdrawal > 0 
                ? this.calculateTaxAdjustedWithdrawal(traditionalWithdrawal, 'Traditional 401k/IRA', state, age, filingStatus)
                : { totalTax: 0, netIncome: 0 };
            
            const rothTaxResult = rothWithdrawal > 0
                ? this.calculateTaxAdjustedWithdrawal(rothWithdrawal, 'Roth', state, age, filingStatus)
                : { totalTax: 0, netIncome: rothWithdrawal };
            
            const taxableTaxResult = taxableWithdrawal > 0
                ? this.calculateTaxAdjustedWithdrawal(taxableWithdrawal, 'Taxable', state, age, filingStatus)
                : { totalTax: 0, netIncome: 0 };

            const totalTax = traditionalTaxResult.totalTax + rothTaxResult.totalTax + taxableTaxResult.totalTax;
            const totalNet = traditionalTaxResult.netIncome + rothTaxResult.netIncome + taxableTaxResult.netIncome;

            strategies.push({
                name: combo.name,
                withdrawals: {
                    traditional: traditionalWithdrawal,
                    roth: rothWithdrawal,
                    taxable: taxableWithdrawal,
                    total: actualWithdrawal
                },
                taxes: {
                    federal: traditionalTaxResult.federalTax + rothTaxResult.federalTax + taxableTaxResult.federalTax,
                    state: traditionalTaxResult.stateTax + rothTaxResult.stateTax + taxableTaxResult.stateTax,
                    total: totalTax
                },
                netWithdrawal: totalNet,
                effectiveTaxRate: actualWithdrawal > 0 ? totalTax / actualWithdrawal : 0
            });
        });

        // Find strategy with lowest tax burden
        const optimalStrategy = strategies.reduce((best, current) => 
            current.taxes.total < best.taxes.total ? current : best
        );

        return {
            optimalStrategy,
            allStrategies: strategies.sort((a, b) => a.taxes.total - b.taxes.total),
            taxSavings: strategies[strategies.length - 1].taxes.total - optimalStrategy.taxes.total,
            recommendation: this.generateWithdrawalRecommendation(optimalStrategy, portfolioData)
        };
    }

    /**
     * Generate withdrawal strategy recommendation
     * @param {Object} optimalStrategy - Optimal withdrawal strategy
     * @param {Object} portfolioData - Portfolio balances
     * @returns {string} - Strategy recommendation
     */
    static generateWithdrawalRecommendation(optimalStrategy, portfolioData) {
        const { withdrawals, effectiveTaxRate } = optimalStrategy;
        const totalWithdrawal = withdrawals.total;
        
        let recommendation = `Optimal strategy: ${optimalStrategy.name}. `;
        
        if (withdrawals.traditional > 0) {
            const traditionalPct = Math.round((withdrawals.traditional / totalWithdrawal) * 100);
            recommendation += `Withdraw ${traditionalPct}% from Traditional accounts ($${Math.round(withdrawals.traditional).toLocaleString()}). `;
        }
        
        if (withdrawals.roth > 0) {
            const rothPct = Math.round((withdrawals.roth / totalWithdrawal) * 100);
            recommendation += `Withdraw ${rothPct}% from Roth accounts ($${Math.round(withdrawals.roth).toLocaleString()}). `;
        }
        
        if (withdrawals.taxable > 0) {
            const taxablePct = Math.round((withdrawals.taxable / totalWithdrawal) * 100);
            recommendation += `Withdraw ${taxablePct}% from Taxable accounts ($${Math.round(withdrawals.taxable).toLocaleString()}). `;
        }
        
        recommendation += `This results in an effective tax rate of ${Math.round(effectiveTaxRate * 100)}%.`;
        
        return recommendation;
    }
}

// Export for use in other modules
window.FinancialModeling = FinancialModeling;