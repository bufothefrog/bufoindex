/**
 * Retirement Planning Application
 * Demonstrates new terminal component architecture
 */

import { AppController } from '../../framework/app-controller.js';
import { RetirementEngine } from '../../engines/retirement-engine.js';

// Default parameter values
const defaults = {
  startingAge: 25,
  retirementAgeA: 35,
  retirementAgeB: 50,
  retirementAgeC: 65,
  targetIncome: 75000,
  startingBalance: 50000,
  annualReturn: 0.08,
  retirementReturn: 0.06,
  returnVolatility: 0.15,
  inflationRate: 0.03,
  simulationRuns: 1000,
  accountType: 'traditional',
  state: 'CA',
  currentIncome: 100000,
  socialSecurityAge: 67,
  expectedSocialSecurity: 2500,
  healthcareMultiplier: 1.0
};

// Validators for form inputs
const validators = {
  startingAge: (value) => {
    if (value < 18 || value > 65) {
      return { error: 'Starting age must be between 18 and 65' };
    }
    return {};
  },
  
  retirementAgeA: (value, state) => {
    if (value <= state.startingAge) {
      return { error: 'Retirement age must be greater than starting age' };
    }
    return {};
  },
  
  retirementAgeB: (value, state) => {
    if (value <= state.startingAge) {
      return { error: 'Retirement age must be greater than starting age' };
    }
    return {};
  },
  
  retirementAgeC: (value, state) => {
    if (value <= state.startingAge) {
      return { error: 'Retirement age must be greater than starting age' };
    }
    return {};
  },
  
  targetIncome: (value) => {
    if (value < 1000 || value > 1000000) {
      return { error: 'Target income must be between $1,000 and $1,000,000' };
    }
    return {};
  },
  
  currentIncome: (value) => {
    if (value < 1000 || value > 10000000) {
      return { error: 'Current income must be between $1,000 and $10,000,000' };
    }
    return {};
  }
};

// Preset configurations
const presets = {
  conservative: {
    annualReturn: 0.06,
    retirementReturn: 0.04,
    returnVolatility: 0.10,
    inflationRate: 0.035
  },
  moderate: {
    annualReturn: 0.08,
    retirementReturn: 0.06,
    returnVolatility: 0.15,
    inflationRate: 0.03
  },
  aggressive: {
    annualReturn: 0.12,
    retirementReturn: 0.09,
    returnVolatility: 0.20,
    inflationRate: 0.025
  },
  fire: {
    annualReturn: 0.10,
    retirementReturn: 0.07,
    returnVolatility: 0.15,
    inflationRate: 0.03,
    retirementAgeA: 35,
    retirementAgeB: 40,
    retirementAgeC: 45
  }
};

class RetirementPlanningApp extends AppController {
  constructor() {
    super({
      name: 'Retirement Planning Calculator',
      version: '2.0.0',
      engineClass: RetirementEngine,
      defaults,
      validators,
      presets,
      autoCalculate: true,
      debounceMs: 1000 // Longer debounce for heavy calculations
    });
    
    this.setupUI();
  }

  /**
   * Setup the user interface
   */
  setupUI() {
    this.setupForm();
    this.setupDisplays();
    this.setupActions();
  }

  /**
   * Setup form with terminal components
   */
  setupForm() {
    const form = document.querySelector('terminal-form');
    if (!form) return;
    
    // Bind state manager to form
    form.setStateManager(this.state);
    
    // Add form sections
    form.addSection({
      title: 'BASIC PARAMETERS',
      fields: [
        {
          name: 'startingAge',
          label: 'Starting Age',
          type: 'range',
          min: 18,
          max: 65,
          step: 1,
          defaultValue: defaults.startingAge,
          suffix: ' years'
        },
        {
          name: 'targetIncome',
          label: 'Target Annual Income',
          type: 'currency',
          defaultValue: defaults.targetIncome,
          help: 'Desired annual income in retirement (today\'s dollars)'
        },
        {
          name: 'startingBalance',
          label: 'Current Balance',
          type: 'currency',
          defaultValue: defaults.startingBalance,
          help: 'Current retirement account balance'
        },
        {
          name: 'currentIncome',
          label: 'Current Annual Income',
          type: 'currency',
          defaultValue: defaults.currentIncome,
          help: 'Used for tax calculations'
        }
      ]
    });
    
    form.addSection({
      title: 'RETIREMENT SCENARIOS',
      fields: [
        {
          name: 'retirementAgeA',
          label: 'Scenario A - Early Retirement',
          type: 'range',
          min: 30,
          max: 80,
          step: 1,
          defaultValue: defaults.retirementAgeA,
          suffix: ' years'
        },
        {
          name: 'retirementAgeB',
          label: 'Scenario B - Moderate Retirement',
          type: 'range',
          min: 30,
          max: 80,
          step: 1,
          defaultValue: defaults.retirementAgeB,
          suffix: ' years'
        },
        {
          name: 'retirementAgeC',
          label: 'Scenario C - Traditional Retirement',
          type: 'range',
          min: 30,
          max: 80,
          step: 1,
          defaultValue: defaults.retirementAgeC,
          suffix: ' years'
        }
      ]
    });
    
    form.addSection({
      title: 'INVESTMENT PARAMETERS',
      collapsible: true,
      fields: [
        {
          name: 'annualReturn',
          label: 'Expected Annual Return',
          type: 'percentage',
          min: 1,
          max: 20,
          step: 0.1,
          defaultValue: defaults.annualReturn * 100,
          help: 'Expected return during accumulation phase'
        },
        {
          name: 'retirementReturn',
          label: 'Retirement Phase Return',
          type: 'percentage',
          min: 1,
          max: 15,
          step: 0.1,
          defaultValue: defaults.retirementReturn * 100,
          help: 'More conservative return during retirement'
        },
        {
          name: 'returnVolatility',
          label: 'Return Volatility',
          type: 'percentage',
          min: 5,
          max: 30,
          step: 0.1,
          defaultValue: defaults.returnVolatility * 100,
          help: 'Standard deviation for Monte Carlo simulation'
        },
        {
          name: 'inflationRate',
          label: 'Inflation Rate',
          type: 'percentage',
          min: 0,
          max: 10,
          step: 0.1,
          defaultValue: defaults.inflationRate * 100,
          help: 'Expected long-term inflation rate'
        }
      ]
    });
    
    form.addSection({
      title: 'TAX & BENEFITS',
      collapsible: true,
      fields: [
        {
          name: 'accountType',
          label: 'Primary Account Type',
          type: 'select',
          defaultValue: defaults.accountType,
          options: [
            { value: 'traditional', label: 'Traditional 401(k)/IRA' },
            { value: 'roth', label: 'Roth 401(k)/IRA' },
            { value: 'taxable', label: 'Taxable Account' }
          ]
        },
        {
          name: 'state',
          label: 'State',
          type: 'select',
          defaultValue: defaults.state,
          options: [
            { value: 'CA', label: 'California' },
            { value: 'TX', label: 'Texas' },
            { value: 'NY', label: 'New York' },
            { value: 'FL', label: 'Florida' },
            { value: 'WA', label: 'Washington' },
            { value: 'NV', label: 'Nevada' },
            { value: 'IL', label: 'Illinois' },
            { value: 'PA', label: 'Pennsylvania' },
            { value: 'OH', label: 'Ohio' },
            { value: 'NC', label: 'North Carolina' }
          ]
        },
        {
          name: 'socialSecurityAge',
          label: 'Social Security Claiming Age',
          type: 'range',
          min: 62,
          max: 70,
          step: 1,
          defaultValue: defaults.socialSecurityAge,
          suffix: ' years'
        },
        {
          name: 'expectedSocialSecurity',
          label: 'Expected Monthly Social Security',
          type: 'currency',
          defaultValue: defaults.expectedSocialSecurity,
          help: 'Estimated monthly benefit at full retirement age'
        }
      ]
    });
    
    form.addSection({
      title: 'ADVANCED OPTIONS',
      collapsible: true,
      collapsed: true,
      fields: [
        {
          name: 'healthcareMultiplier',
          label: 'Healthcare Cost Multiplier',
          type: 'range',
          min: 0.5,
          max: 3.0,
          step: 0.1,
          defaultValue: defaults.healthcareMultiplier,
          suffix: 'x',
          help: '1x = average healthcare costs, 2x = high costs'
        },
        {
          name: 'simulationRuns',
          label: 'Monte Carlo Simulations',
          type: 'range',
          min: 100,
          max: 10000,
          step: 100,
          defaultValue: defaults.simulationRuns,
          suffix: ' runs',
          help: 'More runs = more accurate but slower'
        }
      ]
    });
  }

  /**
   * Setup result displays
   */
  setupDisplays() {
    // Summary display
    const summaryDisplay = document.querySelector('terminal-display[data-display="summary"]');
    if (summaryDisplay) {
      summaryDisplay.updateResults = (results) => {
        summaryDisplay.clear();
        
        if (!results.scenarios) return;
        
        results.scenarios.forEach(scenario => {
          if (scenario.isValid) {
            summaryDisplay.addDataRow({
              id: `scenario-${scenario.scenarioLabel}-age`,
              label: `Scenario ${scenario.scenarioLabel} - Retirement Age`,
              value: scenario.retirementAge,
              format: 'integer',
              status: 'info'
            });
            
            summaryDisplay.addDataRow({
              id: `scenario-${scenario.scenarioLabel}-contribution`,
              label: `Scenario ${scenario.scenarioLabel} - Monthly Contribution`,
              value: scenario.monthlyContribution,
              format: 'currency',
              status: scenario.monthlyContribution > 5000 ? 'warning' : 'positive'
            });
            
            summaryDisplay.addDataRow({
              id: `scenario-${scenario.scenarioLabel}-success`,
              label: `Scenario ${scenario.scenarioLabel} - Success Rate`,
              value: scenario.monteCarloResults.successRate,
              format: 'percentage',
              status: scenario.monteCarloResults.successRate > 0.8 ? 'positive' : 'warning'
            });
          }
        });
        
        summaryDisplay.render();
      };
    }
    
    // Metrics display
    const metricsDisplay = document.querySelector('terminal-display[data-display="metrics"]');
    if (metricsDisplay) {
      metricsDisplay.updateResults = (results) => {
        metricsDisplay.clear();
        
        if (!results.scenarios) return;
        
        const validScenarios = results.scenarios.filter(s => s.isValid);
        if (validScenarios.length === 0) return;
        
        const bestScenario = validScenarios.reduce((best, current) => 
          current.monteCarloResults.successRate > best.monteCarloResults.successRate ? current : best
        );
        
        metricsDisplay.addDataRow({
          id: 'best-scenario',
          label: 'Recommended Scenario',
          value: `Scenario ${bestScenario.scenarioLabel}`,
          format: 'text',
          status: 'positive'
        });
        
        metricsDisplay.addDataRow({
          id: 'personalized-swr',
          label: 'Personalized Safe Withdrawal Rate',
          value: bestScenario.personalizedSWR,
          format: 'percentage',
          status: 'info'
        });
        
        metricsDisplay.addDataRow({
          id: 'break-even',
          label: 'Years to Reach Goal',
          value: bestScenario.breakEven.years,
          format: 'decimal',
          status: 'info'
        });
        
        metricsDisplay.render();
      };
    }
  }

  /**
   * Setup action buttons
   */
  setupActions() {
    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetName = e.target.dataset.preset;
        this.applyPreset(presetName);
      });
    });
  }

  /**
   * Process calculation results for UI
   * @param {Object} results - Engine results
   */
  updateResults(results) {
    super.updateResults(results);
    
    // Update insights
    this.updateInsights(results.insights);
  }

  /**
   * Update insights display
   * @param {Array} insights - Generated insights
   */
  updateInsights(insights) {
    const insightsEl = document.getElementById('insights');
    if (!insightsEl || !insights) return;
    
    insightsEl.innerHTML = insights.map(insight => `
      <div class="terminal-display__insight terminal-display__insight--${insight.type}">
        <div class="terminal-display__insight-title">[${insight.title.toUpperCase()}]</div>
        <div class="terminal-display__insight-message">${insight.message}</div>
      </div>
    `).join('');
  }

  /**
   * Transform parameters for engine
   * @returns {Object} Transformed parameters
   */
  getEngineParams() {
    const state = this.state.getState();
    
    return {
      ...state,
      retirementAges: [state.retirementAgeA, state.retirementAgeB, state.retirementAgeC]
    };
  }

  /**
   * Override calculate method to use transformed params
   */
  async calculate() {
    if (this.isCalculating || !this.engine) return;
    
    this.isCalculating = true;
    this.showLoading(true);
    
    try {
      const params = this.getEngineParams();
      
      // Validate inputs
      if (this.config.validators) {
        const validation = this.state.validate(this.config.validators);
        if (!validation.isValid) {
          this.showValidationErrors(validation.errors);
          return;
        }
      }
      
      // Run calculation
      const results = await this.engine.calculate(params);
      
      this.lastCalculation = {
        params: { ...params },
        results,
        timestamp: Date.now()
      };
      
      // Update UI
      this.updateResults(results);
      this.hideValidationErrors();
      
    } catch (error) {
      console.error('Calculation error:', error);
      this.showError('Calculation failed. Please check your inputs.');
    } finally {
      this.isCalculating = false;
      this.showLoading(false);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.retirementApp = new RetirementPlanningApp();
});