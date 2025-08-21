/**
 * Retirement Calculator Main Script v2.0
 * Orchestrates the modern retirement planning calculator with Monte Carlo analysis
 */

class RetirementCalculator {
    constructor() {
        this.scenarios = [];
        this.insights = [];
        this.withdrawalData = [];
        this.monteCarloResults = null;
        this.financialModelingResults = null;
        
        // Chart instances
        this.withdrawalsChart = null;
        this.successProbabilityChart = null;
        this.portfolioDistributionChart = null;
        this.netWorthChart = null;
        
        // Chart data cache for performance
        this.chartDataCache = new Map();
        this.lastParametersHash = null;
        
        this.init();
    }
    
    // Helper function for currency formatting (fallback if FinancialCalculations not loaded)
    formatCurrency(amount) {
        if (typeof FinancialCalculations !== 'undefined' && FinancialCalculations.formatCurrency) {
            return FinancialCalculations.formatCurrency(amount);
        }
        // Fallback formatting
        return Math.round(amount).toLocaleString();
    }

    // Helper function for modern text formatting
    getThemeText(rawText) {
        const textMappings = {
            'YOUR RETIREMENT GOAL': 'Your Retirement Goal',
            'ASSESSMENT': 'Assessment',
            'RETIREMENT_GOAL_ASSESSMENT': 'Retirement Goal Assessment',
            'COAST_FIRE_STATUS': 'Coast FIRE Status',
            'TIME_VS_MONEY_TRADEOFF': 'Time vs Money Tradeoff',
            'SAVINGS_RATE': 'Savings Rate',
            'RISK_PROFILE': 'Risk Profile',
            'MARKET_RISK_WARNING': 'Market Risk Warning',
            'ACTION_REQUIRED': 'Action Required',
            'OPTIMIZATION_OPPORTUNITY': 'Optimization Opportunity',
            'BASIC_MODE_ACTIVE': 'Basic Mode Active',
            'EARLIEST_RETIREMENT': 'Earliest Retirement',
            'MONTHLY_SAVINGS': 'Monthly Savings',
            'BASIC_MODE': 'Basic Mode',
            'ANALYSIS_ERROR': 'Analysis Error',
            'VISUALIZATIONS': 'Visualizations',
            'KEY_INSIGHTS': 'Key Insights',
            '[EXPAND]': 'Expand',
            '[COLLAPSE]': 'Collapse',
            'EXPAND': 'Expand',
            'COLLAPSE': 'Collapse'
        };
        return textMappings[rawText] || rawText;
    }

    // Helper function to get theme colors for chart fallbacks
    getThemeColors() {
        if (typeof ThemeConfig !== 'undefined' && ThemeConfig.getChartColors) {
            return ThemeConfig.getChartColors();
        }
        // Ultimate fallback if theme system is not available
        return {
            primary: '#7FB069',
            secondary: '#FFB86C',
            text: '#1F2937',
            background: '#FFFFFF',
            grid: '#E5E7EB'
        };
    }

    // Helper function to get theme fonts for chart fallbacks
    getThemeFonts() {
        if (typeof ThemeConfig !== 'undefined' && ThemeConfig.fonts) {
            return ThemeConfig.fonts;
        }
        // Ultimate fallback
        return {
            primary: '-apple-system, BlinkMacSystemFont, sans-serif'
        };
    }

    /**
     * Generate hash of parameters for cache key
     */
    generateParametersHash(params) {
        const keyParams = {
            startingAge: params.startingAge,
            targetIncome: params.targetIncome,
            startingBalance: params.startingBalance,
            currentIncome: params.currentIncome,
            accumulationReturn: params.accumulationReturn,
            inflationRate: params.inflationRate
        };
        return JSON.stringify(keyParams);
    }

    /**
     * Calculate optimal Monte Carlo runs based on scenario complexity
     */
    getOptimalMonteCarloRuns(params) {
        const timeHorizon = (params.targetRetirementAge || 65) - (params.startingAge || 25);
        const volatility = params.volatility || 15;
        const hasComplexFeatures = params.socialSecurityAge || params.accountType !== 'Taxable';
        
        // Complex scenarios: high volatility (>20%) or long timeframes (>40 years) or complex features
        if (volatility > 20 || timeHorizon > 40 || hasComplexFeatures) {
            return FinancialConstants?.MONTE_CARLO_COMPLEX || 3000;
        }
        
        // Standard scenarios: normal volatility and timeframes
        if (volatility > 12 || timeHorizon > 25) {
            return FinancialConstants?.MONTE_CARLO_STANDARD || 2000;
        }
        
        // Simple scenarios: conservative parameters
        return FinancialConstants?.MONTE_CARLO_SIMPLE || 1000;
    }

    /**
     * Get cached chart data or generate new data
     */
    getCachedChartData(cacheKey, generatorFunction) {
        const currentHash = this.generateParametersHash(this.collectEnhancedParameters());
        
        // Clear cache if parameters changed
        if (this.lastParametersHash !== currentHash) {
            this.chartDataCache.clear();
            this.lastParametersHash = currentHash;
        }
        
        const fullCacheKey = `${currentHash}_${cacheKey}`;
        
        if (!this.chartDataCache.has(fullCacheKey)) {
            this.chartDataCache.set(fullCacheKey, generatorFunction());
        }
        
        return this.chartDataCache.get(fullCacheKey);
    }

    /**
     * Clear chart cache manually
     */
    clearChartCache() {
        this.chartDataCache.clear();
        this.lastParametersHash = null;
    }

    /**
     * Initialize theme system
     */

    /**
     * Toggle between available themes
     */

    /**
     * Apply the specified theme using ThemeConfig
     */
    
    /**
     * Refresh all charts with current theme
     */

    /**
     * Update theme toggle button text
     */

    /**
     * Destroy all existing charts
     */
    destroyAllCharts() {
        if (this.netWorthChart) {
            this.netWorthChart.destroy();
            this.netWorthChart = null;
        }
        if (this.withdrawalsChart) {
            this.withdrawalsChart.destroy();
            this.withdrawalsChart = null;
        }
        if (this.savingsVsRetirementChart) {
            this.savingsVsRetirementChart.destroy();
            this.savingsVsRetirementChart = null;
        }
    }

    /**
     * Update all charts with current theme
     */
    updateAllCharts() {
        if (this.scenarios && this.scenarios.length > 0) {
            this.updateCharts();
        }
    }


    /**
     * Debounce function to limit rapid updates
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        }.bind(this);
    }


    /**
     * Disable/enable form inputs during calculations
     */
    setInputsDisabled(disabled) {
        const inputs = document.querySelectorAll('.retirement-calculator input, .retirement-calculator select');
        inputs.forEach(input => {
            input.disabled = disabled;
            if (disabled) {
                input.style.opacity = '0.6';
                input.style.pointerEvents = 'none';
            } else {
                input.style.opacity = '1';
                input.style.pointerEvents = 'auto';
            }
        });
    }

    init() {
        
        // Load state from URL or use defaults
        const params = URLStateManager.loadState();
        URLStateManager.applyParametersToForm(params);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize state dropdown (preserves existing values from URL)
        this.initializeStateDropdown();
        
        // Set up automatic state saving
        URLStateManager.setupAutoSave();
        
        // Set up popstate listener for browser navigation
        URLStateManager.setupPopstateListener(() => this.updateAll());
        
        // Initialize risk profile returns (after URL state is applied)
        // This ensures that if 'custom' was loaded from URL, it won't be overridden
        this.updateRiskProfileReturns();
        
        // Initial calculation
        this.updateAll();
        
        // Apply initial text transformations after page load
        setTimeout(() => {
        }, 500);
    }

    setupEventListeners() {
        // Create debounced update function using constant
        const debounceDelay = window.FinancialConstants?.DEBOUNCE_DELAY_MS || 300;
        const debouncedUpdate = this.debounce(this.updateAll.bind(this), debounceDelay);
        
        // Input change listeners
        const inputs = document.querySelectorAll('.retirement-calculator input, .retirement-calculator select');
        inputs.forEach(input => {
            if (input.id === 'targetIncome' || input.id === 'startingBalance' || input.id === 'currentIncome' || input.id === 'socialSecurityBenefit') {
                // Format currency inputs with commas
                input.addEventListener('input', (e) => {
                    const cursorPosition = e.target.selectionStart;
                    const oldValue = e.target.value;
                    const rawValue = oldValue.replace(/[^0-9]/g, '');
                    
                    if (rawValue) {
                        const formattedValue = parseInt(rawValue).toLocaleString();
                        e.target.value = formattedValue;
                        
                        // Adjust cursor position after formatting
                        const lengthDiff = formattedValue.length - oldValue.length;
                        e.target.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);
                    }
                    
                    debouncedUpdate();
                });
            } else {
                input.addEventListener('input', debouncedUpdate);
            }
            
            // Immediate updates on blur/change for better UX
            input.addEventListener('change', () => this.updateAll());
        });

        // Risk profile change listener for auto-population
        const riskProfileSelect = document.getElementById('riskProfile');
        if (riskProfileSelect) {
            riskProfileSelect.addEventListener('change', () => this.updateRiskProfileReturns());
        }
        
        // Age change listener for TDF recalculation
        const ageInput = document.getElementById('startingAge');
        if (ageInput) {
            ageInput.addEventListener('input', () => {
                const riskProfile = this.getSelectValue('riskProfile');
                if (riskProfile === 'tdf') {
                    this.updateRiskProfileReturns();
                }
            });
        }
        
        // Add listeners to return rate inputs to detect manual overrides
        const accumulationInput = document.getElementById('accumulationReturn');
        const retirementInput = document.getElementById('retirementReturn');
        if (accumulationInput && retirementInput) {
            accumulationInput.addEventListener('input', () => this.handleManualReturnOverride());
            retirementInput.addEventListener('input', () => this.handleManualReturnOverride());
        }

        // Export button listeners
        document.getElementById('exportPDF')?.addEventListener('click', () => this.exportPDF());
        document.getElementById('shareURL')?.addEventListener('click', () => this.shareURL());
        
        // Form validation listeners
        this.setupFormValidation();
        
        // Theme change listener for chart updates
        this.setupThemeChangeListener();
        
        // Accessibility enhancements
        this.setupAccessibilityFeatures();
    }

    initializeStateDropdown() {
        const stateInput = document.getElementById('stateInput');
        const stateDropdown = document.getElementById('stateDropdown');
        const hiddenSelect = document.getElementById('state');
        
        if (!stateInput || !stateDropdown || !hiddenSelect) return;
        
        // State data with abbreviations
        const states = [
            { abbr: 'AL', name: 'Alabama' },
            { abbr: 'AK', name: 'Alaska' },
            { abbr: 'AZ', name: 'Arizona' },
            { abbr: 'AR', name: 'Arkansas' },
            { abbr: 'CA', name: 'California' },
            { abbr: 'CO', name: 'Colorado' },
            { abbr: 'CT', name: 'Connecticut' },
            { abbr: 'DE', name: 'Delaware' },
            { abbr: 'DC', name: 'District of Columbia' },
            { abbr: 'FL', name: 'Florida' },
            { abbr: 'GA', name: 'Georgia' },
            { abbr: 'HI', name: 'Hawaii' },
            { abbr: 'ID', name: 'Idaho' },
            { abbr: 'IL', name: 'Illinois' },
            { abbr: 'IN', name: 'Indiana' },
            { abbr: 'IA', name: 'Iowa' },
            { abbr: 'KS', name: 'Kansas' },
            { abbr: 'KY', name: 'Kentucky' },
            { abbr: 'LA', name: 'Louisiana' },
            { abbr: 'ME', name: 'Maine' },
            { abbr: 'MD', name: 'Maryland' },
            { abbr: 'MA', name: 'Massachusetts' },
            { abbr: 'MI', name: 'Michigan' },
            { abbr: 'MN', name: 'Minnesota' },
            { abbr: 'MS', name: 'Mississippi' },
            { abbr: 'MO', name: 'Missouri' },
            { abbr: 'MT', name: 'Montana' },
            { abbr: 'NE', name: 'Nebraska' },
            { abbr: 'NV', name: 'Nevada' },
            { abbr: 'NH', name: 'New Hampshire' },
            { abbr: 'NJ', name: 'New Jersey' },
            { abbr: 'NY', name: 'New York' },
            { abbr: 'NC', name: 'North Carolina' },
            { abbr: 'ND', name: 'North Dakota' },
            { abbr: 'OH', name: 'Ohio' },
            { abbr: 'OK', name: 'Oklahoma' },
            { abbr: 'OR', name: 'Oregon' },
            { abbr: 'PA', name: 'Pennsylvania' },
            { abbr: 'RI', name: 'Rhode Island' },
            { abbr: 'SC', name: 'South Carolina' },
            { abbr: 'SD', name: 'South Dakota' },
            { abbr: 'TN', name: 'Tennessee' },
            { abbr: 'TX', name: 'Texas' },
            { abbr: 'UT', name: 'Utah' },
            { abbr: 'VT', name: 'Vermont' },
            { abbr: 'VA', name: 'Virginia' },
            { abbr: 'WA', name: 'Washington' },
            { abbr: 'WV', name: 'West Virginia' },
            { abbr: 'WI', name: 'Wisconsin' },
            { abbr: 'WY', name: 'Wyoming' }
        ];
        
        let selectedIndex = -1;
        
        // Set initial values to empty only if not already set (preserve URL state)
        if (!stateInput.value) {
            stateInput.value = '';
        }
        if (!hiddenSelect.value) {
            hiddenSelect.value = '';
        }
        
        // Function to filter states based on input
        const filterStates = (query) => {
            if (!query) return states;
            
            const lowerQuery = query.toLowerCase();
            return states.filter(state => 
                state.name.toLowerCase().includes(lowerQuery) ||
                state.abbr.toLowerCase().includes(lowerQuery)
            );
        };
        
        // Function to populate dropdown
        const populateDropdown = (filteredStates) => {
            stateDropdown.innerHTML = '';
            
            if (filteredStates.length === 0) {
                stateDropdown.classList.add('hidden');
                return;
            }
            
            filteredStates.forEach((state, index) => {
                const div = document.createElement('div');
                div.className = 'px-2 py-1 cursor-pointer hover:bg-sage-green hover:text-white transition-colors';
                div.textContent = `${state.name} (${state.abbr})`;
                div.dataset.abbr = state.abbr;
                div.dataset.name = state.name;
                div.dataset.index = index;
                
                div.addEventListener('click', () => {
                    stateInput.value = state.name;
                    hiddenSelect.value = state.abbr;
                    stateDropdown.classList.add('hidden');
                    selectedIndex = -1;
                    
                    // Trigger update
                    if (typeof this.updateAll === 'function') {
                        this.updateAll();
                    }
                });
                
                stateDropdown.appendChild(div);
            });
            
            stateDropdown.classList.remove('hidden');
        };
        
        // Input event listener
        stateInput.addEventListener('input', (e) => {
            const query = e.target.value;
            const filteredStates = filterStates(query);
            populateDropdown(filteredStates);
            selectedIndex = -1;
        });
        
        // Keyboard navigation
        stateInput.addEventListener('keydown', (e) => {
            const items = stateDropdown.querySelectorAll('[data-index]');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    items[selectedIndex].click();
                }
            } else if (e.key === 'Escape') {
                stateDropdown.classList.add('hidden');
                selectedIndex = -1;
            }
        });
        
        // Function to update visual selection
        const updateSelection = (items) => {
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add('bg-sage-green', 'text-black');
                } else {
                    item.classList.remove('bg-sage-green', 'text-black');
                }
            });
        };
        
        // Focus and blur handlers
        stateInput.addEventListener('focus', () => {
            const query = stateInput.value;
            const filteredStates = filterStates(query);
            populateDropdown(filteredStates);
        });
        
        stateInput.addEventListener('blur', (e) => {
            // Delay hiding to allow clicking on dropdown items
            setTimeout(() => {
                if (!stateDropdown.contains(document.activeElement)) {
                    stateDropdown.classList.add('hidden');
                    selectedIndex = -1;
                    
                    // Validate input and correct if needed
                    const currentValue = stateInput.value.toLowerCase();
                    const exactMatch = states.find(s => 
                        s.name.toLowerCase() === currentValue ||
                        s.abbr.toLowerCase() === currentValue
                    );
                    
                    if (exactMatch) {
                        stateInput.value = exactMatch.name;
                        hiddenSelect.value = exactMatch.abbr;
                    } else {
                        // Reset to current hidden value if no exact match
                        const currentState = states.find(s => s.abbr === hiddenSelect.value);
                        if (currentState) {
                            stateInput.value = currentState.name;
                        }
                    }
                }
            }, 150);
        });
    }

    calculateScenarios() {
        try {
            const params = this.collectEnhancedParameters();
            // Check if FinancialCalculations is available
            if (typeof FinancialCalculations === 'undefined') {
                throw new Error('FinancialCalculations not loaded');
            }
            
            // Calculate retirement readiness using new method with custom return rates
            const readinessAnalysis = FinancialCalculations.calculateRetirementReadiness({
                currentAge: params.startingAge,
                targetRetirementAge: params.targetRetirementAge,
                targetIncome: params.targetIncome,
                currentIncome: params.currentIncome,
                currentSavingsRate: params.currentSavingsRate / 100, // Convert to decimal
                startingBalance: params.startingBalance,
                state: params.state,
                riskProfile: params.riskProfile,
                inflationRate: params.inflationRate / 100,
                // Pass custom return rates if available
                accumulationReturn: params.accumulationReturn ? params.accumulationReturn / 100 : undefined,
                retirementReturn: params.retirementReturn ? params.retirementReturn / 100 : undefined,
                volatility: params.volatility ? params.volatility / 100 : undefined
            });

            // Store target goal assessment
            this.targetGoalAssessment = readinessAnalysis.targetGoal;
            
            // Convert scenarios to format expected by rest of app
            this.scenarios = readinessAnalysis.scenarios.map((scenario, index) => {
                const colors = ['#e74c3c', '#f39c12', '#27ae60'];
                const yearsUntilRetirement = Math.max(0, scenario.achievableRetirementAge - params.startingAge);
                return {
                    label: scenario.label,
                    savingsRate: scenario.savingsRate,
                    retirementAge: scenario.achievableRetirementAge,
                    yearsUntilRetirement: yearsUntilRetirement,
                    monthlyContribution: scenario.monthlyContribution,
                    realismScore: scenario.realismScore,
                    realismRating: scenario.realismRating,
                    confidenceLevel: scenario.confidenceLevel,
                    valid: scenario.valid,
                    color: colors[index] || '#888888',
                    // Calculate additional fields for compatibility
                    inflatedTargetIncome: params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsUntilRetirement),
                    targetPortfolioSize: (params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsUntilRetirement)) / 0.04
                };
            });

            return this.scenarios;
        } catch (error) {
            console.error('Error in calculateScenarios:', error);
            // Return empty scenarios if calculation fails
            this.scenarios = [];
            this.targetGoalAssessment = null;
            return this.scenarios;
        }
    }

    updateSummaryTable() {
        const tbody = document.getElementById('summaryTableBody');
        if (!tbody) return;

        tbody.innerHTML = this.scenarios.map(scenario => {
            if (!scenario.valid) {
                return `
                    <tr class="subtitle-text">
                        <td class="py-2 px-3">${scenario.label}</td>
                        <td class="py-2 px-3">${Math.round(scenario.savingsRate * 100)}%</td>
                        <td class="py-2 px-3" colspan="3">INVALID: Unable to retire with this savings rate</td>
                    </tr>
                `;
            }

            // Add realism color coding
            const realismClass = this.getRealismColorClass(scenario.realismRating);
            const confidenceMeter = this.generateConfidenceMeter(scenario.confidenceLevel);
            
            // Format savings rate as "X% ($Y,YYY)"
            const savingsRatePercent = Math.round(scenario.savingsRate * 100);
            const monthlyDollarAmount = this.formatCurrency(scenario.monthlyContribution);
            const savingsRateDisplay = `${savingsRatePercent}% ($${monthlyDollarAmount})`;
            
            // Get Monte Carlo success rate if available
            const portfolioSuccessRate = scenario.monteCarloSuccessRate ? 
                `${Math.round(scenario.monteCarloSuccessRate * 100)}%` : 
                'Calculating...';

            return `
                <tr class="text-sage-green">
                    <td class="py-2 px-3">${scenario.label}</td>
                    <td class="py-2 px-3">${savingsRateDisplay}</td>
                    <td class="py-2 px-3">${scenario.retirementAge}</td>
                    <td class="py-2 px-3 ${realismClass}">
                        <div class="flex items-center gap-2">
                            <span>${scenario.realismRating}</span>
                            ${confidenceMeter}
                        </div>
                    </td>
                    <td class="py-2 px-3">
                        ${portfolioSuccessRate}
                    </td>
                </tr>
            `;
        }).join('');
    }

    getRealismColorClass(rating) {
        switch (rating) {
            case 'Highly Realistic': return 'text-green-400';
            case 'Challenging but Achievable': return 'text-yellow-400';
            case 'Unlikely': return 'text-orange-400';
            case 'Unrealistic': return 'text-red-400';
            default: return 'text-sage-green';
        }
    }

    generateConfidenceMeter(confidenceLevel) {
        const width = Math.max(10, confidenceLevel); // Minimum 10% width for visibility
        const color = confidenceLevel >= 80 ? '#7FB069' : 
                      confidenceLevel >= 60 ? '#FFB86C' : 
                      confidenceLevel >= 40 ? '#FF8C42' : '#FF6B6B';
        
        return `
            <div class="inline-flex items-center gap-1">
                <div class="w-16 h-2 bg-gray-800 border border-sage-green">
                    <div class="h-full" style="width: ${width}%; background-color: ${color};"></div>
                </div>
                <span class="text-xs">${confidenceLevel}%</span>
            </div>
        `;
    }

    generateInsights() {
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return [];

        const params = URLStateManager.collectParametersFromForm();
        const validated = URLStateManager.validateParameters(params);
        
        // Use enhanced insights engine if Monte Carlo results are available
        if (this.monteCarloResults && this.financialModelingResults) {
            this.insights = InsightsEngine.generateAdvancedInsights(
                this.monteCarloResults, 
                this.financialModelingResults, 
                validated
            );
            return this.insights;
        }

        // Fallback to basic insights for backwards compatibility
        const earliest = validScenarios.reduce((min, s) => s.retirementAge < min.retirementAge ? s : min);
        const latest = validScenarios.reduce((max, s) => s.retirementAge > max.retirementAge ? s : max);

        const insights = [];

        if (earliest.label !== latest.label) {
            const timeDifference = latest.retirementAge - earliest.retirementAge;
            const contributionDifference = earliest.monthlyContribution - latest.monthlyContribution;
            const contributionRatio = Math.round((earliest.monthlyContribution / latest.monthlyContribution) * 100 - 100);

            insights.push({
                title: this.getThemeText('TIME_VS_MONEY_TRADEOFF'),
                value: `${contributionRatio}%`,
                text: `Retiring ${timeDifference} years earlier requires ${contributionRatio}% higher monthly contributions (${this.formatCurrency(contributionDifference)} more per month).`
            });
        }

        insights.push({
            title: this.getThemeText('SAVINGS_RATE'),
            value: `${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}%`,
            text: `Early retirement (Scenario ${earliest.label}) requires saving ${Math.round(earliest.monthlyContribution / (validated.targetIncome/12) * 100)}% of your target monthly retirement income every month during your working years.`
        });

        this.insights = insights;
        return insights;
    }

    generateNewStyleInsights() {
        if (!this.targetGoalAssessment || !this.scenarios) {
            console.warn('Missing data for new style insights:', {
                targetGoalAssessment: !!this.targetGoalAssessment,
                scenarios: !!this.scenarios
            });
            return [];
        }

        try {
            const insights = [];
            const params = this.collectEnhancedParameters();

            // Target Goal Assessment
            const targetRating = this.targetGoalAssessment.realismAssessment.rating;
            const requiredRate = Math.round(this.targetGoalAssessment.requiredSavingsRate * 100);
            const currentRate = Math.round(params.currentSavingsRate);

            insights.push({
                title: this.getThemeText('RETIREMENT_GOAL_ASSESSMENT'),
                value: targetRating,
                text: `Your goal to retire at ${params.targetRetirementAge} with $${this.formatCurrency(params.targetIncome)} is rated as "${targetRating}". You would need to save ${requiredRate}% of income vs your current ${currentRate}%.`
            });

            // Coast FIRE Analysis
            if (requiredRate <= 0) {
                // Calculate when they would hit Coast FIRE (current balance grows to target)
                const targetPortfolioSize = (params.targetIncome * Math.pow(1 + params.inflationRate/100, params.targetRetirementAge - params.startingAge)) / 0.04;
                const riskData = window.SavingsFeasibility.getRiskProfile(params.riskProfile, params.startingAge);
                const annualReturn = riskData.accumulation.return;
                
                // Calculate years for current balance to reach target with no additional contributions
                const yearsToCoastFire = Math.log(targetPortfolioSize / params.startingBalance) / Math.log(1 + annualReturn);
                const coastFireAge = Math.round(params.startingAge + yearsToCoastFire);
                
                insights.push({
                    title: this.getThemeText('COAST_FIRE_STATUS'),
                    value: `Age ${coastFireAge}`,
                    text: `You'll reach Coast FIRE at age ${coastFireAge}, when your current $${this.formatCurrency(params.startingBalance)} grows to $${this.formatCurrency(targetPortfolioSize)} without additional contributions. After that point, you can stop saving and still retire at ${params.targetRetirementAge} with your target income.`
                });
            }

            // Savings Rate Impact
            const currentScenario = this.scenarios.find(s => s.label === 'Current');
            const aggressiveScenario = this.scenarios.find(s => s.label === 'Aggressive');
            
            if (currentScenario && aggressiveScenario && currentScenario.valid && aggressiveScenario.valid) {
                const yearsSaved = currentScenario.retirementAge - aggressiveScenario.retirementAge;
                insights.push({
                    title: this.getThemeText('Savings Rate Impact'),
                    value: `${yearsSaved} years`,
                    text: `Increasing your savings rate by 20% (from ${Math.round(currentScenario.savingsRate*100)}% to ${Math.round(aggressiveScenario.savingsRate*100)}%) allows you to retire ${yearsSaved} years earlier.`
                });
            }

            // Cost of Living Impact
            const colTier = window.SavingsFeasibility.getStateCOLTier(params.state);
            const colNames = ['', 'Very High', 'High', 'Moderate', 'Low'];
            const maxSavings = Math.round(window.SavingsFeasibility.calculateMaxRealisticSavings(params.currentIncome, params.state) * 100);
            
            insights.push({
                title: this.getThemeText('Location Impact'),
                value: `${maxSavings}% max`,
                text: `Living in ${params.state} (${colNames[colTier]} cost of living) limits realistic savings to approximately ${maxSavings}% of income at your income level.`
            });

            // Risk Profile Impact
            const riskData = window.SavingsFeasibility.getRiskProfile(params.riskProfile, params.startingAge);
            insights.push({
                title: this.getThemeText('RISK_PROFILE'),
                value: riskData.name,
                text: `Your ${riskData.name} investment approach assumes ${Math.round(riskData.accumulation.return*100)}% returns during accumulation and ${Math.round(riskData.retirement.return*100)}% during retirement.`
            });

            // Portfolio Success Analysis (if Monte Carlo results available)
            if (this.scenarios && this.scenarios.length > 0) {
                const validScenarios = this.scenarios.filter(s => s.valid && s.monteCarloSuccessRate);
                if (validScenarios.length > 0) {
                    const lowestSuccess = validScenarios.reduce((min, scenario) => 
                        scenario.monteCarloSuccessRate < min.monteCarloSuccessRate ? scenario : min
                    );
                    
                    const successRate = Math.round(lowestSuccess.monteCarloSuccessRate * 100);
                    const failureRate = 100 - successRate;
                    
                    insights.push({
                        title: this.getThemeText('Portfolio Durability'),
                        value: `${successRate}% success`,
                        text: `Even if you achieve your savings goals (${Math.round(lowestSuccess.savingsRate*100)}% savings rate), your portfolio has a ${failureRate}% risk of depletion during retirement due to market volatility. This is separate from whether you can actually save that much.`
                    });
                    
                    // Add warning for high-risk scenarios
                    if (successRate < 80) {
                        insights.push({
                            title: this.getThemeText('MARKET_RISK_WARNING'),
                            value: 'High Risk',
                            text: `Portfolio success rates below 80% indicate significant market risk. Consider working longer, saving more, or choosing a more conservative investment approach to improve portfolio durability.`
                        });
                    }
                }
            }

            // Action Items
            if (!this.targetGoalAssessment.isRealistic) {
                const minRequiredRate = Math.round(this.targetGoalAssessment.requiredSavingsRate * 100);
                insights.push({
                    title: this.getThemeText('ACTION_REQUIRED'),
                    value: `${minRequiredRate}% needed`,
                    text: `To achieve your goal, consider: 1) Increase savings rate to ${minRequiredRate}%, 2) Retire later, 3) Reduce target income, or 4) Move to lower cost area.`
                });
            }
            
            // Suggest less aggressive savings rate if current scenario is highly realistic
            if (currentScenario && currentScenario.realismRating === 'Highly Realistic') {
                // Find a savings rate that would still be highly realistic but lower
                const currentRatePercent = Math.round(currentScenario.savingsRate * 100);
                const suggestedRate = Math.max(10, currentRatePercent - 5); // Suggest 5% lower but not below 10%
                
                // Calculate retirement age with the lower rate
                const yearsToRetirement = Math.max(5, Math.round((params.targetRetirementAge - params.startingAge) * 1.15));
                const suggestedRetirementAge = Math.min(70, params.startingAge + yearsToRetirement);
                
                insights.push({
                    title: this.getThemeText('OPTIMIZATION_OPPORTUNITY'),
                    value: `${suggestedRate}% rate`,
                    text: `Since your current ${currentRatePercent}% savings rate is highly realistic, you could potentially reduce it to ${suggestedRate}% and still retire comfortably around age ${suggestedRetirementAge}. This would free up income for current lifestyle while maintaining retirement security.`
                });
            }

            return insights;
        } catch (error) {
            console.error('Error generating new style insights:', error);
            return this.generateInsights(); // Fallback to old insights
        }
    }

    updateInsights() {
        const insightsContainer = document.getElementById('insightsContent');
        if (!insightsContainer) return;

        // Use new savings-focused insights if we have the new data structure
        const insights = this.targetGoalAssessment ? this.generateNewStyleInsights() : this.generateInsights();

        insightsContainer.innerHTML = insights.map(insight => `
            <div class="modern-insight">
                <div class="modern-insight-title">${insight.title}</div>
                <span class="modern-insight-value">${insight.value}</span>
                <div class="modern-insight-text">${insight.text}</div>
            </div>
        `).join('');
    }

    updateCharts() {
        try {
            this.updateNetWorthChart();
        } catch (error) {
            console.error('Error updating net worth chart:', error);
        }
        
        try {
            this.updateWithdrawalsChart();
        } catch (error) {
            console.error('Error updating withdrawals chart:', error);
        }
        
        try {
            this.updateSavingsVsRetirementChart();
        } catch (error) {
            console.error('Error updating savings vs retirement chart:', error);
        }
    }

    updateNetWorthChart() {
        const params = this.collectEnhancedParameters();
        
        // Get valid scenarios for analysis
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;
        
        // Calculate net worth data for each scenario
        const datasets = validScenarios.map(scenario => {
            const data = [];
            const startAge = params.startingAge;
            const retirementAge = scenario.retirementAge;
            const endAge = params.endAge || 85;
            
            // Calculate monthly contribution for this scenario
            const annualContribution = scenario.monthlyContribution * 12;
            
            // Calculate net worth progression
            for (let age = startAge; age <= endAge; age++) {
                let netWorth = 0;
                
                if (age <= retirementAge) {
                    // Accumulation phase
                    const yearsInvesting = age - startAge;
                    
                    // Future value of starting balance
                    const startingBalanceFV = params.startingBalance * Math.pow(1 + params.accumulationReturn/100, yearsInvesting);
                    
                    // Future value of annual contributions (annuity)
                    let contributionsFV = 0;
                    if (yearsInvesting > 0 && annualContribution > 0) {
                        const r = params.accumulationReturn / 100;
                        contributionsFV = annualContribution * ((Math.pow(1 + r, yearsInvesting) - 1) / r);
                    }
                    
                    netWorth = startingBalanceFV + contributionsFV;
                } else {
                    // Retirement phase - calculate withdrawals
                    const yearsInAccumulation = retirementAge - startAge;
                    const yearsInRetirement = age - retirementAge;
                    
                    // Portfolio value at retirement
                    const startingBalanceFV = params.startingBalance * Math.pow(1 + params.accumulationReturn/100, yearsInAccumulation);
                    let contributionsFV = 0;
                    if (yearsInAccumulation > 0 && annualContribution > 0) {
                        const r = params.accumulationReturn / 100;
                        contributionsFV = annualContribution * ((Math.pow(1 + r, yearsInAccumulation) - 1) / r);
                    }
                    const portfolioAtRetirement = startingBalanceFV + contributionsFV;
                    
                    // Calculate annual withdrawal (inflation-adjusted)
                    const yearsFromNow = retirementAge - startAge;
                    const inflationAdjustedIncome = params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsFromNow);
                    
                    // Apply withdrawals over retirement years
                    let currentPortfolio = portfolioAtRetirement;
                    for (let retYear = 1; retYear <= yearsInRetirement; retYear++) {
                        // Withdraw at beginning of year
                        const withdrawalAmount = inflationAdjustedIncome * Math.pow(1 + params.inflationRate/100, retYear - 1);
                        currentPortfolio -= withdrawalAmount;
                        
                        // Apply investment return for remaining year
                        if (currentPortfolio > 0) {
                            currentPortfolio *= (1 + params.retirementReturn/100);
                        } else {
                            currentPortfolio = 0;
                            break;
                        }
                    }
                    
                    netWorth = Math.max(0, currentPortfolio);
                }
                
                data.push({
                    x: age,
                    y: netWorth
                });
            }
            
            return {
                label: `Scenario ${scenario.label}`,
                data: data,
                borderColor: scenario.color,
                backgroundColor: scenario.color + '20',
                borderWidth: 3,
                pointRadius: 2,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: false
            };
        });
        
        // Destroy existing chart
        if (this.netWorthChart) {
            this.netWorthChart.destroy();
        }
        
        // Create new chart with theme-aware configuration
        const ctx = document.getElementById('netWorthChart');
        if (!ctx) return;
        
        // Prepare data in format expected by ChartThemes
        const chartData = {
            scenarios: validScenarios.map((scenario, index) => {
                const ageData = [];
                const startAge = params.startingAge;
                const endAge = params.endAge || 85;
                
                // Extract age and net worth data from the scenario
                for (let age = startAge; age <= endAge; age++) {
                    const dataPoint = datasets[index]?.data?.find(d => d.x === age);
                    if (dataPoint) {
                        ageData.push({ age: age, netWorth: dataPoint.y });
                    }
                }
                
                return {
                    scenario: index + 1,
                    label: scenario.label,
                    retirementAge: scenario.retirementAge,
                    projections: ageData
                };
            })
        };
        
        // Use theme-aware chart configuration if available
        if (typeof ChartThemes !== 'undefined') {
            try {
                const config = ChartThemes.createNetWorthChart(chartData, );
                this.netWorthChart = new Chart(ctx, config);
                return;
            } catch (error) {
                console.warn('Failed to use theme-aware chart, falling back to default:', error);
            }
        }
        
        // Fallback to theme-aware configuration
        const colors = this.getThemeColors();
        const fonts = this.getThemeFonts();
        
        this.netWorthChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: colors.text,
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.background,
                        borderColor: colors.primary,
                        borderWidth: 1,
                        titleColor: colors.text,
                        bodyColor: colors.text,
                        titleFont: {
                            family: fonts.primary
                        },
                        bodyFont: {
                            family: fonts.primary
                        },
                        callbacks: {
                            label: function(context) {
                                const netWorth = context.parsed.y;
                                if (netWorth >= 1000000) {
                                    return `${context.dataset.label}: $${(netWorth / 1000000).toFixed(1)}M`;
                                } else if (netWorth >= 1000) {
                                    return `${context.dataset.label}: $${(netWorth / 1000).toFixed(0)}k`;
                                } else {
                                    return `${context.dataset.label}: $${Math.round(netWorth).toLocaleString()}`;
                                }
                            },
                            afterBody: function(context) {
                                const age = context[0].parsed.x;
                                const scenario = validScenarios.find(s => `Scenario ${s.label}` === context[0].dataset.label);
                                if (scenario && age <= scenario.retirementAge) {
                                    return [`Accumulation Phase`, `Retirement at age ${scenario.retirementAge}`];
                                } else if (scenario && age > scenario.retirementAge) {
                                    return [`Retirement Phase`, `Withdrawing for ${age - scenario.retirementAge} years`];
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: params.startingAge,
                        max: params.endAge || 85,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            callback: function(value) {
                                if (value === 0) return '$0';
                                if (value >= 1000000) {
                                    return '$' + (value / 1000000).toFixed(1) + 'M';
                                } else if (value >= 1000) {
                                    return '$' + (value / 1000).toFixed(0) + 'k';
                                }
                                return '$' + Math.round(value).toLocaleString();
                            }
                        },
                        title: {
                            display: true,
                            text: 'Net Worth',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    }
                }
            }
        });
    }

    updateWithdrawalsChart() {
        const params = this.collectEnhancedParameters();

        // Calculate earliest retirement age for starting point from our scenarios
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) return;
        
        const earliestRetirementAge = Math.min(...validScenarios.map(s => s.retirementAge));
        const endAge = params.endAge || 85;
        
        // Generate withdrawal data points as {x, y} objects
        const data = [];
        for (let age = earliestRetirementAge; age <= endAge; age++) {
            // Calculate years from TODAY (current age) to this age for proper inflation adjustment
            const yearsFromToday = age - params.startingAge;
            const withdrawal = params.targetIncome * Math.pow(1 + params.inflationRate/100, yearsFromToday);
            data.push({
                x: age,
                y: withdrawal
            });
        }

        // Calculate max withdrawal for zoom limits (from current age to end age)
        const maxAge = endAge;
        const maxYearsFromToday = maxAge - params.startingAge;
        const maxWithdrawal = params.targetIncome * Math.pow(1 + params.inflationRate/100, maxYearsFromToday);

        const datasets = [{
            label: 'Retirement Withdrawals (Inflation Adjusted)',
            data: data,
            borderColor: '#7FB069',
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 4,
            tension: 0.1,
            spanGaps: false
        }];

        // Destroy existing chart if it exists
        if (this.withdrawalsChart) {
            this.withdrawalsChart.destroy();
        }

        // Create new chart with theme-aware configuration
        const ctx = document.getElementById('withdrawalsChart').getContext('2d');
        
        // Prepare data for theme-aware chart
        const retirementData = [];
        
        // Create proper retirement data from withdrawal data and calculate hypothetical balances
        if (datasets && datasets.length > 0) {
            const withdrawalDataset = datasets[0]; // The withdrawal dataset
            
            if (withdrawalDataset && withdrawalDataset.data) {
                // Calculate a hypothetical portfolio balance that could support these withdrawals
                // Using a simplified calculation: assume 4% withdrawal rate
                withdrawalDataset.data.forEach((point, index) => {
                    const withdrawal = point.y;
                    const age = point.x;
                    // Rough estimate: balance = withdrawal / 0.04 (4% rule)
                    const estimatedBalance = withdrawal / 0.04;
                    
                    retirementData.push({
                        age: age,
                        balance: estimatedBalance,
                        withdrawal: withdrawal
                    });
                });
            }
        }
        
        const chartData = {
            scenarios: [{
                scenario: 1,
                retirementData: retirementData
            }],
            targetRetirementAge: params.targetRetirementAge, // Add target retirement age for markers
            savingsScenarios: this.scenarios // Pass scenario data for colored dots
        };
        
        // Use theme-aware chart configuration if available and has data
        if (typeof ChartThemes !== 'undefined' && retirementData.length > 0) {
            try {
                const config = ChartThemes.createWithdrawalsChart(chartData, );
                this.withdrawalsChart = new Chart(ctx, config);
                return;
            } catch (error) {
                console.warn('Failed to use theme-aware withdrawals chart, falling back to default:', error);
            }
        }
        
        // Fallback to original configuration
        this.withdrawalsChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#7FB069',
                        borderWidth: 1,
                        titleColor: '#7FB069',
                        bodyColor: '#7FB069',
                        font: {
                            family: fonts.primary
                        },
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + (Math.round(context.parsed.y).toLocaleString());
                            }
                        }
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: earliestRetirementAge,
                        max: endAge,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    y: {
                        min: -params.targetIncome * 0.0475, // 4.75% buffer below zero (5% reduced by 5%)
                        max: maxWithdrawal * 1.045, // 4.5% buffer above max (10% reduced by 5%)
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            callback: function(value) {
                                return '$' + (Math.round(value).toLocaleString());
                            }
                        },
                        title: {
                            display: true,
                            text: 'Retirement Withdrawals',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    }
                }
            }
        });
    }


    async updateAll() {
        const startTime = Date.now();
        
        try {
            // Calculate basic scenarios first
            this.calculateScenarios();
            this.updateTargetGoalAssessment();
            this.updateSummaryTable();
            
            // Run Monte Carlo simulation and financial modeling asynchronously
            await this.runMonteCarloAnalysis();
            await this.runFinancialModeling();
            
            // Update table again with Monte Carlo results
            this.updateSummaryTable();
            
            // Generate insights after all data is available
            this.updateInsights();
            
            // Update all charts directly without loading states
            this.updateCharts();
            
        } catch (error) {
            console.error('Error in updateAll:', error);
        } finally {
            const duration = Date.now() - startTime;
        }
    }


    updateTargetGoalAssessment() {
        const container = document.getElementById('targetGoalContent');
        if (!container) {
            console.warn('Target goal container not found');
            return;
        }
        
        if (!this.targetGoalAssessment) {
            console.warn('Target goal assessment not available');
            container.innerHTML = `
                <div class="subtitle-text text-center py-4">
                    CALCULATING RETIREMENT GOAL ASSESSMENT...
                </div>
            `;
            return;
        }

        try {
            const params = this.collectEnhancedParameters();
            const assessment = this.targetGoalAssessment;
            const realismClass = this.getRealismColorClass(assessment.realismAssessment.rating);
            const requiredRate = Math.round(assessment.requiredSavingsRate * 100);
            const currentRate = Math.round(params.currentSavingsRate);
            const rateDifference = requiredRate - currentRate;
            
            // Generate confidence meter for overall assessment
            const confidenceMeter = this.generateConfidenceMeter(Math.round(assessment.realismAssessment.score));
            
            // Generate actionable recommendations
            let recommendations = [];
            if (!assessment.isRealistic) {
                if (rateDifference <= 10) {
                    recommendations.push(`Increase savings rate by ${rateDifference}% (achievable with discipline)`);
                } else {
                    recommendations.push(`Consider retiring ${Math.ceil(rateDifference / 5)} years later`);
                    recommendations.push(`Reduce target income to $${this.formatCurrency(Math.round(params.targetIncome * 0.8))}`);
                }
                
                const colTier = window.SavingsFeasibility.getStateCOLTier(params.state);
                if (colTier <= 2) {
                    recommendations.push('Consider moving to a lower cost of living area');
                }
            } else {
                recommendations.push('Your retirement goal appears achievable with your current plan');
                recommendations.push('Consider the scenarios below to potentially retire earlier');
            }

            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-sage-green font-bold mb-3">${this.getThemeText('YOUR RETIREMENT GOAL')}</h4>
                        <div class="space-y-2 text-sm">
                            <div><span class="subtitle-text">Target Retirement Age:</span> ${params.targetRetirementAge} years old</div>
                            <div><span class="subtitle-text">Target Annual Income:</span> $${this.formatCurrency(params.targetIncome)}</div>
                            <div><span class="subtitle-text">Current Savings Rate:</span> ${currentRate}%</div>
                            <div><span class="subtitle-text">Required Savings Rate:</span> <span class="${rateDifference > 0 ? 'text-orange-400' : 'text-green-400'}">${requiredRate}%</span></div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-sage-green font-bold mb-3">${this.getThemeText('ASSESSMENT')}</h4>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <span class="${realismClass} font-bold">${assessment.realismAssessment.rating}</span>
                                ${confidenceMeter}
                            </div>
                            
                            <div class="text-sm space-y-1">
                                ${recommendations.map(rec => `<div class="opacity-90">• ${rec}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error updating target goal assessment:', error);
            container.innerHTML = `
                <div class="text-red-400 text-center py-4">
                    ERROR: Unable to generate retirement goal assessment
                </div>
            `;
        }
    }

    // Export functions
    exportPDF() {
        // Use browser's print functionality to save as PDF
        window.print();
    }

    async shareURL() {
        const params = URLStateManager.collectParametersFromForm();
        try {
            const result = await ExportUtility.copyShareableURL(params);
            if (result.success) {
                // Show temporary success message
                const button = document.getElementById('shareURL');
                const originalText = button.textContent;
                button.textContent = 'URL_COPIED!';
                button.style.backgroundColor = '#7FB069';
                button.style.color = '#000000';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = '';
                    button.style.color = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to copy URL:', error);
        }
    }

    // NEW METHODS FOR ENHANCED FUNCTIONALITY

    /**
     * Set up theme change listener to refresh charts when theme switches
     */
    setupThemeChangeListener() {
        // Listen for theme changes from the parent document
        window.addEventListener('themechange', () => {
            // Force chart refresh by destroying and recreating them
            this.destroyAllCharts();
            // Small delay to ensure theme CSS variables are updated
            setTimeout(() => {
                this.updateCharts();
            }, 50);
        });
        
        // Also listen for storage events in case theme changes in another tab
        window.addEventListener('storage', (e) => {
            if (e.key === 'bufoindex-theme') {
                this.destroyAllCharts();
                setTimeout(() => {
                    this.updateCharts();
                }, 50);
            }
        });
    }

    /**
     * Set up form validation with real-time feedback
     */
    setupFormValidation() {
        const inputs = document.querySelectorAll('[data-validation]');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateInput(input));
            input.addEventListener('input', () => this.clearValidationError(input));
        });
    }

    /**
     * Validate individual input field
     */
    validateInput(input) {
        if (!input || !input.dataset) return true; // Safety check
        
        const validationType = input.dataset.validation;
        const value = input.value;
        const id = input.id;
        
        // Handle different DOM structures - look in parent or grandparent for error element
        let errorElement = input.parentElement.querySelector('.modern-error');
        if (!errorElement) {
            errorElement = input.parentElement.parentElement?.querySelector('.modern-error');
        }
        
        let isValid = true;
        let errorMessage = '';

        switch (validationType) {
            case 'currency':
                const numValue = this.parseCurrencySafe(value);
                const min = parseFloat(input.dataset.min) || 0;
                const max = parseFloat(input.dataset.max) || Infinity;
                
                // Enhanced validation with overflow protection
                if (value && (isNaN(numValue) || numValue < min)) {
                    isValid = false;
                    errorMessage = `MINIMUM: $${min.toLocaleString()}`;
                } else if (value && numValue > max) {
                    isValid = false;
                    errorMessage = `MAXIMUM: $${max.toLocaleString()}`;
                } else if (value && numValue > 100000000) { // $100M overflow protection
                    isValid = false;
                    errorMessage = `VALUE_TOO_LARGE (MAX: $100M)`;
                }
                break;
                
            case 'percentage':
                const percentValue = parseFloat(value);
                const minPercent = parseFloat(input.dataset.min) || 0;
                const maxPercent = parseFloat(input.dataset.max) || 100;
                
                if (value && (isNaN(percentValue) || percentValue < minPercent || percentValue > maxPercent)) {
                    isValid = false;
                    errorMessage = `RANGE: ${minPercent}%-${maxPercent}%`;
                }
                break;
                
            case 'age':
                const ageValue = parseInt(value);
                const minAge = parseInt(input.dataset.min) || 18;
                const maxAge = parseInt(input.dataset.max) || 100;
                
                if (value && (isNaN(ageValue) || ageValue < minAge || ageValue > maxAge)) {
                    isValid = false;
                    errorMessage = `RANGE: ${minAge}-${maxAge} years`;
                }
                
                // Cross-field age validation
                if (isValid && value) {
                    const crossValidation = this.validateAgeRelationships(id, ageValue);
                    if (!crossValidation.valid) {
                        isValid = false;
                        errorMessage = crossValidation.message;
                    }
                }
                break;
        }

        if (!isValid) {
            input.classList.add('border-red-400');
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.classList.remove('hidden');
            }
        } else {
            this.clearValidationError(input);
        }
        
        return isValid;
    }

    /**
     * Validate age relationships between fields
     */
    validateAgeRelationships(ageFieldId, ageValue) {
        const startingAge = parseInt(document.getElementById('startingAge')?.value) || 0;
        const targetRetirementAge = parseInt(document.getElementById('targetRetirementAge')?.value) || 0;
        const endAge = parseInt(document.getElementById('endAge')?.value) || 0;
        
        switch (ageFieldId) {
            case 'targetRetirementAge':
                if (startingAge && ageValue <= startingAge + 4) {
                    return {
                        valid: false,
                        message: `MIN: ${startingAge + 5} (current+5)`
                    };
                }
                if (endAge && ageValue >= endAge) {
                    return {
                        valid: false,
                        message: `MAX: ${endAge - 1} (before death)`
                    };
                }
                break;
                
            case 'startingAge':
                if (targetRetirementAge && ageValue >= targetRetirementAge - 4) {
                    return {
                        valid: false,
                        message: `MAX: ${targetRetirementAge - 5} (retire-5)`
                    };
                }
                break;
                
            case 'endAge':
                if (targetRetirementAge && ageValue <= targetRetirementAge) {
                    return {
                        valid: false,
                        message: `MIN: ${targetRetirementAge + 1} (after retire)`
                    };
                }
                break;
        }
        
        return { valid: true };
    }

    /**
     * Safe currency parsing with overflow protection
     */
    parseCurrencySafe(value) {
        if (!value) return 0;
        
        // Remove currency symbols and commas
        const cleaned = value.toString().replace(/[,$€£¥]/g, '');
        const parsed = parseFloat(cleaned);
        
        // Check for overflow
        if (parsed > Number.MAX_SAFE_INTEGER) {
            return Number.MAX_SAFE_INTEGER;
        }
        
        return parsed || 0;
    }

    /**
     * Clear validation error for input
     */
    clearValidationError(input) {
        input.classList.remove('border-red-400');
        
        // Handle different DOM structures - look in parent or grandparent for error element
        let errorElement = input.parentElement.querySelector('.modern-error');
        if (!errorElement) {
            errorElement = input.parentElement.parentElement?.querySelector('.modern-error');
        }
        
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    /**
     * Set up accessibility features
     */
    setupAccessibilityFeatures() {
        // Make help tooltips keyboard accessible
        const helpButtons = document.querySelectorAll('.modern-help');
        helpButtons.forEach(button => {
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTooltip(button);
                }
            });

            button.addEventListener('focus', () => {
                this.showTooltip(button);
            });

            button.addEventListener('blur', () => {
                this.hideTooltip(button);
            });
        });

        // Update aria-expanded for state dropdown
        const stateInput = document.getElementById('stateInput');
        const stateDropdown = document.getElementById('stateDropdown');
        
        if (stateInput && stateDropdown) {
            // Observer to update aria-expanded
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isHidden = stateDropdown.classList.contains('hidden');
                        stateInput.setAttribute('aria-expanded', !isHidden);
                    }
                });
            });

            observer.observe(stateDropdown, { 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        }

        // Add role and aria-selected to dropdown options
        this.enhanceDropdownOptions();
    }

    /**
     * Toggle tooltip visibility for keyboard users
     */
    toggleTooltip(button) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', !isExpanded);
        
        if (!isExpanded) {
            this.showTooltip(button);
        } else {
            this.hideTooltip(button);
        }
    }

    /**
     * Show tooltip
     */
    showTooltip(button) {
        const title = button.getAttribute('title');
        const ariaLabel = button.getAttribute('aria-label');
        
        // Create tooltip element if it doesn't exist
        let tooltip = button.nextElementSibling;
        if (!tooltip || !tooltip.classList.contains('tooltip-popup')) {
            tooltip = document.createElement('div');
            tooltip.className = 'tooltip-popup absolute z-20 bg-white border border-sage-green text-sage-green p-2 text-xs rounded max-w-xs mt-1';
            tooltip.innerHTML = title || ariaLabel || '';
            tooltip.style.bottom = '100%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            
            button.parentElement.style.position = 'relative';
            button.parentElement.appendChild(tooltip);
        }
        
        tooltip.style.display = 'block';
        button.setAttribute('aria-expanded', 'true');
    }

    /**
     * Hide tooltip
     */
    hideTooltip(button) {
        const tooltip = button.parentElement?.querySelector('.tooltip-popup');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
        button.setAttribute('aria-expanded', 'false');
    }

    /**
     * Enhance dropdown options with proper ARIA attributes
     */
    enhanceDropdownOptions() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const dropdown = mutation.target;
                    if (dropdown.id === 'stateDropdown') {
                        const options = dropdown.querySelectorAll('[data-index]');
                        options.forEach((option, index) => {
                            option.setAttribute('role', 'option');
                            option.setAttribute('id', `state-option-${index}`);
                            option.setAttribute('aria-selected', 'false');
                            
                            // Make options focusable
                            option.setAttribute('tabindex', '-1');
                        });
                    }
                }
            });
        });

        const stateDropdown = document.getElementById('stateDropdown');
        if (stateDropdown) {
            observer.observe(stateDropdown, { childList: true });
        }
    }

    /**
     * Run Monte Carlo simulation analysis
     */
    async runMonteCarloAnalysis() {
        const params = this.collectEnhancedParameters();

        // Generate scenario configs from our savings rate scenarios
        const scenarioConfigs = this.scenarios.filter(s => s.valid).map(scenario => ({
            retirementAge: scenario.retirementAge,
            label: scenario.label,
            savingsRate: scenario.savingsRate
        }));

        if (scenarioConfigs.length === 0) {
            console.warn('No valid scenarios for Monte Carlo analysis');
            return;
        }

        const assumptions = {
            startingAge: params.startingAge,
            startingBalance: params.startingBalance,
            targetIncome: params.targetIncome,
            inflationRate: params.inflationRate,
            accumulationReturn: params.accumulationReturn,
            retirementReturn: params.retirementReturn,
            volatility: params.volatility,
            monteCarloRuns: this.getOptimalMonteCarloRuns(params)
        };

        // Run Monte Carlo simulation
        try {
            this.monteCarloResults = await this.runMonteCarloSimulation(scenarioConfigs, assumptions);
            
            // Update scenarios with Monte Carlo success rates
            if (this.monteCarloResults && this.monteCarloResults.scenarios) {
                this.monteCarloResults.scenarios.forEach((mcResult, index) => {
                    if (this.scenarios[index]) {
                        this.scenarios[index].monteCarloSuccessRate = mcResult.successRate;
                        this.scenarios[index].portfolioStats = mcResult.portfolioAtRetirement;
                    }
                });
            }
        } catch (error) {
            console.error('Monte Carlo simulation failed:', error);
        }
    }

    /**
     * Run Monte Carlo simulation (wrapped for async execution)
     */
    async runMonteCarloSimulation(scenarios, assumptions) {
        return new Promise((resolve) => {
            // Use setTimeout to prevent UI blocking
            setTimeout(() => {
                const results = MonteCarloEngine.runSimulations(scenarios, {
                    inflationRate: assumptions.inflationRate / 100,
                    accumulationReturn: assumptions.accumulationReturn / 100,
                    retirementReturn: assumptions.retirementReturn / 100,
                    volatility: assumptions.volatility / 100,
                    monteCarloRuns: assumptions.monteCarloRuns
                });
                resolve(results);
            }, 10);
        });
    }

    /**
     * Run financial modeling analysis
     */
    async runFinancialModeling() {
        const params = this.collectEnhancedParameters();
        const validated = URLStateManager.validateParameters(params);

        const scenarioConfigs = [
            { label: 'A', retirementAge: validated.retirementAgeA },
            { label: 'B', retirementAge: validated.retirementAgeB },
            { label: 'C', retirementAge: validated.retirementAgeC }
        ];

        try {
            this.financialModelingResults = await this.runFinancialModelingAnalysis(scenarioConfigs, validated);
        } catch (error) {
            console.error('Financial modeling analysis failed:', error);
        }
    }

    /**
     * Run financial modeling analysis (wrapped for async execution)
     */
    async runFinancialModelingAnalysis(scenarios, assumptions) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const results = {
                    scenarios: [],
                    taxAnalysis: {},
                    socialSecurityOptimization: {},
                    healthcareProjections: {},
                    accountTypeOptimization: {}
                };

                scenarios.forEach((scenario, index) => {
                    // Calculate tax-adjusted withdrawals
                    const grossWithdrawal = assumptions.targetIncome;
                    const taxResult = FinancialModeling.calculateTaxAdjustedWithdrawal(
                        grossWithdrawal,
                        assumptions.accountType,
                        assumptions.state,
                        scenario.retirementAge,
                        assumptions.filingStatus || 'Single'
                    );

                    // Social Security optimization
                    const ssOptimization = FinancialModeling.optimizeSocialSecurity(
                        assumptions.startingAge,
                        scenario.retirementAge,
                        assumptions.socialSecurityBenefit,
                        assumptions.lifeExpectancy || 85
                    );

                    // Healthcare cost projections
                    const healthcareProjection = FinancialModeling.calculateHealthcareCosts(
                        scenario.retirementAge,
                        null, // Use age-based default
                        assumptions.healthcareMultiplier,
                        (assumptions.healthcareInflation || 5) / 100,
                        (assumptions.lifeExpectancy || 85) - scenario.retirementAge
                    );

                    results.scenarios.push({
                        scenario: scenario.label,
                        retirementAge: scenario.retirementAge,
                        grossWithdrawal: grossWithdrawal,
                        netWithdrawal: taxResult.netIncome,
                        taxAnalysis: taxResult,
                        socialSecurityBenefit: ssOptimization.optimal.monthlyBenefit * 12,
                        socialSecurityOptimization: ssOptimization,
                        healthcareCosts: healthcareProjection.averageAnnualCost,
                        healthcareProjection: healthcareProjection,
                        effectiveTaxRate: taxResult.effectiveRate
                    });
                });

                // Generate account type optimization
                results.accountTypeOptimization = FinancialModeling.determineOptimalAccountType(
                    assumptions.currentIncome,
                    assumptions.retirementTaxRate / 100,
                    assumptions.currentTaxRate / 100,
                    Math.min(
                        assumptions.retirementAgeA - assumptions.startingAge,
                        assumptions.retirementAgeB - assumptions.startingAge,
                        assumptions.retirementAgeC - assumptions.startingAge
                    )
                );

                resolve(results);
            }, 10);
        });
    }

    /**
     * Collect enhanced parameters including new fields
     */
    collectEnhancedParameters() {
        try {
            // Try to get basic parameters from URL state manager
            let basic = {};
            try {
                basic = URLStateManager.collectParametersFromForm() || {};
            } catch (error) {
                console.warn('URLStateManager failed, using direct form access:', error);
                basic = {};
            }
            
            // Collect parameters directly from form elements with fallbacks
            const enhanced = {
                // NEW: Primary parameters
                startingAge: this.getInputValue('startingAge', 'number'),
                targetRetirementAge: this.getInputValue('targetRetirementAge', 'number'),
                currentSavingsRate: this.getInputValue('currentSavingsRate', 'number'),
                targetIncome: this.getInputValue('targetIncome', 'currency'),
                startingBalance: this.getInputValue('startingBalance', 'currency'),
                currentIncome: this.getInputValue('currentIncome', 'currency'),
                state: this.getSelectValue('state'),
                riskProfile: this.getSelectValue('riskProfile'),
                inflationRate: this.getInputValue('inflationRate', 'number'),
                endAge: this.getInputValue('endAge', 'number'),
                
                // Merge any successfully collected basic parameters
                ...basic,
                
                // Smart Monte Carlo runs based on scenario complexity
                monteCarloRuns: this.getOptimalMonteCarloRuns(basic),
                accountType: this.getSelectValue('accountType'),
                socialSecurityAge: this.getInputValue('socialSecurityAge', 'number') || 67,
                socialSecurityBenefit: this.getInputValue('socialSecurityBenefit', 'currency') || 2000,
                healthcareMultiplier: parseFloat(this.getSelectValue('healthcareMultiplier')) || 1.0
            };

            // Get return rates - check manual overrides first, then fall back to risk profile
            const manualAccumReturn = this.getInputValue('accumulationReturn', 'number');
            const manualRetireReturn = this.getInputValue('retirementReturn', 'number');
            
            // Check if risk profile is set to custom (indicating manual override)
            // Check if inputs have values (including 0%) by looking at element values directly
            const accumulationElement = document.getElementById('accumulationReturn');
            const retirementElement = document.getElementById('retirementReturn');
            const hasManualAccumReturn = accumulationElement && accumulationElement.value !== '';
            const hasManualRetireReturn = retirementElement && retirementElement.value !== '';
            
            if (enhanced.riskProfile === 'custom' || hasManualAccumReturn || hasManualRetireReturn) {
                // Use manual overrides, fall back to risk profile for missing values
                if (hasManualAccumReturn) {
                    enhanced.accumulationReturn = manualAccumReturn;
                    console.log('Using manual accumulation return:', manualAccumReturn);
                }
                if (hasManualRetireReturn) {
                    enhanced.retirementReturn = manualRetireReturn;
                    console.log('Using manual retirement return:', manualRetireReturn);
                }
                enhanced.volatility = this.getInputValue('volatility', 'number') || 15;
                
                // For any missing manual values when in custom mode, get from risk profile or use defaults
                if (!hasManualAccumReturn || !hasManualRetireReturn) {
                    if (typeof SavingsFeasibility !== 'undefined') {
                        try {
                            const riskData = SavingsFeasibility.getRiskProfile('moderate', enhanced.startingAge);
                            if (!hasManualAccumReturn) {
                                enhanced.accumulationReturn = riskData.accumulation.return * 100;
                            }
                            if (!hasManualRetireReturn) {
                                enhanced.retirementReturn = riskData.retirement.return * 100;
                            }
                        } catch (error) {
                            if (!hasManualAccumReturn) enhanced.accumulationReturn = 8;
                            if (!hasManualRetireReturn) enhanced.retirementReturn = 6;
                        }
                    } else {
                        if (!hasManualAccumReturn) enhanced.accumulationReturn = 8;
                        if (!hasManualRetireReturn) enhanced.retirementReturn = 6;
                    }
                }
            } else if (typeof SavingsFeasibility !== 'undefined') {
                try {
                    // Use risk profile defaults with age for TDF calculations
                    const riskData = SavingsFeasibility.getRiskProfile(enhanced.riskProfile, enhanced.startingAge);
                    enhanced.accumulationReturn = riskData.accumulation.return * 100; // Convert to percentage
                    enhanced.retirementReturn = riskData.retirement.return * 100;
                    enhanced.volatility = riskData.accumulation.volatility * 100;
                } catch (error) {
                    console.warn('Error getting risk profile, using defaults:', error);
                    enhanced.accumulationReturn = 8;
                    enhanced.retirementReturn = 6;
                    enhanced.volatility = 12;
                }
            } else {
                console.warn('SavingsFeasibility not loaded, using default returns');
                enhanced.accumulationReturn = 8;
                enhanced.retirementReturn = 6;
                enhanced.volatility = 12;
            }

            // Debug: Log final parameters for troubleshooting
            console.log('Final enhanced parameters:', {
                accumulationReturn: enhanced.accumulationReturn,
                retirementReturn: enhanced.retirementReturn,
                riskProfile: enhanced.riskProfile,
                volatility: enhanced.volatility
            });

            return enhanced;
        } catch (error) {
            console.error('Error collecting enhanced parameters:', error);
            // Return safe defaults
            return {
                startingAge: 25,
                targetRetirementAge: 45,
                currentSavingsRate: 15,
                targetIncome: 120000,
                startingBalance: 100000,
                currentIncome: 80000,
                state: 'TX',
                riskProfile: 'tdf',
                inflationRate: 3,
                endAge: 85,
                accumulationReturn: 8,
                retirementReturn: 6,
                volatility: 12,
                monteCarloRuns: this.getOptimalMonteCarloRuns({ volatility: 12, startingAge: 25, targetRetirementAge: 65 }),
                accountType: 'Taxable'
            };
        }
    }

    /**
     * Helper to get input value with type conversion
     */
    getInputValue(id, type = 'number') {
        const element = document.getElementById(id);
        if (!element) {
            // Silently handle missing elements with defaults (enhanced parameters are optional)
            const defaults = {
                'targetRetirementAge': 45,
                'currentSavingsRate': 15,
                'currentIncome': 80000,
                'targetIncome': 120000,
                'startingBalance': 100000,
                'startingAge': 25,
                'socialSecurityAge': 67,
                'socialSecurityBenefit': 2000,
                'inflationRate': 3,
                'endAge': 85
            };
            const defaultValue = defaults[id] || 0;
            
            if (type === 'currency') {
                return defaultValue;
            } else if (type === 'number') {
                return defaultValue;
            } else {
                return defaultValue.toString();
            }
        }
        
        switch (type) {
            case 'currency':
                // Use built-in currency parsing instead of FinancialCalculations
                if (typeof element.value === 'string') {
                    return parseFloat(element.value.replace(/[$,]/g, '')) || 0;
                }
                return parseFloat(element.value) || 0;
            case 'number':
                return parseFloat(element.value) || 0;
            default:
                return element.value || '';
        }
    }

    /**
     * Helper to get select value
     */
    getSelectValue(id) {
        const element = document.getElementById(id);
        if (!element) {
            // Silently handle missing elements with defaults (enhanced parameters are optional)
            const defaults = {
                'state': 'TX',
                'riskProfile': 'tdf',
                'accountType': 'Taxable',
                'healthcareMultiplier': '1.0'
            };
            return defaults[id] || '';
        }
        return element.value || '';
    }

    /**
     * Update return rate inputs when risk profile changes
     */
    updateRiskProfileReturns() {
        const riskProfile = this.getSelectValue('riskProfile');
        const accumulationInput = document.getElementById('accumulationReturn');
        const retirementInput = document.getElementById('retirementReturn');
        const volatilityInput = document.getElementById('volatility');
        
        // Don't update if "custom" is selected (manual override active)
        if (riskProfile === 'custom') {
            return;
        }
        
        if (typeof SavingsFeasibility !== 'undefined' && accumulationInput && retirementInput && riskProfile) {
            try {
                // Get current age for TDF calculations
                const currentAge = this.getInputValue('startingAge', 'number') || 30;
                const riskData = SavingsFeasibility.getRiskProfile(riskProfile, currentAge);
                
                // Update the values based on risk profile
                accumulationInput.value = (riskData.accumulation.return * 100).toFixed(1);
                retirementInput.value = (riskData.retirement.return * 100).toFixed(1);
                
                // Update volatility if available
                if (volatilityInput) {
                    volatilityInput.value = (riskData.accumulation.volatility * 100).toFixed(1);
                }
                
                // Show TDF allocation details if TDF is selected
                this.updateTDFDisplay(riskProfile, riskData);
                
                // Trigger recalculation
                this.updateAll();
            } catch (error) {
                console.warn('Error updating risk profile returns:', error);
            }
        }
    }

    /**
     * Update TDF display information
     */
    updateTDFDisplay(riskProfile, riskData) {
        // Remove any existing TDF display
        const existingDisplay = document.getElementById('tdfAllocationDisplay');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        
        // Tooltip removed as requested - no longer creating TDF allocation display
    }
    
    handleManualReturnOverride() {
        const riskProfileSelect = document.getElementById('riskProfile');
        const customOption = riskProfileSelect?.querySelector('option[value="custom"]');
        
        if (riskProfileSelect && customOption) {
            // Show the custom option and select it
            customOption.style.display = 'block';
            riskProfileSelect.value = 'custom';
            
            // Trigger recalculation
            this.updateAll();
        }
    }

    /**
     * Update success probability chart based on realism scores
     */
    updateSuccessProbabilityChart() {
        const ctx = document.getElementById('successProbabilityChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.successProbabilityChart) {
            this.successProbabilityChart.destroy();
        }

        // Use scenarios with realism scores instead of Monte Carlo
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) {
            return;
        }

        const labels = validScenarios.map(s => `Scenario ${s.label}`);
        const realismScores = validScenarios.map(s => s.confidenceLevel || s.realismScore || 0);
        const scenarioColors = validScenarios.map(s => s.color);

        this.successProbabilityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Realism Score (%)',
                    data: realismScores,
                    backgroundColor: scenarioColors.map(color => color + '80'), // Add transparency
                    borderColor: scenarioColors,
                    borderWidth: 2,
                    barThickness: 'flex',
                    maxBarThickness: 80
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#7FB069',
                        borderWidth: 1,
                        titleColor: '#7FB069',
                        bodyColor: '#7FB069',
                        titleFont: {
                            family: fonts.primary
                        },
                        bodyFont: {
                            family: fonts.primary
                        },
                        callbacks: {
                            label: function(context) {
                                const scenario = validScenarios[context.dataIndex];
                                return [
                                    `Realism Score: ${context.parsed.y.toFixed(0)}%`,
                                    `Rating: ${scenario.realismRating}`,
                                    `Savings Rate: ${Math.round(scenario.savingsRate * 100)}%`,
                                    `Retire at: ${scenario.retirementAge} years`,
                                    `Monthly Savings: $${Math.round(scenario.monthlyContribution).toLocaleString()}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Realism Score (%)',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Update portfolio distribution chart
     */
    updatePortfolioDistributionChart() {
        const ctx = document.getElementById('portfolioDistributionChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.portfolioDistributionChart) {
            this.portfolioDistributionChart.destroy();
        }

        // Use scenarios from main calculator instead of Monte Carlo results
        const validScenarios = this.scenarios.filter(s => s.valid);
        if (validScenarios.length === 0) {
            return;
        }

        const labels = validScenarios.map(s => `Scenario ${s.label}`);
        const scenarioColors = validScenarios.map(s => s.color);

        // Create simple bar chart showing target portfolio sizes
        const portfolioSizes = validScenarios.map(s => s.targetPortfolioSize);
        
        this.portfolioDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Target Portfolio Size (4% Rule)',
                    data: portfolioSizes,
                    backgroundColor: scenarioColors.map(color => color + 'CC'),
                    borderColor: scenarioColors,
                    borderWidth: 2,
                    barThickness: 60
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#7FB069',
                        borderWidth: 1,
                        titleColor: '#7FB069',
                        bodyColor: '#7FB069',
                        titleFont: {
                            family: fonts.primary
                        },
                        bodyFont: {
                            family: fonts.primary
                        },
                        callbacks: {
                            label: function(context) {
                                const scenario = validScenarios[context.dataIndex];
                                return [
                                    `Target Portfolio: $${Math.round(context.parsed.y).toLocaleString()}`,
                                    `4% Withdrawal: $${Math.round(scenario.inflatedTargetIncome).toLocaleString()}/year`,
                                    `Savings Rate: ${Math.round(scenario.savingsRate * 100)}%`,
                                    `Monthly Contribution: $${Math.round(scenario.monthlyContribution).toLocaleString()}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            callback: function(value) {
                                if (value === 0) return '$0';
                                if (value >= 1000000) {
                                    return '$' + (value / 1000000).toFixed(1) + 'M';
                                } else if (value >= 1000) {
                                    return '$' + (value / 1000).toFixed(0) + 'k';
                                }
                                return '$' + value.toFixed(0);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Portfolio Value at Retirement',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    }
                }
            }
        });
    }


    updateSavingsVsRetirementChart() {
        const params = this.collectEnhancedParameters();

        // Calculate age ranges outside cache function for chart configuration
        const minRetireAge = Math.max(params.startingAge + 5, 30);
        const maxRetireAge = 70;

        // Use cached data for expensive calculation
        const data = this.getCachedChartData('savingsVsRetirement', () => {
                const chartData = [];
            
            for (let retireAge = minRetireAge; retireAge <= maxRetireAge; retireAge += 2) {
                try {
                    // Calculate what savings rate would be needed to retire at this age
                    const scenario = FinancialCalculations.calculateScenario({
                        startingAge: params.startingAge,
                        retirementAge: retireAge,
                        targetIncome: params.targetIncome,
                        startingBalance: params.startingBalance,
                        inflationRate: params.inflationRate / 100,
                        annualReturn: params.accumulationReturn / 100
                    });
                    
                    if (scenario.valid && scenario.annualContribution > 0) {
                        const savingsRatePercent = (scenario.annualContribution / params.currentIncome) * 100;
                        const monthlySavings = scenario.monthlyContribution;
                        
                        // Only include reasonable savings rates (up to 80%)
                        if (savingsRatePercent <= 80 && savingsRatePercent >= 0) {
                            chartData.push({
                                x: retireAge,
                                y: savingsRatePercent,
                                monthlySavings: monthlySavings
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Error calculating for retirement age ${retireAge}:`, error);
                }
            }
            
            return chartData;
        });

        // Calculate actual data range for dynamic x-axis
        let dataMinAge = Infinity;
        let dataMaxAge = -Infinity;
        
        if (data.length > 0) {
            data.forEach(point => {
                dataMinAge = Math.min(dataMinAge, point.x);
                dataMaxAge = Math.max(dataMaxAge, point.x);
            });
            
            // Add small padding (2 years on each side)
            dataMinAge = Math.max(minRetireAge, dataMinAge - 2);
            dataMaxAge = Math.min(maxRetireAge, dataMaxAge + 2);
        } else {
            // Fallback if no data
            dataMinAge = minRetireAge;
            dataMaxAge = maxRetireAge;
        }

        // Destroy existing chart if it exists
        if (this.savingsVsRetirementChart) {
            this.savingsVsRetirementChart.destroy();
        }

        const ctx = document.getElementById('savingsVsRetirementChart')?.getContext('2d');
        if (!ctx) return;

        // Use theme-aware chart configuration if available
        if (typeof ChartThemes !== 'undefined') {
            try {
                const chartData = {
                    scenarios: data.map((point, index) => ({
                        scenario: index + 1,
                        savingsRate: point.y,
                        retirementAge: point.x
                    }))
                };
                const config = ChartThemes.createSavingsVsRetirementChart(chartData, );
                this.savingsVsRetirementChart = new Chart(ctx, config);
                return;
            } catch (error) {
                console.warn('Failed to use theme-aware savings chart, falling back to default:', error);
            }
        }
        
        // Fallback to original configuration
        this.savingsVsRetirementChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Required Savings Rate',
                    data: data,
                    borderColor: '#FFB86C', // Orange accent color
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#FFB86C',
                    tension: 0.1,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#7FB069',
                        borderWidth: 1,
                        titleColor: '#7FB069',
                        bodyColor: '#7FB069',
                        titleFont: {
                            family: fonts.primary
                        },
                        bodyFont: {
                            family: fonts.primary
                        },
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return [
                                    `Savings Rate: ${Math.round(context.parsed.y)}%`,
                                    `Monthly: $${Math.round(point.monthlySavings).toLocaleString()}`,
                                    `Retire at: ${context.parsed.x} years`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: dataMinAge,
                        max: dataMaxAge,
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Retirement Age',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: '#7FB06920',
                            borderColor: '#7FB069'
                        },
                        ticks: {
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value) + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Required Savings Rate',
                            color: '#7FB069',
                            font: {
                                family: fonts.primary
                            }
                        }
                    }
                }
            }
        });
    }
}

// Global functions for UI interactions
function toggleAssumptions() {
    const section = document.getElementById('assumptionsSection');
    const toggle = document.getElementById('assumptionsToggle');
    
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        // Set collapse text
        toggle.textContent = '(Collapse)';
    } else {
        section.classList.add('hidden');
        // Set expand text
        toggle.textContent = '(Expand)';
    }
}


// Initialize calculator when page loads
document.addEventListener('DOMContentLoaded', () => {
    const logger = window.calculatorErrorLogger;
    
    // Define required dependencies
    const requiredDependencies = [
        'FinancialCalculations',
        'SavingsFeasibility', 
        'URLStateManager',
        'MonteCarloEngine',
        'FinancialModeling',
        'StatisticalAnalysis',
        'InsightsEngine',
        'ExportUtility',
        'ChartThemes',
        'ThemeConfig'
    ];
    
    // Optional dependencies
    const optionalDependencies = [
        'Chart',
        'ChartZoom'
    ];
    
    let checkCount = 0;
    const maxChecks = 50; // 5 seconds timeout
    
    // Enhanced dependency checker with logging
    const checkDependencies = () => {
        checkCount++;
        
        // Log check attempt
        if (checkCount === 1) {
            logger.logSuccess('Starting dependency checks', { 
                required: requiredDependencies,
                optional: optionalDependencies 
            });
        }
        
        // Check required dependencies
        const dependencyCheck = logger.checkDependencies(requiredDependencies);
        
        if (!dependencyCheck.allLoaded) {
            if (checkCount >= maxChecks) {
                // Timeout - log error and show in UI
                logger.logError({
                    type: 'DEPENDENCY_TIMEOUT',
                    message: `Failed to load required dependencies after ${maxChecks/10} seconds`,
                    missing: dependencyCheck.missing,
                    timestamp: new Date().toISOString()
                });
                
                // Attempt graceful degradation
                initializeBasicCalculator(dependencyCheck.missing);
                return;
            }
            
            // Log waiting status periodically
            if (checkCount % 10 === 0) {
                logger.logWarning({
                    message: `Still waiting for dependencies after ${checkCount/10}s`,
                    missing: dependencyCheck.missing
                });
            }
            
            setTimeout(checkDependencies, 100);
            return;
        }
        
        // All required dependencies loaded
        logger.logSuccess('All required dependencies loaded', {
            loadTime: `${checkCount/10}s`
        });
        
        // Check optional dependencies
        optionalDependencies.forEach(dep => {
            if (window[dep]) {
                logger.trackDependency(dep, 'loaded');
            } else {
                logger.trackDependency(dep, 'missing', { note: 'Optional dependency' });
            }
        });
        
        // Register Chart.js zoom plugin if available
        if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
            Chart.register(ChartZoom);
            logger.logSuccess('Chart.js zoom plugin registered');
        }
        
        // Initialize calculator with error handling
        try {
            logger.trackInitialization('RetirementCalculator', 'starting');
            const calculator = new RetirementCalculator();
            logger.trackInitialization('RetirementCalculator', 'initialized');
            
            // Expose calculator instance for debugging
            if (logger.debugMode) {
                window.retirementCalculatorInstance = calculator;
            }
        } catch (error) {
            logger.logError({
                type: 'INITIALIZATION_FAILED',
                message: `Failed to initialize RetirementCalculator: ${error.message}`,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        }
    };
    
    /**
     * Initialize basic calculator with graceful degradation
     */
    function initializeBasicCalculator(missingDependencies) {
        logger.logWarning({
            message: 'Initializing basic calculator mode',
            missing: missingDependencies
        });
        
        // Show degraded mode warning
        const calculator = document.querySelector('.retirement-calculator');
        if (calculator) {
            const warningBanner = document.createElement('div');
            warningBanner.className = 'bg-yellow-900 border border-yellow-400 text-yellow-200 p-4 mb-4 rounded';
            warningBanner.innerHTML = `
                <div class="flex items-center">
                    <span class="mr-2">⚠️</span>
                    <div>
                        <div class="font-bold">Basic Mode Active</div>
                        <div class="text-sm">Some advanced features unavailable. Basic retirement calculations still functional.</div>
                    </div>
                </div>
            `;
            calculator.insertBefore(warningBanner, calculator.firstChild);
        }
        
        // Initialize basic functionality
        try {
            // Create minimal calculator instance with fallback methods
            const basicCalculator = new BasicRetirementCalculator(missingDependencies);
            window.retirementCalculatorInstance = basicCalculator;
            
            logger.logSuccess('Basic calculator initialized successfully');
        } catch (error) {
            logger.logError({
                type: 'BASIC_INIT_FAILED',
                message: 'Failed to initialize even basic calculator',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            // Last resort - show simple error message
            if (calculator) {
                calculator.innerHTML = `
                    <div class="bg-red-900 border border-red-400 text-red-200 p-6 rounded text-center">
                        <h3 class="text-xl font-bold mb-2">⚠️ Calculator Unavailable</h3>
                        <p class="mb-4">The retirement calculator cannot load properly.</p>
                        <p class="text-sm subtitle-text">Please refresh the page or try again later.</p>
                        <button onclick="location.reload()" class="mt-4 bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Basic calculator fallback with pure JavaScript calculations
     */
    class BasicRetirementCalculator {
        constructor(missingDependencies) {
            this.missingDependencies = missingDependencies;
            this.hasCharts = !missingDependencies.includes('Chart');
            this.scenarios = [];
            this.init();
        }
        
        init() {
            this.setupBasicEventListeners();
            this.disableAdvancedFeatures();
            this.updateAll();
        }
        
        setupBasicEventListeners() {
            // Basic input listeners for core functionality
            const inputs = document.querySelectorAll('.retirement-calculator input, .retirement-calculator select');
            inputs.forEach(input => {
                input.addEventListener('input', () => this.updateAll());
            });
        }
        
        disableAdvancedFeatures() {
            // Disable features that require missing dependencies
            if (this.missingDependencies.includes('Chart')) {
                const chartContainers = document.querySelectorAll('.chart-container');
                chartContainers.forEach(container => {
                    container.innerHTML = `
                        <div class="flex items-center justify-center h-full subtitle-text">
                            <div class="text-center">
                                <div class="text-lg mb-2">📊</div>
                                <div class="text-sm">Chart unavailable in basic mode</div>
                            </div>
                        </div>
                    `;
                });
            }
            
            if (this.missingDependencies.includes('MonteCarloEngine')) {
                // Hide Monte Carlo related insights
                const insights = document.getElementById('insightsContent');
                if (insights) {
                    insights.innerHTML = `
                        <div class="modern-insight col-span-full">
                            <div class="modern-insight-title">${this.getThemeText('BASIC_MODE_ACTIVE')}</div>
                            <div class="modern-insight-text">Advanced Monte Carlo analysis unavailable. Showing simplified calculations only.</div>
                        </div>
                    `;
                }
            }
        }
        
        updateAll() {
            try {
                this.calculateBasicScenarios();
                this.updateResultsTable();
                this.updateBasicInsights();
            } catch (error) {
                console.error('Error in basic calculator update:', error);
            }
        }
        
        calculateBasicScenarios() {
            // Simple compound interest calculations
            const params = this.collectBasicParameters();
            
            this.scenarios = [
                this.calculateBasicScenario(params, 'Conservative', params.startingAge + 40),
                this.calculateBasicScenario(params, 'Moderate', params.startingAge + 35),  
                this.calculateBasicScenario(params, 'Aggressive', params.startingAge + 30)
            ].filter(s => s.valid);
        }
        
        calculateBasicScenario(params, label, retirementAge) {
            const workingYears = retirementAge - params.startingAge;
            const requiredPortfolio = params.targetIncome / 0.04; // 4% rule
            const inflatedRequired = requiredPortfolio * Math.pow(1 + params.inflationRate/100, workingYears);
            const futureValue = params.startingBalance * Math.pow(1 + params.returnRate/100, workingYears);
            const requiredSavings = inflatedRequired - futureValue;
            const annualContribution = requiredSavings / (((Math.pow(1 + params.returnRate/100, workingYears) - 1) / (params.returnRate/100)));
            const monthlyContribution = annualContribution / 12;
            const savingsRate = annualContribution / params.currentIncome;
            
            return {
                label,
                retirementAge,
                monthlyContribution: monthlyContribution, // Allow negative for Coast FIRE
                annualContribution: annualContribution, // Allow negative for Coast FIRE
                savingsRate: savingsRate, // Allow negative for Coast FIRE
                targetPortfolioSize: inflatedRequired,
                valid: savingsRate <= 0.8 && workingYears >= 5, // Remove lower bound for Coast FIRE
                realismScore: savingsRate <= 0 ? 100 : savingsRate <= 0.5 ? 85 : savingsRate <= 0.7 ? 60 : 30, // Coast FIRE gets 100% score
                color: label === 'Conservative' ? '#4CAF50' : label === 'Moderate' ? '#FF9800' : '#e74c3c' // Theme-appropriate red
            };
        }
        
        collectBasicParameters() {
            return {
                startingAge: parseInt(document.getElementById('startingAge')?.value) || 25,
                targetIncome: this.parseCurrency(document.getElementById('targetIncome')?.value) || 120000,
                startingBalance: this.parseCurrency(document.getElementById('startingBalance')?.value) || 100000,
                currentIncome: this.parseCurrency(document.getElementById('currentIncome')?.value) || 80000,
                returnRate: parseFloat(document.getElementById('accumulationReturn')?.value) || 8,
                inflationRate: parseFloat(document.getElementById('inflationRate')?.value) || 3
            };
        }
        
        parseCurrency(value) {
            if (!value) return 0;
            return parseFloat(value.toString().replace(/[,$]/g, '')) || 0;
        }
        
        updateResultsTable() {
            const tbody = document.getElementById('summaryTableBody');
            if (!tbody) return;
            
            tbody.innerHTML = this.scenarios.map(scenario => `
                <tr class="border-b border-sage-green">
                    <td class="py-2 px-3 lg:px-4">${scenario.label}</td>
                    <td class="py-2 px-3 lg:px-4">${Math.round(scenario.savingsRate * 100)}%</td>
                    <td class="py-2 px-3 lg:px-4">${scenario.retirementAge}</td>
                    <td class="py-2 px-3 lg:px-4">${scenario.realismScore}%</td>
                    <td class="py-2 px-3 lg:px-4">${scenario.valid ? 'Viable' : 'Too High'}</td>
                </tr>
            `).join('');
        }
        
        updateBasicInsights() {
            const container = document.getElementById('insightsContent');
            if (!container) return;
            
            const validScenarios = this.scenarios.filter(s => s.valid);
            if (validScenarios.length === 0) return;
            
            const earliest = validScenarios[validScenarios.length - 1]; // Most aggressive
            
            container.innerHTML = `
                <div class="modern-insight">
                    <div class="modern-insight-title">${this.getThemeText('EARLIEST_RETIREMENT')}</div>
                    <div class="modern-insight-value">${earliest.retirementAge} years</div>
                    <div class="modern-insight-text">Earliest possible retirement with ${Math.round(earliest.savingsRate * 100)}% savings rate</div>
                </div>
                <div class="modern-insight">
                    <div class="modern-insight-title">${this.getThemeText('MONTHLY_SAVINGS')}</div>
                    <div class="modern-insight-value">$${Math.round(earliest.monthlyContribution).toLocaleString()}</div>
                    <div class="modern-insight-text">Required monthly contribution for earliest retirement</div>
                </div>
                <div class="modern-insight">
                    <div class="modern-insight-title">${this.getThemeText('BASIC_MODE')}</div>
                    <div class="modern-insight-value">Simplified</div>
                    <div class="modern-insight-text">Advanced Monte Carlo analysis unavailable. Results are estimates.</div>
                </div>
            `;
        }
    }

    checkDependencies();
});