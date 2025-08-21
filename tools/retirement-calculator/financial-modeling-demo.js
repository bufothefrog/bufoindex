/**
 * Financial Modeling Integration Demo
 * Demonstrates how the new financial modeling capabilities integrate
 * with the existing retirement calculator
 */

// Demo function to show tax-adjusted retirement scenarios
function demonstrateFinancialModeling() {
    console.log("=== Financial Modeling Integration Demo ===");
    
    // Test parameters
    const scenarioConfigs = [
        { retirementAge: 55 },
        { retirementAge: 62 },
        { retirementAge: 67 }
    ];

    const assumptions = {
        startingAge: 30,
        startingBalance: 200000,
        targetIncome: 100000,
        inflationRate: 3,
        accumulationReturn: 8,
        retirementReturn: 6,
        volatility: 15,
        monteCarloRuns: 500
    };

    const taxParameters = {
        accountType: 'Traditional 401k/IRA',
        state: 'California',
        filingStatus: 'Single',
        currentAge: 30,
        currentIncome: 120000,
        expectedSsBenefit: 2500,
        healthcareMultiplier: 1.2,
        lifeExpectancy: 85,
        currentTaxRate: 24,
        retirementTaxRate: 18,
        healthcareInflation: 5
    };

    console.log("\n1. Basic Tax Calculations:");
    
    // Test individual tax calculations
    const traditionalTax = FinancialModeling.calculateTaxAdjustedWithdrawal(
        100000, 'Traditional 401k/IRA', 'California', 65, 'Single'
    );
    console.log(`Traditional 401k withdrawal of $100,000:`);
    console.log(`  - Federal Tax: $${traditionalTax.federalTax.toLocaleString()}`);
    console.log(`  - State Tax: $${traditionalTax.stateTax.toLocaleString()}`);
    console.log(`  - Net Income: $${traditionalTax.netIncome.toLocaleString()}`);
    console.log(`  - Effective Rate: ${(traditionalTax.effectiveRate * 100).toFixed(1)}%`);

    const rothTax = FinancialModeling.calculateTaxAdjustedWithdrawal(
        100000, 'Roth', 'California', 65, 'Single'
    );
    console.log(`\nRoth withdrawal of $100,000:`);
    console.log(`  - Total Tax: $${rothTax.totalTax.toLocaleString()}`);
    console.log(`  - Net Income: $${rothTax.netIncome.toLocaleString()}`);

    console.log("\n2. Social Security Optimization:");
    
    const ssOptimization = FinancialModeling.optimizeSocialSecurity(30, 62, 2500, 85);
    console.log(`Optimal claiming strategy:`);
    console.log(`  - Optimal Age: ${ssOptimization.optimal.claimingAge}`);
    console.log(`  - Monthly Benefit: $${ssOptimization.optimal.monthlyBenefit.toLocaleString()}`);
    console.log(`  - Lifetime Value: $${ssOptimization.optimal.lifetimeValue.toLocaleString()}`);
    console.log(`  - Recommendation: ${ssOptimization.recommendation}`);

    console.log("\n3. Healthcare Cost Projections:");
    
    const healthcareCosts = FinancialModeling.calculateHealthcareCosts(62, null, 1.2, 0.05, 23);
    console.log(`Healthcare costs from age 62-85:`);
    console.log(`  - Average Annual: $${healthcareCosts.averageAnnualCost.toLocaleString()}`);
    console.log(`  - Total Lifetime: $${healthcareCosts.totalCumulativeCost.toLocaleString()}`);
    console.log(`  - Final Year: $${healthcareCosts.finalYearCost.toLocaleString()}`);

    console.log("\n4. Account Type Optimization:");
    
    const accountOptimization = FinancialModeling.determineOptimalAccountType(120000, 0.18, 0.24, 25);
    console.log(`Account type recommendation:`);
    console.log(`  - Recommended: ${accountOptimization.recommendedType}`);
    console.log(`  - Tax Savings: $${accountOptimization.taxSavings.toLocaleString()}`);
    console.log(`  - Strategy: ${accountOptimization.strategy}`);

    console.log("\n5. Integrated Scenario Analysis:");
    
    // This would be called from the main calculator with tax parameters
    const integratedResults = FinancialCalculations.calculateScenariosWithMonteCarlo(
        scenarioConfigs,
        assumptions,
        taxParameters
    );

    console.log(`Scenarios with advanced financial modeling:`);
    
    if (integratedResults.taxPlanning) {
        console.log(`\nTax-Adjusted Withdrawals:`);
        integratedResults.taxPlanning.forEach(scenario => {
            console.log(`  Scenario ${scenario.scenario} (retire at ${scenario.retirementAge}):`);
            console.log(`    - Gross Withdrawal: $${scenario.grossWithdrawal.toLocaleString()}`);
            console.log(`    - Net Withdrawal: $${scenario.netWithdrawal.toLocaleString()}`);
            console.log(`    - Total Tax: $${scenario.totalTax.toLocaleString()}`);
            console.log(`    - Effective Rate: ${(scenario.effectiveTaxRate * 100).toFixed(1)}%`);
        });
    }

    if (integratedResults.socialSecurity) {
        console.log(`\nSocial Security Optimization:`);
        integratedResults.socialSecurity.forEach(scenario => {
            console.log(`  Scenario ${scenario.scenario}:`);
            console.log(`    - Optimal Claiming Age: ${scenario.optimalClaimingAge}`);
            console.log(`    - Annual Benefit: $${scenario.optimalAnnualBenefit.toLocaleString()}`);
        });
    }

    if (integratedResults.healthcareCosts) {
        console.log(`\nHealthcare Cost Projections:`);
        integratedResults.healthcareCosts.forEach(scenario => {
            console.log(`  Scenario ${scenario.scenario}:`);
            console.log(`    - Average Annual: $${scenario.averageAnnualCost.toLocaleString()}`);
            console.log(`    - Lifetime Total: $${scenario.totalLifetimeCost.toLocaleString()}`);
        });
    }

    console.log("\n6. Real-World Example:");
    console.log("A 30-year-old with $200k saved wanting to retire early would see:");
    console.log("- Scenario A (retire at 55): High savings needed, but tax-efficient withdrawals possible");
    console.log("- Social Security: Delay claiming until 67+ for maximum lifetime value");
    console.log("- Healthcare: Budget $400k+ for lifetime healthcare costs");
    console.log("- Account Strategy: Use Traditional 401k now (high tax bracket), consider Roth conversions in early retirement");

    return integratedResults;
}

// Export the demo function for testing
if (typeof window !== 'undefined') {
    window.demonstrateFinancialModeling = demonstrateFinancialModeling;
}

// Export for Node.js if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { demonstrateFinancialModeling };
}