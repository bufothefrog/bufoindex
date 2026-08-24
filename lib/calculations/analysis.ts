import { PaycheckProfile, SkippedItem } from '../types';
import { formatCurrency, formatPercent, calculateOpportunityCost } from './core';
import { calculateIncomeTaxRate } from '../utils';

/**
 * Identify optimization opportunities and surface deprioritized items
 */
export function identifySkippedOptimizations(profile: PaycheckProfile): SkippedItem[] {
  const skippedItems: SkippedItem[] = [];
  
  // Check emergency fund optimization
  const emergencyFundOptimization = analyzeEmergencyFund(profile);
  if (emergencyFundOptimization) {
    skippedItems.push(emergencyFundOptimization);
  }
  
  // Check Roth vs Traditional strategy
  const rothTraditionalOptimization = analyzeRothVsTraditionalStrategy(profile);
  if (rothTraditionalOptimization) {
    skippedItems.push(rothTraditionalOptimization);
  }
  
  // Check debt strategy optimization
  const debtOptimizations = analyzeDebtStrategy(profile);
  skippedItems.push(...debtOptimizations);
  
  // Check low-interest debt prepayment strategy
  const lowInterestDebtOptimization = analyzeLowInterestDebtStrategy(profile);
  if (lowInterestDebtOptimization) {
    skippedItems.push(lowInterestDebtOptimization);
  }
  
  // Check for missed employer benefits
  const missedBenefits = analyzeMissedBenefits(profile);
  if (missedBenefits) {
    skippedItems.push(missedBenefits);
  }
  
  return skippedItems;
}

/** Long-run return this module assumes for invested dollars. */
const ASSUMED_MARKET_RETURN = 0.07;

/** Months of expenses this module treats as the top of the cash range. */
const CASH_MONTHS_CAP = 3;

const MARKET_LABEL = `${(ASSUMED_MARKET_RETURN * 100).toFixed(0)}%`;

const apyLabel = (apy: number): string => `${(apy * 100).toFixed(1)}%`;

/**
 * Cost of holding a balance in cash at `apy` instead of investing it at the
 * assumed market return.
 *
 * A cash yield at or above that assumption carries no opportunity cost, so the
 * figures floor at 0 rather than reporting the negative spread as a "cost";
 * `meetsMarket` lets the copy say why instead of quoting a $0 (or negative)
 * dollar figure.
 */
interface CashHoldingCost {
  monthly: number;
  annual: number;
  tenYear: number;
  /** The cash yield meets or exceeds the assumed market return. */
  meetsMarket: boolean;
}

function cashHoldingCost(amount: number, apy: number): CashHoldingCost {
  const spread = ASSUMED_MARKET_RETURN - apy;
  if (spread <= 0 || !(amount > 0)) {
    return { monthly: 0, annual: 0, tenYear: 0, meetsMarket: spread <= 0 };
  }

  const annual = amount * spread;
  return {
    monthly: annual / 12,
    annual,
    tenYear: calculateCompoundOpportunityCost(amount, apy, ASSUMED_MARKET_RETURN, 10),
    meetsMarket: false,
  };
}

/**
 * Education copy for a cash-holding comparison. The dollar framing appears only
 * when a dollar cost was actually computed, so no card ever claims a "$0
 * opportunity cost".
 */
function cashHoldingEducation(subject: string, apy: number, cost: CashHoldingCost): string {
  if (cost.meetsMarket) {
    return `${subject} earns ${apyLabel(apy)} APY, at or above the ${MARKET_LABEL} this model assumes for invested dollars, so no opportunity cost is modeled here`;
  }

  return `${subject} earns ${apyLabel(apy)} APY against the ${MARKET_LABEL} assumed for invested dollars: ${formatCurrency(cost.tenYear)} over 10 years`;
}

/**
 * Analyze emergency fund with enhanced opportunity cost calculations
 */
function analyzeEmergencyFund(profile: PaycheckProfile): SkippedItem | null {
  const monthlyExpenses = profile.preferences.necessaryExpenses;
  const targetMonths = profile.preferences.emergencyFundMonths;
  const currentEmergencyFund = profile.preferences.currentEmergencyFund;
  const emergencyFundAPY = profile.preferences.emergencyFundAPY;
  const targetAmount = monthlyExpenses * targetMonths;
  // With no expense base there is no months-of-expenses figure at all — the
  // division used to yield Infinity and print it straight into the card copy,
  // so every branch below has to read as sense without a ratio.
  const monthsCovered = monthlyExpenses > 0 ? currentEmergencyFund / monthlyExpenses : null;

  // Case 1: Current emergency fund exceeds target
  if (currentEmergencyFund > targetAmount + 500) { // $500 buffer
    const excessAmount = currentEmergencyFund - targetAmount;
    const cost = cashHoldingCost(excessAmount, emergencyFundAPY);

    return {
      id: 'excessive-emergency-fund',
      item: 'Excessive Emergency Fund',
      reason:
        monthsCovered === null
          ? `You have ${formatCurrency(currentEmergencyFund)} saved and $0 of monthly necessary expenses recorded, so months of coverage cannot be computed`
          : `You have ${formatCurrency(currentEmergencyFund)} (${monthsCovered.toFixed(1)} months) but target ${targetMonths} months`,
      opportunityCost: {
        monthly: cost.monthly,
        annual: cost.annual,
        tenYear: cost.tenYear,
      },
      alternative: cost.meetsMarket
        ? `The ${formatCurrency(excessAmount)} above target already earns ${apyLabel(emergencyFundAPY)} in cash; what is left to weigh is liquidity, not return`
        : `Invest excess ${formatCurrency(excessAmount)} in taxable accounts. Keep ${targetMonths} months + Roth IRA as backup emergency fund`,
      riskLevel: targetMonths >= CASH_MONTHS_CAP ? 'low' : 'medium',
      education: cashHoldingEducation('The balance above target', emergencyFundAPY, cost),
    };
  }

  // Case 2: Target runs past the cash cap. The cost is charged on the cash the
  // profile actually holds above that cap — a target nobody has funded yet
  // costs nothing, and used to pre-empt the far more relevant zero-fund case.
  const cashCap = monthlyExpenses * CASH_MONTHS_CAP;
  const heldTowardTarget = Math.min(currentEmergencyFund, targetAmount);
  const excessHeld = Math.max(0, heldTowardTarget - cashCap);

  if (targetMonths > CASH_MONTHS_CAP && excessHeld > 0) {
    const cost = cashHoldingCost(excessHeld, emergencyFundAPY);

    return {
      id: 'large-emergency-fund-target',
      item: 'Large Emergency Fund Target',
      reason: `Under a ${targetMonths}-month target, ${formatCurrency(excessHeld)} of the ${formatCurrency(currentEmergencyFund)} saved sits beyond ${CASH_MONTHS_CAP} months of expenses`,
      opportunityCost: {
        monthly: cost.monthly,
        annual: cost.annual,
        tenYear: cost.tenYear,
      },
      alternative: cost.meetsMarket
        ? `At ${apyLabel(emergencyFundAPY)} the ${formatCurrency(excessHeld)} beyond ${CASH_MONTHS_CAP} months gives up no modeled return; the trade-off is liquidity`
        : `Keep ${CASH_MONTHS_CAP} months in cash and invest the remaining ${formatCurrency(excessHeld)}, with Roth IRA principal available as a backup`,
      riskLevel: 'low',
      education: cashHoldingEducation(
        `Cash held beyond ${CASH_MONTHS_CAP} months`,
        emergencyFundAPY,
        cost
      ),
    };
  }

  // Case 3: Emergency fund APY too low
  if (currentEmergencyFund > 1000 && emergencyFundAPY < 0.04) {
    const betterAPY = 0.04; // 4.0% HYSA
    const additionalEarnings = currentEmergencyFund * (betterAPY - emergencyFundAPY);
    
    return {
      id: 'low-emergency-fund-apy',
      item: 'Low Emergency Fund APY',
      reason: `Emergency fund earning ${(emergencyFundAPY * 100).toFixed(1)}% when high-yield savings offer 3.5-4.5%`,
      opportunityCost: {
        monthly: additionalEarnings / 12,
        annual: additionalEarnings,
        tenYear: additionalEarnings * 10, // Conservative - no compounding
      },
      alternative: `Move to high-yield savings account (Marcus, Ally, etc.) for extra ${formatCurrency(additionalEarnings)}/year`,
      riskLevel: 'low',
      education: 'Moving to HYSA is risk-free arbitrage - same safety, better returns',
    };
  }
  
  // Case 4: Zero emergency fund with conservative/moderate risk tolerance.
  // A risk note, not a priced trade-off: the costs stay at zero and the copy
  // carries no dollar framing for the card to render.
  if (monthsCovered !== null && monthsCovered < 1 && profile.preferences.riskTolerance !== 'optimizer') {
    return {
      id: 'no-emergency-fund',
      item: 'Insufficient Emergency Fund',
      reason: `${formatCurrency(currentEmergencyFund)} saved covers ${monthsCovered.toFixed(1)} months of a ${formatCurrency(monthlyExpenses)}/month expense base`,
      opportunityCost: {
        monthly: 0,
        annual: 0,
      },
      alternative: `Build 1 month of expenses first, then up to the ${CASH_MONTHS_CAP}-month cash maximum`,
      riskLevel: 'high',
      education: 'This is a risk note rather than a priced trade-off: a cash buffer is what keeps an unplanned expense from becoming high-rate debt',
    };
  }

  return null;
}

/**
 * Calculate compound opportunity cost between two investment returns
 */
function calculateCompoundOpportunityCost(
  amount: number,
  currentReturn: number,
  betterReturn: number,
  years: number
): number {
  const currentValue = amount * Math.pow(1 + currentReturn, years);
  const betterValue = amount * Math.pow(1 + betterReturn, years);
  return betterValue - currentValue;
}

/**
 * Analyze debt payment strategy for optimization opportunities
 */
function analyzeDebtStrategy(profile: PaycheckProfile): SkippedItem[] {
  const skippedItems: SkippedItem[] = [];
  
  profile.debts.forEach(debt => {
    if (debt.extraPayment > 0) {
      const effectiveRate = debt.taxDeductible 
        ? debt.interestRate * (1 - calculateIncomeTaxRate(profile.taxes.federalBracket, profile.taxes.state))
        : debt.interestRate;
      
      const expectedMarketReturn = 0.07; // Conservative market return assumption
      const riskAdjustedThreshold = 0.05; // 5% threshold for switching to investing
      
      if (effectiveRate < riskAdjustedThreshold) {
        const monthlyOpportunityCost = debt.extraPayment * ((expectedMarketReturn - effectiveRate) / 12);
        const twentyYearOpportunityCost = calculateTwentyYearDebtOpportunityCost(
          debt.extraPayment, 
          expectedMarketReturn - effectiveRate
        );
        
        skippedItems.push({
          id: `debt-strategy-${debt.id}`,
          item: `Extra ${debt.name} Payment`,
          reason: `${formatPercent(effectiveRate)} effective rate vs ${formatPercent(expectedMarketReturn)} expected market return`,
          opportunityCost: {
            monthly: monthlyOpportunityCost,
            annual: monthlyOpportunityCost * 12,
            twentyYear: twentyYearOpportunityCost,
          },
          alternative: `Pay minimum on ${debt.name}, invest extra ${formatCurrency(debt.extraPayment)}/month`,
          riskLevel: effectiveRate < 0.04 ? 'low' : 'medium',
          education: debt.taxDeductible 
            ? 'Tax-deductible debt is often better kept than paid off early, especially at low rates'
            : 'Low-rate debt allows you to leverage cheap money for potentially higher investment returns',
        });
      }
    }
  });
  
  return skippedItems;
}

/**
 * Check for missed employer benefits
 */
function analyzeMissedBenefits(profile: PaycheckProfile): SkippedItem | null {
  const benefits = profile.benefits.employer401k;
  
  if (!benefits.available) return null;
  
  const annualSalary = profile.income.gross * 12;
  const maxMatchContribution = annualSalary * benefits.matchLimit;
  const currentAnnualContribution = annualSalary * benefits.currentContribution;
  const maxEmployerMatch = maxMatchContribution * benefits.matchPercent;
  const currentEmployerMatch = currentAnnualContribution * benefits.matchPercent;
  
  const missedMatch = maxEmployerMatch - currentEmployerMatch;
  
  if (missedMatch > 100) { // Only flag if missing >$100/year
    return {
      id: 'missed-employer-match',
      item: 'Missed Employer Match',
      reason: `Not getting full employer 401k match - leaving ${formatCurrency(missedMatch)} on the table`,
      opportunityCost: {
        monthly: missedMatch / 12,
        annual: missedMatch,
        tenYear: calculateOpportunityCost(missedMatch, 10, 0, 0.07) + (missedMatch * 10), // Lost match + growth
      },
      alternative: `Increase 401k contribution from ${formatPercent(benefits.currentContribution)} to ${formatPercent(benefits.matchLimit)}`,
      riskLevel: 'low',
      education: 'An employer match is an immediate return on contributions at the match rate; most allocation orderings place it ahead of unmatched investing',
    };
  }
  
  return null;
}

/**
 * Calculate opportunity cost of extra debt payments over 20 years
 */
function calculateTwentyYearDebtOpportunityCost(
  monthlyExtra: number, 
  returnDifferential: number
): number {
  // Future value of investing the extra payments instead
  const monthlyRate = returnDifferential / 12;
  const months = 20 * 12;
  
  if (monthlyRate === 0) {
    return monthlyExtra * months;
  }
  
  // Future value of annuity formula
  const futureValue = monthlyExtra * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  
  // Subtract what they would have saved by paying off debt early
  const debtSavings = monthlyExtra * months; // Simplified - actual calculation would need debt balance and rate
  
  return Math.max(0, futureValue - debtSavings);
}

/**
 * Analyze investment fee impact
 */
export function analyzeInvestmentFees(
  portfolioValue: number, 
  currentFeeRatio: number
): SkippedItem | null {
  const optimalFeeRatio = 0.0003; // Target ultra-low-cost index funds
  const excessFees = currentFeeRatio - optimalFeeRatio;
  
  if (excessFees > 0.002) { // Only flag if fees >0.2% excessive
    const annualExcessFees = portfolioValue * excessFees;
    const twentyYearCost = calculateOpportunityCost(annualExcessFees, 20);
    
    return {
      id: 'high-investment-fees',
      item: 'High Investment Fees',
      reason: `Paying ${formatPercent(currentFeeRatio)} vs optimal ${formatPercent(optimalFeeRatio)} fees`,
      opportunityCost: {
        monthly: annualExcessFees / 12,
        annual: annualExcessFees,
        twentyYear: twentyYearCost,
      },
      alternative: 'Switch to low-cost index funds (VTI, VTSAX) with <0.05% expense ratios',
      riskLevel: 'low',
      education: 'High fees compound against you - a 1% fee can cost 25% of your returns over 30 years',
    };
  }
  
  return null;
}

/**
 * Analyze Roth vs Traditional strategy
 */
function analyzeRothVsTraditionalStrategy(profile: PaycheckProfile): SkippedItem | null {
  const age = profile.preferences.age;
  const isPeakEarnings = profile.preferences.isPeakEarnings;
  const currentBracket = profile.taxes.federalBracket;
  const expectedRetirementBracket = profile.preferences.expectedRetirementBracket || (currentBracket * 0.8);
  
  // Case 1: High earner in peak years choosing Roth
  if (isPeakEarnings && currentBracket >= 0.24 && currentBracket > expectedRetirementBracket) {
    const annualContribution = 7000; // IRA limit
    const currentTaxSavings = annualContribution * currentBracket;
    const investedTaxSavings = currentTaxSavings * Math.pow(1.07, 10); // 10-year growth
    const rothBenefit = annualContribution * Math.pow(1.07, 10) - annualContribution; // Tax-free growth

    if (investedTaxSavings > rothBenefit * 0.8) { // Allow some buffer
      return {
        id: 'roth-vs-traditional',
        item: 'Roth vs Traditional Strategy',
        reason: `Peak earnings + ${(currentBracket * 100).toFixed(0)}% bracket: Traditional may beat Roth`,
        opportunityCost: {
          monthly: currentTaxSavings * 0.07 / 12, // Tax savings invested monthly
          annual: currentTaxSavings * 0.07, // Tax savings invested annually
          tenYear: investedTaxSavings - rothBenefit,
        },
        alternative: `Traditional IRA/401k saves ${formatCurrency(currentTaxSavings)}/year in taxes to invest now`,
        riskLevel: 'low',
        education: `Peak earners often benefit from tax deferral: save ${(currentBracket * 100).toFixed(0)}% now, pay ${(expectedRetirementBracket * 100).toFixed(0)}% later`,
      };
    }
  }
  
  // Case 2: Young person not in peak earnings choosing Traditional.
  // The size of the Roth-vs-Traditional gap depends on a retirement bracket
  // decades out, so no dollar figure is modeled here; the item carries zero
  // costs and no dollar framing rather than the flat $15,000 estimate it used
  // to report for every profile that reached this branch.
  if (age < 30 && !isPeakEarnings && currentBracket <= 0.12) {
    return {
      id: 'traditional-vs-roth',
      item: 'Traditional vs Roth Strategy',
      reason: `Age ${age}, not peak earnings, ${(currentBracket * 100).toFixed(0)}% bracket: contributions are deducted at a low rate today`,
      opportunityCost: {
        monthly: 0,
        annual: 0,
      },
      alternative: `Roth contributions are taxed at today's ${(currentBracket * 100).toFixed(0)}% and grow tax-free; Traditional defers the tax to whatever bracket applies at withdrawal`,
      riskLevel: 'low',
      education: `The comparison turns on today's ${(currentBracket * 100).toFixed(0)}% bracket versus the bracket at withdrawal, and on how long the balance compounds — no dollar difference is modeled here`,
    };
  }
  
  return null;
}

/**
 * Analyze low-interest debt prepayment strategy  
 */
function analyzeLowInterestDebtStrategy(profile: PaycheckProfile): SkippedItem | null {
  // Find low-interest debt (under 7%) that user might be paying extra on
  const lowInterestDebt = profile.debts.filter(debt => {
    const isLowInterest = debt.interestRate <= 0.07;
    const isPayingExtra = debt.extraPayment > 0;
    
    return isLowInterest && isPayingExtra;
  });
  
  if (lowInterestDebt.length === 0) return null;
  
  const debt = lowInterestDebt[0]; // Focus on first one
  const extraPayment = debt.extraPayment;
  const arbitrageReturn = ASSUMED_MARKET_RETURN - debt.interestRate;

  const tenYearOpportunityCost = calculateCompoundOpportunityCost(
    extraPayment * 12, // Annual extra payment
    debt.interestRate,
    ASSUMED_MARKET_RETURN,
    10
  );

  // `extraPayment` is a monthly figure, so the annual stream is 12x it and the
  // monthly cost is exactly one twelfth of the annual one. Dividing by 12 a
  // second time understated the monthly line by a factor of 12.
  const annualCost = extraPayment * 12 * arbitrageReturn;

  return {
    id: 'low-interest-debt-prepayment',
    item: 'Low-Interest Debt Prepayment',
    reason: `Paying extra on ${(debt.interestRate * 100).toFixed(1)}% debt instead of investing`,
    opportunityCost: {
      monthly: annualCost / 12,
      annual: annualCost,
      tenYear: tenYearOpportunityCost,
    },
    alternative: `Invest extra ${formatCurrency(extraPayment)}/month instead. Modeled spread: ${(arbitrageReturn * 100).toFixed(1)}%/year`,
    riskLevel: 'medium',
    education:
      arbitrageReturn > 0
        ? `Prepaying returns the debt's ${(debt.interestRate * 100).toFixed(1)}% with certainty; investing is modeled at ${MARKET_LABEL}, a ${formatCurrency(tenYearOpportunityCost)} difference over 10 years on this payment stream.`
        : `Prepaying returns the debt's ${(debt.interestRate * 100).toFixed(1)}%, the same rate this model assumes for invested dollars, so no dollar difference is modeled — and the debt payoff is the certain side of that comparison.`,
  };
}