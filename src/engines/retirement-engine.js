/**
 * Retirement Planning Engine
 * Pure calculation engine for retirement planning with Monte Carlo simulations
 */

export class RetirementEngine {
  constructor() {
    this.config = {
      WITHDRAWAL_RATE: 0.04,
      MAX_AGE: 100,
      MIN_STARTING_AGE: 18,
      MIN_RETIREMENT_AGE: 30,
      
      // Tax brackets 2024
      TAX_BRACKETS: {
        single: [
          { min: 0, max: 11600, rate: 0.10 },
          { min: 11600, max: 47150, rate: 0.12 },
          { min: 47150, max: 100525, rate: 0.22 },
          { min: 100525, max: 191950, rate: 0.24 },
          { min: 191950, max: 243725, rate: 0.32 },
          { min: 243725, max: 609350, rate: 0.35 },
          { min: 609350, max: Infinity, rate: 0.37 }
        ],
        standardDeduction: 14600
      },
      
      // State tax rates (top 10 states)
      STATE_TAX_RATES: {
        CA: 0.093, TX: 0, NY: 0.0685, FL: 0, WA: 0,
        NV: 0, IL: 0.0495, PA: 0.0307, OH: 0.0399, NC: 0.0475
      },
      
      // Healthcare costs
      HEALTHCARE: {
        BASE_ANNUAL_COST: 15000,
        INFLATION_RATE: 0.055,
        AGE_ADJUSTMENT_FACTOR: 0.03
      },
      
      // Monte Carlo settings
      MONTE_CARLO: {
        DEFAULT_RUNS: 1000,
        PERCENTILES: [10, 25, 50, 75, 90]
      }
    };
  }

  /**
   * Main calculation method - processes all scenarios
   * @param {Object} params - Input parameters
   * @returns {Object} Calculation results
   */
  async calculate(params) {
    const {
      startingAge,
      retirementAges, // [ageA, ageB, ageC]
      targetIncome,
      startingBalance,
      annualReturn,
      retirementReturn,
      returnVolatility,
      inflationRate,
      accountType,
      state,
      currentIncome,
      socialSecurityAge,
      expectedSocialSecurity,
      healthcareMultiplier,
      simulationRuns
    } = params;

    const scenarios = await Promise.all(
      retirementAges.map((age, index) => 
        this.calculateScenario({
          ...params,
          retirementAge: age,
          scenarioLabel: String.fromCharCode(65 + index) // A, B, C
        })
      )
    );

    return {
      scenarios,
      comparison: this.compareScenarios(scenarios),
      insights: this.generateInsights(scenarios, params),
      metadata: {
        calculationTime: Date.now(),
        version: '2.0.0'
      }
    };
  }

  /**
   * Calculate single retirement scenario
   * @param {Object} params - Scenario parameters
   * @returns {Object} Scenario results
   */
  async calculateScenario(params) {
    const {
      startingAge,
      retirementAge,
      targetIncome,
      startingBalance,
      annualReturn,
      retirementReturn,
      returnVolatility,
      inflationRate,
      accountType,
      state,
      currentIncome,
      socialSecurityAge,
      expectedSocialSecurity,
      healthcareMultiplier,
      simulationRuns,
      scenarioLabel
    } = params;

    const yearsUntilRetirement = retirementAge - startingAge;
    
    if (yearsUntilRetirement <= 0) {
      return this.createInvalidScenario(scenarioLabel, 'Invalid retirement age');
    }

    // Calculate inflated target income
    const inflatedTargetIncome = this.futureValue(targetIncome, inflationRate, yearsUntilRetirement);
    
    // Calculate healthcare costs
    const avgHealthcareCost = this.calculateHealthcareCost(
      retirementAge + 10, // Average age during retirement
      new Date().getFullYear(),
      new Date().getFullYear() + yearsUntilRetirement + 10,
      healthcareMultiplier
    );
    
    // Total retirement need
    const totalRetirementNeed = inflatedTargetIncome + avgHealthcareCost;
    
    // Calculate target portfolio size
    const targetPortfolioSize = this.calculateTargetPortfolio(
      totalRetirementNeed,
      accountType,
      state
    );
    
    // Calculate required contributions
    const monthlyContribution = this.calculateRequiredContribution(
      startingBalance,
      targetPortfolioSize,
      annualReturn,
      yearsUntilRetirement
    );
    
    // Tax-adjusted contribution
    const taxAdjustedContribution = this.calculateTaxAdjustedContribution(
      monthlyContribution,
      accountType,
      currentIncome,
      state
    );
    
    // Monte Carlo simulation
    const monteCarloResults = await this.runMonteCarloSimulation({
      startingBalance,
      monthlyContribution: Math.max(0, monthlyContribution),
      yearsUntilRetirement,
      targetPortfolioSize,
      inflatedTargetIncome,
      totalRetirementNeed,
      accumulationReturn: annualReturn,
      retirementReturn,
      volatility: returnVolatility,
      inflationRate,
      runs: simulationRuns,
      startingAge,
      retirementAge,
      accountType,
      state,
      socialSecurityAge,
      socialSecurityBenefit: expectedSocialSecurity,
      healthcareMultiplier,
      currentIncome
    });
    
    // Calculate personalized metrics
    const personalizedSWR = this.calculatePersonalizedSWR(
      monteCarloResults.successRate,
      this.config.MAX_AGE - retirementAge,
      returnVolatility
    );
    
    const breakEven = this.calculateBreakEven(
      Math.max(0, monthlyContribution),
      startingBalance,
      targetPortfolioSize,
      annualReturn
    );

    return {
      scenarioLabel,
      retirementAge,
      yearsUntilRetirement,
      targetPortfolioSize,
      monthlyContribution: Math.max(0, monthlyContribution),
      taxAdjustedContribution: Math.max(0, taxAdjustedContribution),
      inflatedTargetIncome,
      totalRetirementNeed,
      personalizedSWR,
      breakEven,
      monteCarloResults,
      isValid: monthlyContribution >= 0 && !isNaN(monthlyContribution)
    };
  }

  /**
   * Run Monte Carlo simulation
   * @param {Object} params - Simulation parameters
   * @returns {Object} Simulation results
   */
  async runMonteCarloSimulation(params) {
    const {
      startingBalance,
      monthlyContribution,
      yearsUntilRetirement,
      inflatedTargetIncome,
      totalRetirementNeed,
      accumulationReturn,
      retirementReturn,
      volatility,
      inflationRate,
      runs,
      startingAge,
      retirementAge,
      accountType,
      state,
      socialSecurityAge,
      socialSecurityBenefit,
      healthcareMultiplier
    } = params;

    const results = [];
    let worstCaseBalance = Infinity;
    let bestCaseBalance = 0;

    for (let run = 0; run < runs; run++) {
      const simulation = await this.runSingleSimulation({
        ...params,
        runIndex: run
      });
      
      results.push(simulation);
      worstCaseBalance = Math.min(worstCaseBalance, simulation.retirementBalance);
      bestCaseBalance = Math.max(bestCaseBalance, simulation.retirementBalance);
    }

    // Calculate statistics
    const successRate = results.filter(r => r.success).length / runs;
    const balances = results.map(r => r.retirementBalance).sort((a, b) => a - b);
    
    const percentiles = this.config.MONTE_CARLO.PERCENTILES.reduce((acc, p) => {
      const index = Math.floor((p / 100) * runs);
      acc[`p${p}`] = balances[Math.min(index, runs - 1)];
      return acc;
    }, {});

    return {
      successRate,
      percentiles,
      meanRetirementBalance: balances.reduce((a, b) => a + b, 0) / runs,
      medianRetirementBalance: balances[Math.floor(runs / 2)],
      worstCaseBalance,
      bestCaseBalance,
      results: results.slice(0, 10) // Keep sample results
    };
  }

  /**
   * Run single Monte Carlo simulation
   * @param {Object} params - Simulation parameters
   * @returns {Object} Single simulation result
   */
  async runSingleSimulation(params) {
    const {
      startingBalance,
      monthlyContribution,
      yearsUntilRetirement,
      inflatedTargetIncome,
      accumulationReturn,
      retirementReturn,
      volatility,
      inflationRate,
      retirementAge,
      accountType,
      state,
      socialSecurityAge,
      socialSecurityBenefit,
      healthcareMultiplier
    } = params;

    let balance = startingBalance;

    // Accumulation phase
    for (let year = 0; year < yearsUntilRetirement; year++) {
      const annualReturn = this.generateRandomReturn(accumulationReturn, volatility);
      const annualContribution = monthlyContribution * 12;
      balance = balance * (1 + annualReturn) + annualContribution;
    }

    const retirementBalance = balance;
    let finalBalance = balance;
    let yearsLasted = 0;
    const retirementYears = this.config.MAX_AGE - retirementAge;

    // Withdrawal phase
    for (let year = 0; year < retirementYears; year++) {
      const currentAge = retirementAge + year;
      const annualReturn = this.generateRandomReturn(retirementReturn, volatility);
      
      let totalWithdrawal = inflatedTargetIncome * Math.pow(1 + inflationRate, year);
      
      // Add healthcare costs
      const healthcareCost = this.calculateHealthcareCost(
        currentAge,
        new Date().getFullYear(),
        new Date().getFullYear() + yearsUntilRetirement + year,
        healthcareMultiplier
      );
      totalWithdrawal += healthcareCost;
      
      // Subtract Social Security if applicable
      if (currentAge >= socialSecurityAge && socialSecurityBenefit > 0) {
        const ssAnnualBenefit = this.calculateSocialSecurityBenefit(
          socialSecurityBenefit / 12,
          socialSecurityAge
        );
        totalWithdrawal = Math.max(0, totalWithdrawal - ssAnnualBenefit);
      }
      
      // Calculate gross withdrawal (accounting for taxes)
      const grossWithdrawal = this.calculateGrossWithdrawal(
        totalWithdrawal,
        accountType,
        0, // Assume no other income in retirement
        state
      );
      
      finalBalance = (finalBalance - grossWithdrawal) * (1 + annualReturn);
      
      if (finalBalance > 0) {
        yearsLasted = year + 1;
      } else {
        break;
      }
    }

    return {
      retirementBalance,
      finalBalance: Math.max(0, finalBalance),
      yearsLasted,
      success: yearsLasted >= retirementYears
    };
  }

  // ========== Helper Calculation Methods ==========

  futureValue(pv, rate, periods) {
    return pv * Math.pow(1 + rate, periods);
  }

  calculateTargetPortfolio(totalNeed, accountType, state) {
    if (accountType === 'roth') {
      return totalNeed / this.config.WITHDRAWAL_RATE;
    } else {
      const estimatedTaxRate = this.calculateEffectiveTaxRate(totalNeed, state);
      return totalNeed / (this.config.WITHDRAWAL_RATE * (1 - estimatedTaxRate));
    }
  }

  calculateRequiredContribution(startingBalance, targetAmount, annualReturn, years) {
    if (years <= 0) return 0;
    
    const factor = Math.pow(1 + annualReturn, years);
    const numerator = targetAmount - startingBalance * factor;
    const denominator = ((factor - 1) / annualReturn) * 12;
    
    return numerator / denominator;
  }

  calculateTaxAdjustedContribution(monthlyContribution, accountType, currentIncome, state) {
    if (accountType === 'traditional') {
      const effectiveTaxRate = this.calculateEffectiveTaxRate(currentIncome, state);
      return monthlyContribution * (1 - effectiveTaxRate);
    }
    return monthlyContribution;
  }

  calculateEffectiveTaxRate(income, state) {
    const federalTax = this.calculateFederalTax(income);
    const stateTax = income * (this.config.STATE_TAX_RATES[state] || 0);
    return (federalTax + stateTax) / income;
  }

  calculateFederalTax(income) {
    const brackets = this.config.TAX_BRACKETS.single;
    const taxableIncome = Math.max(0, income - this.config.TAX_BRACKETS.standardDeduction);
    
    let tax = 0;
    for (const bracket of brackets) {
      if (taxableIncome > bracket.min) {
        const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
        tax += taxableInBracket * bracket.rate;
      }
    }
    return tax;
  }

  calculateHealthcareCost(age, baseYear, targetYear, multiplier = 1) {
    const yearsDifference = targetYear - baseYear;
    const baseCost = this.config.HEALTHCARE.BASE_ANNUAL_COST;
    const inflationRate = this.config.HEALTHCARE.INFLATION_RATE;
    
    const ageAdjustment = age < 65 ? 1.2 : 1 + ((age - 65) * this.config.HEALTHCARE.AGE_ADJUSTMENT_FACTOR);
    
    return baseCost * Math.pow(1 + inflationRate, yearsDifference) * ageAdjustment * multiplier;
  }

  calculateSocialSecurityBenefit(monthlyBenefit, startAge) {
    const fullRetirementAge = 67;
    const monthlyAdjustment = startAge < fullRetirementAge ? -0.0058 : 0.008;
    const monthsDifference = (startAge - fullRetirementAge) * 12;
    const adjustmentFactor = 1 + (monthlyAdjustment * monthsDifference);
    
    return Math.max(0, monthlyBenefit * adjustmentFactor * 12);
  }

  calculateGrossWithdrawal(netAmount, accountType, ordinaryIncome, state) {
    switch (accountType) {
      case 'roth':
        return netAmount;
      case 'traditional':
        const effectiveTaxRate = this.calculateEffectiveTaxRate(ordinaryIncome + netAmount, state);
        return netAmount / (1 - effectiveTaxRate);
      case 'taxable':
        // Simplified - assume 50% capital gains
        const capitalGainsPortion = netAmount * 0.5;
        const capitalGainsTax = capitalGainsPortion * 0.15; // Simplified 15% rate
        return netAmount + capitalGainsTax;
      default:
        return netAmount;
    }
  }

  calculatePersonalizedSWR(successProbability, yearsInRetirement, volatility) {
    let baseSWR = 0.04;
    
    // Adjust for success probability
    if (successProbability >= 0.95) baseSWR = 0.035;
    else if (successProbability >= 0.90) baseSWR = 0.038;
    else if (successProbability >= 0.85) baseSWR = 0.042;
    else if (successProbability >= 0.80) baseSWR = 0.045;
    
    // Adjust for retirement duration
    const durationFactor = Math.min(1.2, Math.max(0.8, 30 / yearsInRetirement));
    
    // Adjust for volatility
    const volatilityFactor = Math.min(1.1, Math.max(0.9, 1 - (volatility - 0.15) * 0.5));
    
    return baseSWR * durationFactor * volatilityFactor;
  }

  calculateBreakEven(monthlyContribution, startingBalance, targetAmount, returnRate) {
    if (monthlyContribution <= 0 || returnRate <= 0) {
      return { months: Infinity, years: Infinity };
    }
    
    let balance = startingBalance;
    let months = 0;
    
    while (balance < targetAmount && months < 600) { // Max 50 years
      balance = balance * (1 + returnRate / 12) + monthlyContribution;
      months++;
    }
    
    return {
      months: months,
      years: months / 12,
      finalBalance: balance
    };
  }

  generateRandomReturn(mean, stdDev) {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  // ========== Analysis Methods ==========

  compareScenarios(scenarios) {
    const validScenarios = scenarios.filter(s => s.isValid);
    if (validScenarios.length === 0) return {};

    const earliest = validScenarios.reduce((min, s) => s.retirementAge < min.retirementAge ? s : min);
    const latest = validScenarios.reduce((max, s) => s.retirementAge > max.retirementAge ? s : max);

    return {
      earlyRetirement: earliest,
      lateRetirement: latest,
      contributionDifference: earliest.monthlyContribution - latest.monthlyContribution,
      successRateDifference: earliest.monteCarloResults.successRate - latest.monteCarloResults.successRate
    };
  }

  generateInsights(scenarios, params) {
    const insights = [];
    const validScenarios = scenarios.filter(s => s.isValid);
    
    if (validScenarios.length === 0) {
      insights.push({
        type: 'error',
        title: 'Invalid Scenarios',
        message: 'No valid retirement scenarios found. Check your inputs.'
      });
      return insights;
    }

    // Early vs Late Retirement Impact
    if (validScenarios.length > 1) {
      const comparison = this.compareScenarios(scenarios);
      const contributionIncrease = Math.round((comparison.contributionDifference / comparison.lateRetirement.monthlyContribution) * 100);
      
      insights.push({
        type: 'info',
        title: 'Early Retirement Trade-off',
        message: `Retiring ${comparison.earlyRetirement.retirementAge - comparison.lateRetirement.retirementAge} years earlier requires ${contributionIncrease}% higher monthly contributions.`
      });
    }

    // Tax Strategy Recommendations
    const scenario = validScenarios[0];
    if (params.accountType === 'traditional' && scenario.taxAdjustedContribution < scenario.monthlyContribution * 0.8) {
      insights.push({
        type: 'tip',
        title: 'Tax Strategy',
        message: 'Consider Roth contributions if you expect higher tax rates in retirement.'
      });
    }

    // Social Security Optimization
    if (params.socialSecurityAge < 67) {
      insights.push({
        type: 'warning',
        title: 'Social Security',
        message: 'Claiming before full retirement age (67) reduces benefits permanently.'
      });
    }

    return insights;
  }

  createInvalidScenario(label, reason) {
    return {
      scenarioLabel: label,
      isValid: false,
      error: reason,
      retirementAge: 0,
      yearsUntilRetirement: 0,
      targetPortfolioSize: 0,
      monthlyContribution: 0,
      taxAdjustedContribution: 0,
      inflatedTargetIncome: 0,
      totalRetirementNeed: 0,
      personalizedSWR: 0,
      breakEven: { months: 0, years: 0 },
      monteCarloResults: {
        successRate: 0,
        percentiles: {},
        meanRetirementBalance: 0,
        medianRetirementBalance: 0,
        worstCaseBalance: 0,
        bestCaseBalance: 0
      }
    };
  }
}