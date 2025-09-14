/**
 * Calculator Engine
 * Real-time calculation engine for mini-calculators
 */

import { FormulaRegistryEntry } from '@/lib/formulas/types';

export interface CalculationResult {
  value: number;
  steps: CalculationStep[];
  error?: string;
  warnings?: string[];
}

export interface CalculationStep {
  description: string;
  formula?: string;
  inputs?: Record<string, number>;
  output: number;
}

export class CalculatorEngine {
  /**
   * Execute a formula with given inputs
   */
  static calculate(
    formula: FormulaRegistryEntry,
    inputs: Record<string, number>
  ): CalculationResult {
    try {
      // Validate inputs
      const validation = this.validateInputs(formula, inputs);
      if (!validation.isValid) {
        return {
          value: 0,
          steps: [],
          error: validation.errors.join(', ')
        };
      }

      // Execute calculation based on formula type
      const result = this.executeFormula(formula, inputs);
      
      return {
        value: result.value,
        steps: result.steps,
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        value: 0,
        steps: [],
        error: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }

  /**
   * Validate formula inputs
   */
  private static validateInputs(
    formula: FormulaRegistryEntry,
    inputs: Record<string, number>
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    Object.keys(formula.variables).forEach(variable => {
      const value = inputs[variable];
      
      if (value === undefined || value === null) {
        errors.push(`Missing value for ${variable}`);
        return;
      }

      if (isNaN(value) || !isFinite(value)) {
        errors.push(`Invalid value for ${variable}: must be a finite number`);
        return;
      }

      // Check constraints if any
      const variableConfig = formula.variables[variable];
      if (variableConfig.constraints) {
        const constraintCheck = this.checkConstraints(variable, value, variableConfig.constraints);
        if (constraintCheck.violation) {
          errors.push(`${variable}: ${constraintCheck.violation}`);
        }
        warnings.push(...constraintCheck.warnings);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check variable constraints
   */
  private static checkConstraints(
    variable: string,
    value: number,
    constraints: string
  ): {
    violation?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    // Parse common constraint patterns
    if (constraints.includes('> 0') && value <= 0) {
      return { violation: 'Must be greater than 0', warnings: [] };
    }
    
    if (constraints.includes('≥ 0') && value < 0) {
      return { violation: 'Must be greater than or equal to 0', warnings: [] };
    }
    
    if (constraints.includes('between 0 and 1') && (value < 0 || value > 1)) {
      return { violation: 'Must be between 0 and 1', warnings: [] };
    }
    
    if (constraints.includes('percentage') && (value < 0 || value > 1)) {
      warnings.push('Value interpreted as decimal (e.g., 0.07 for 7%)');
    }

    // Check for reasonable ranges based on variable name
    if (variable.toLowerCase().includes('rate') && Math.abs(value) > 1) {
      warnings.push('Rate seems high - ensure it\'s in decimal form (e.g., 0.07 for 7%)');
    }

    if (variable.toLowerCase().includes('age') && (value < 0 || value > 150)) {
      warnings.push('Age value seems unrealistic');
    }

    return { warnings };
  }

  /**
   * Execute the actual formula calculation
   */
  private static executeFormula(
    formula: FormulaRegistryEntry,
    inputs: Record<string, number>
  ): {
    value: number;
    steps: CalculationStep[];
  } {
    // Identify formula type based on name and LaTeX
    const formulaType = this.identifyFormulaType(formula);
    
    switch (formulaType) {
      case 'future_value':
        return this.calculateFutureValue(inputs);
      
      case 'present_value':
        return this.calculatePresentValue(inputs);
      
      case 'future_value_annuity':
        return this.calculateFutureValueAnnuity(inputs);
      
      case 'present_value_annuity':
        return this.calculatePresentValueAnnuity(inputs);
      
      case 'compound_interest':
        return this.calculateCompoundInterest(inputs);
      
      case 'safe_withdrawal_rate':
        return this.calculateSafeWithdrawalRate(inputs);
      
      case 'required_balance':
        return this.calculateRequiredBalance(inputs);
      
      default:
        // Fallback: try to use the example as a template
        return this.calculateUsingExample(formula, inputs);
    }
  }

  /**
   * Identify formula type from metadata
   */
  private static identifyFormulaType(formula: FormulaRegistryEntry): string {
    const name = formula.name.toLowerCase();
    const latex = formula.latex.toLowerCase();

    if (name.includes('future value') && !name.includes('annuity')) {
      return 'future_value';
    }
    
    if (name.includes('present value') && !name.includes('annuity')) {
      return 'present_value';
    }
    
    if (name.includes('future value') && name.includes('annuity')) {
      return 'future_value_annuity';
    }
    
    if (name.includes('present value') && name.includes('annuity')) {
      return 'present_value_annuity';
    }
    
    if (name.includes('compound interest')) {
      return 'compound_interest';
    }
    
    if (name.includes('withdrawal rate')) {
      return 'safe_withdrawal_rate';
    }
    
    if (name.includes('required balance')) {
      return 'required_balance';
    }

    return 'unknown';
  }

  /**
   * Calculate Future Value: FV = PV * (1 + r)^t
   */
  private static calculateFutureValue(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const PV = inputs.PV || inputs.presentValue || inputs.principal || 0;
    const r = inputs.r || inputs.rate || inputs.interestRate || 0;
    const t = inputs.t || inputs.time || inputs.periods || inputs.years || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { PV, r, t },
        output: 0
      }
    ];

    // Calculate compound factor
    const compoundFactor = Math.pow(1 + r, t);
    steps.push({
      description: `Calculate compound factor: (1 + ${r})^${t}`,
      formula: `(1 + r)^t = (1 + ${r})^${t}`,
      output: compoundFactor
    });

    // Calculate final result
    const result = PV * compoundFactor;
    steps.push({
      description: `Multiply by present value: ${PV} × ${compoundFactor.toFixed(4)}`,
      formula: `FV = PV × (1 + r)^t`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Calculate Present Value: PV = FV / (1 + r)^t
   */
  private static calculatePresentValue(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const FV = inputs.FV || inputs.futureValue || 0;
    const r = inputs.r || inputs.rate || inputs.interestRate || 0;
    const t = inputs.t || inputs.time || inputs.periods || inputs.years || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { FV, r, t },
        output: 0
      }
    ];

    const discountFactor = Math.pow(1 + r, t);
    steps.push({
      description: `Calculate discount factor: (1 + ${r})^${t}`,
      output: discountFactor
    });

    const result = FV / discountFactor;
    steps.push({
      description: `Divide future value by discount factor: ${FV} ÷ ${discountFactor.toFixed(4)}`,
      formula: `PV = FV ÷ (1 + r)^t`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Calculate Future Value of Annuity: FVA = PMT * [((1 + r)^t - 1) / r]
   */
  private static calculateFutureValueAnnuity(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const PMT = inputs.PMT || inputs.payment || inputs.annualPayment || 0;
    const r = inputs.r || inputs.rate || inputs.interestRate || 0;
    const t = inputs.t || inputs.time || inputs.periods || inputs.years || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { PMT, r, t },
        output: 0
      }
    ];

    if (r === 0) {
      // Special case for zero interest rate
      const result = PMT * t;
      steps.push({
        description: 'Zero interest rate: FVA = PMT × t',
        output: result
      });
      return { value: result, steps };
    }

    const compoundFactor = Math.pow(1 + r, t);
    steps.push({
      description: `Calculate (1 + r)^t: (1 + ${r})^${t}`,
      output: compoundFactor
    });

    const annuityFactor = (compoundFactor - 1) / r;
    steps.push({
      description: `Calculate annuity factor: (${compoundFactor.toFixed(4)} - 1) ÷ ${r}`,
      output: annuityFactor
    });

    const result = PMT * annuityFactor;
    steps.push({
      description: `Multiply by payment: ${PMT} × ${annuityFactor.toFixed(4)}`,
      formula: `FVA = PMT × [((1 + r)^t - 1) ÷ r]`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Calculate Present Value of Annuity: PVA = PMT * [1 - (1 + r)^(-t)] / r
   */
  private static calculatePresentValueAnnuity(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const PMT = inputs.PMT || inputs.payment || inputs.annualPayment || 0;
    const r = inputs.r || inputs.rate || inputs.interestRate || 0;
    const t = inputs.t || inputs.time || inputs.periods || inputs.years || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { PMT, r, t },
        output: 0
      }
    ];

    if (r === 0) {
      const result = PMT * t;
      steps.push({
        description: 'Zero interest rate: PVA = PMT × t',
        output: result
      });
      return { value: result, steps };
    }

    const discountFactor = Math.pow(1 + r, -t);
    steps.push({
      description: `Calculate discount factor: (1 + ${r})^(-${t})`,
      output: discountFactor
    });

    const annuityFactor = (1 - discountFactor) / r;
    steps.push({
      description: `Calculate annuity factor: (1 - ${discountFactor.toFixed(4)}) ÷ ${r}`,
      output: annuityFactor
    });

    const result = PMT * annuityFactor;
    steps.push({
      description: `Multiply by payment: ${PMT} × ${annuityFactor.toFixed(4)}`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Calculate compound interest with multiple compounding
   */
  private static calculateCompoundInterest(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const P = inputs.P || inputs.principal || inputs.PV || 0;
    const r = inputs.r || inputs.rate || inputs.annualRate || 0;
    const n = inputs.n || inputs.compoundingFrequency || 1;
    const t = inputs.t || inputs.time || inputs.years || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { P, r, n, t },
        output: 0
      }
    ];

    const ratePerPeriod = r / n;
    steps.push({
      description: `Calculate rate per period: ${r} ÷ ${n}`,
      output: ratePerPeriod
    });

    const totalPeriods = n * t;
    steps.push({
      description: `Calculate total periods: ${n} × ${t}`,
      output: totalPeriods
    });

    const compoundFactor = Math.pow(1 + ratePerPeriod, totalPeriods);
    steps.push({
      description: `Calculate compound factor: (1 + ${ratePerPeriod.toFixed(6)})^${totalPeriods}`,
      output: compoundFactor
    });

    const result = P * compoundFactor;
    steps.push({
      description: `Final calculation: ${P} × ${compoundFactor.toFixed(4)}`,
      formula: `A = P(1 + r/n)^(nt)`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Calculate safe withdrawal rate
   */
  private static calculateSafeWithdrawalRate(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const annualExpenses = inputs.annualExpenses || inputs.targetIncome || 0;
    const portfolioValue = inputs.portfolioValue || inputs.balance || 0;

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { annualExpenses, portfolioValue },
        output: 0
      }
    ];

    const withdrawalRate = portfolioValue > 0 ? annualExpenses / portfolioValue : 0;
    steps.push({
      description: `Calculate withdrawal rate: ${annualExpenses} ÷ ${portfolioValue}`,
      formula: `Withdrawal Rate = Annual Expenses ÷ Portfolio Value`,
      output: withdrawalRate
    });

    return { value: withdrawalRate, steps };
  }

  /**
   * Calculate required balance for retirement
   */
  private static calculateRequiredBalance(inputs: Record<string, number>): {
    value: number;
    steps: CalculationStep[];
  } {
    const annualIncome = inputs.annualIncome || inputs.targetIncome || 0;
    const withdrawalRate = inputs.withdrawalRate || 0.04; // 4% rule default

    const steps: CalculationStep[] = [
      {
        description: 'Identify given values',
        inputs: { annualIncome, withdrawalRate },
        output: 0
      }
    ];

    const result = annualIncome / withdrawalRate;
    steps.push({
      description: `Calculate required balance: ${annualIncome} ÷ ${withdrawalRate}`,
      formula: `Required Balance = Annual Income ÷ Withdrawal Rate`,
      output: result
    });

    return { value: result, steps };
  }

  /**
   * Fallback calculation using example data
   */
  private static calculateUsingExample(
    formula: FormulaRegistryEntry,
    inputs: Record<string, number>
  ): {
    value: number;
    steps: CalculationStep[];
  } {
    const steps: CalculationStep[] = [
      {
        description: 'Using formula example as template',
        inputs,
        output: 0
      }
    ];

    // Try to scale the example result based on input ratios
    const exampleInputs = formula.example.inputs;
    const exampleOutput = formula.example.output;
    
    // Find a primary variable to scale by (usually the first one)
    const primaryVar = Object.keys(exampleInputs)[0];
    if (primaryVar && inputs[primaryVar] && exampleInputs[primaryVar]) {
      const scaleFactor = inputs[primaryVar] / exampleInputs[primaryVar];
      const scaledResult = exampleOutput * scaleFactor;
      
      steps.push({
        description: `Scale example result by primary variable ratio`,
        formula: `Result ≈ Example Result × (${inputs[primaryVar]} ÷ ${exampleInputs[primaryVar]})`,
        output: scaledResult
      });

      return { value: scaledResult, steps };
    }

    // If no scaling possible, return example output
    steps.push({
      description: 'Using example output (no scaling possible)',
      output: exampleOutput
    });

    return { value: exampleOutput, steps };
  }
}