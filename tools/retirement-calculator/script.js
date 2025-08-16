/**
 * Retirement Calculator Main Script v2.0
 * Orchestrates the terminal-style retirement planning calculator with Monte Carlo analysis
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
            console.log(`Generating chart data for: ${cacheKey}`);
            this.chartDataCache.set(fullCacheKey, generatorFunction());
        } else {
            console.log(`Using cached chart data for: ${cacheKey}`);
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

    init() {
        // Load state from URL or use defaults
        const params = URLStateManager.loadState();
        URLStateManager.applyParametersToForm(params);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize state dropdown
        this.initializeStateDropdown();
        
        // Set up automatic state saving
        URLStateManager.setupAutoSave();
        
        // Set up popstate listener for browser navigation
        URLStateManager.setupPopstateListener(() => this.updateAll());
        
        // Initialize risk profile returns
        this.updateRiskProfileReturns();
        
        // Initial calculation
        this.updateAll();
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
        
        // Set initial values to empty - user must select
        stateInput.value = '';
        hiddenSelect.value = '';
        
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
                div.className = 'px-2 py-1 cursor-pointer hover:bg-terminal-green hover:text-black transition-colors';
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
                    item.classList.add('bg-terminal-green', 'text-black');
                } else {
                    item.classList.remove('bg-terminal-green', 'text-black');
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
            
            // Calculate retirement readiness using new method
            const readinessAnalysis = FinancialCalculations.calculateRetirementReadiness({
                currentAge: params.startingAge,
                targetRetirementAge: params.targetRetirementAge,
                targetIncome: params.targetIncome,
                currentIncome: params.currentIncome,
                currentSavingsRate: params.currentSavingsRate / 100, // Convert to decimal
                startingBalance: params.startingBalance,
                state: params.state,
                riskProfile: params.riskProfile,
                inflationRate: params.inflationRate / 100
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
                    <tr class="text-terminal-green opacity-50">
                        <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
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
                <tr class="text-terminal-green">
                    <td class="py-2 px-3">SCENARIO_${scenario.label}</td>
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
            default: return 'text-terminal-green';
        }
    }

    generateConfidenceMeter(confidenceLevel) {
        const width = Math.max(10, confidenceLevel); // Minimum 10% width for visibility
        const color = confidenceLevel >= 80 ? '#00FF41' : 
                      confidenceLevel >= 60 ? '#FFB86C' : 
                      confidenceLevel >= 40 ? '#FF8C42' : '#FF6B6B';
        
        return `
            <div class="inline-flex items-center gap-1">
                <div class="w-16 h-2 bg-gray-800 border border-terminal-green">
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
                title: 'TIME_VS_MONEY_TRADEOFF',
                value: `${contributionRatio}%`,
                text: `Retiring ${timeDifference} years earlier requires ${contributionRatio}% higher monthly contributions (${this.formatCurrency(contributionDifference)} more per month).`
            });
        }

        insights.push({
            title: 'SAVINGS_RATE',
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
                title: 'RETIREMENT_GOAL_ASSESSMENT',
                value: targetRating,
                text: `Your goal to retire at ${params.targetRetirementAge} with $${this.formatCurrency(params.targetIncome)} is rated as "${targetRating}". You would need to save ${requiredRate}% of income vs your current ${currentRate}%.`
            });

            // Savings Rate Impact
            const currentScenario = this.scenarios.find(s => s.label === 'Current');
            const aggressiveScenario = this.scenarios.find(s => s.label === 'Aggressive');
            
            if (currentScenario && aggressiveScenario && currentScenario.valid && aggressiveScenario.valid) {
                const yearsSaved = currentScenario.retirementAge - aggressiveScenario.retirementAge;
                insights.push({
                    title: 'SAVINGS_RATE_IMPACT',
                    value: `${yearsSaved} years`,
                    text: `Increasing your savings rate by 20% (from ${Math.round(currentScenario.savingsRate*100)}% to ${Math.round(aggressiveScenario.savingsRate*100)}%) allows you to retire ${yearsSaved} years earlier.`
                });
            }

            // Cost of Living Impact
            const colTier = window.SavingsFeasibility.getStateCOLTier(params.state);
            const colNames = ['', 'Very High', 'High', 'Moderate', 'Low'];
            const maxSavings = Math.round(window.SavingsFeasibility.calculateMaxRealisticSavings(params.currentIncome, params.state) * 100);
            
            insights.push({
                title: 'LOCATION_IMPACT',
                value: `${maxSavings}% max`,
                text: `Living in ${params.state} (${colNames[colTier]} cost of living) limits realistic savings to approximately ${maxSavings}% of income at your income level.`
            });

            // Risk Profile Impact
            const riskData = window.SavingsFeasibility.getRiskProfile(params.riskProfile, params.startingAge);
            insights.push({
                title: 'RISK_PROFILE',
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
                        title: 'PORTFOLIO_DURABILITY',
                        value: `${successRate}% success`,
                        text: `Even if you achieve your savings goals (${Math.round(lowestSuccess.savingsRate*100)}% savings rate), your portfolio has a ${failureRate}% risk of depletion during retirement due to market volatility. This is separate from whether you can actually save that much.`
                    });
                    
                    // Add warning for high-risk scenarios
                    if (successRate < 80) {
                        insights.push({
                            title: 'MARKET_RISK_WARNING',
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
                    title: 'ACTION_REQUIRED',
                    value: `${minRequiredRate}% needed`,
                    text: `To achieve your goal, consider: 1) Increase savings rate to ${minRequiredRate}%, 2) Retire later, 3) Reduce target income, or 4) Move to lower cost area.`
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
            <div class="terminal-insight">
                <div class="terminal-insight-title">${insight.title}</div>
                <span class="terminal-insight-value">${insight.value}</span>
                <div class="terminal-insight-text">${insight.text}</div>
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
        
        // Create new chart
        const ctx = document.getElementById('netWorthChart');
        if (!ctx) return;
        
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
            borderColor: '#00FF41',
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

        // Create new chart
        const ctx = document.getElementById('withdrawalsChart').getContext('2d');
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        font: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        min: -params.targetIncome * 0.0475, // 4.75% buffer below zero (5% reduced by 5%)
                        max: maxWithdrawal * 1.045, // 4.5% buffer above max (10% reduced by 5%)
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            callback: function(value) {
                                return '$' + (Math.round(value).toLocaleString());
                            }
                        },
                        title: {
                            display: true,
                            text: 'Retirement Withdrawals',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    }
                }
            }
        });
    }


    async updateAll() {
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
        
        // Update all charts
        this.updateCharts();
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
                <div class="text-terminal-green opacity-75 text-center py-4">
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
                        <h4 class="text-terminal-green font-bold mb-3">YOUR RETIREMENT GOAL</h4>
                        <div class="space-y-2 text-sm">
                            <div><span class="opacity-75">Target Retirement Age:</span> ${params.targetRetirementAge} years old</div>
                            <div><span class="opacity-75">Target Annual Income:</span> $${this.formatCurrency(params.targetIncome)}</div>
                            <div><span class="opacity-75">Current Savings Rate:</span> ${currentRate}%</div>
                            <div><span class="opacity-75">Required Savings Rate:</span> <span class="${rateDifference > 0 ? 'text-orange-400' : 'text-green-400'}">${requiredRate}%</span></div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-terminal-green font-bold mb-3">ASSESSMENT</h4>
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
                button.style.backgroundColor = '#00FF41';
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
        const validationType = input.dataset.validation;
        const value = input.value;
        
        // Handle different DOM structures - look in parent or grandparent for error element
        let errorElement = input.parentElement.querySelector('.terminal-error');
        if (!errorElement) {
            errorElement = input.parentElement.parentElement?.querySelector('.terminal-error');
        }
        
        let isValid = true;
        let errorMessage = '';

        switch (validationType) {
            case 'currency':
                const numValue = FinancialCalculations.parseCurrency(value);
                const min = input.dataset.min ? parseFloat(input.dataset.min) : 0;
                const max = input.dataset.max ? parseFloat(input.dataset.max) : Infinity;
                
                if (numValue < min) {
                    isValid = false;
                    errorMessage = `VALUE_TOO_LOW (MIN: ${min.toLocaleString()})`;
                } else if (numValue > max) {
                    isValid = false;
                    errorMessage = `VALUE_TOO_HIGH (MAX: ${max.toLocaleString()})`;
                }
                break;
                
            case 'age':
                const age = parseInt(value);
                if (age < 18 || age > 100) {
                    isValid = false;
                    errorMessage = 'AGE_RANGE: 18-100';
                }
                break;
                
            case 'percentage':
                const pct = parseFloat(value);
                if (pct < 0 || pct > 50) {
                    isValid = false;
                    errorMessage = 'PERCENTAGE_RANGE: 0-50%';
                }
                break;
        }

        if (isValid) {
            input.classList.remove('border-red-400');
            if (errorElement) {
                errorElement.classList.add('hidden');
            }
        } else {
            input.classList.add('border-red-400');
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.classList.remove('hidden');
            }
        }

        return isValid;
    }

    /**
     * Clear validation error for input
     */
    clearValidationError(input) {
        input.classList.remove('border-red-400');
        
        // Handle different DOM structures - look in parent or grandparent for error element
        let errorElement = input.parentElement.querySelector('.terminal-error');
        if (!errorElement) {
            errorElement = input.parentElement.parentElement?.querySelector('.terminal-error');
        }
        
        if (errorElement) {
            errorElement.classList.add('hidden');
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
            monteCarloRuns: parseInt(params.monteCarloRuns || 1000)
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
                
                // Legacy compatibility
                monteCarloRuns: this.getInputValue('monteCarloRuns', 'number') || 1000,
                accountType: this.getSelectValue('accountType'),
                socialSecurityAge: this.getInputValue('socialSecurityAge', 'number') || 67,
                socialSecurityBenefit: this.getInputValue('socialSecurityBenefit', 'currency') || 2000,
                healthcareMultiplier: parseFloat(this.getSelectValue('healthcareMultiplier')) || 1.0
            };

            // Get return rates - check manual overrides first, then fall back to risk profile
            const manualAccumReturn = this.getInputValue('accumulationReturn', 'number');
            const manualRetireReturn = this.getInputValue('retirementReturn', 'number');
            
            if (manualAccumReturn && manualRetireReturn) {
                // Use manual overrides
                enhanced.accumulationReturn = manualAccumReturn;
                enhanced.retirementReturn = manualRetireReturn;
                enhanced.volatility = this.getInputValue('volatility', 'number') || 15;
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

            console.log('Collected enhanced parameters:', enhanced);
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
                monteCarloRuns: 1000,
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
            console.warn(`Element with id '${id}' not found`);
            // Return default values for missing elements
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
            console.warn(`Select element with id '${id}' not found`);
            // Return default values for missing selects
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
        
        // Add TDF allocation display if TDF is selected
        if (riskProfile === 'tdf' && riskData.details) {
            const riskProfileContainer = document.getElementById('riskProfile').parentElement;
            const tdfDisplay = document.createElement('div');
            tdfDisplay.id = 'tdfAllocationDisplay';
            tdfDisplay.className = 'text-terminal-green text-xs mt-2 p-2 bg-black border border-terminal-green rounded';
            tdfDisplay.remove();
            riskProfileContainer.appendChild(tdfDisplay);
        }
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
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Realism Score (%)',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
            console.log('Generating savings vs retirement chart data...');
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
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0A0E1A',
                        borderColor: '#00FF41',
                        borderWidth: 1,
                        titleColor: '#00FF41',
                        bodyColor: '#00FF41',
                        titleFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
                        },
                        bodyFont: {
                            family: 'IBM Plex Mono, Fira Code, monospace'
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
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Retirement Age',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: '#00FF4120',
                            borderColor: '#00FF41'
                        },
                        ticks: {
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
                            },
                            stepSize: 5,
                            callback: function(value) {
                                return Math.round(value) + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Required Savings Rate',
                            color: '#00FF41',
                            font: {
                                family: 'IBM Plex Mono, Fira Code, monospace'
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
        toggle.textContent = '[COLLAPSE]';
    } else {
        section.classList.add('hidden');
        toggle.textContent = '[EXPAND]';
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
        'ChartConfigs'
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
                
                // Show error in calculator UI
                const calculator = document.querySelector('.retirement-calculator');
                if (calculator) {
                    calculator.innerHTML = `
                        <div class="bg-red-900 border border-red-400 text-red-200 p-6 rounded">
                            <h3 class="text-xl font-bold mb-2">⚠️ Calculator Failed to Load</h3>
                            <p class="mb-2">Missing dependencies: ${dependencyCheck.missing.join(', ')}</p>
                            <p class="text-sm opacity-75">Please refresh the page or check the console for details.</p>
                        </div>
                    `;
                }
                return;
            }
            
            // Log waiting status periodically
            if (checkCount % 10 === 0) {
                console.log(`Waiting for dependencies to load... (${checkCount/10}s)`);
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
    
    checkDependencies();
});