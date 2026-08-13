import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaycheckSummaryBox } from '@/components/paycheck-allocator/PaycheckSummaryBox'
import {
  createBenefitsData,
  createEmployerBenefits,
  createIncomeData,
  createPaycheckProfile,
} from '@/test/factories/test-data-factory'
import type { PaycheckProfile } from '@/lib/types'

/**
 * The breakdown derives "Taxes & Deductions" as a residual from the gross and
 * take-home the user typed. Payroll withholds EVERY employee 401k deferral —
 * traditional (pre-tax) and Roth (after-tax) — before take-home, so the
 * residual must subtract both, or the deferral is double-counted: once inside
 * an inflated "taxes" line and again as its own row.
 */
function renderExpanded(profile: PaycheckProfile) {
  render(<PaycheckSummaryBox profile={profile} />)
  fireEvent.click(screen.getByRole('button', { name: /paycheck breakdown/i }))
}

function rothProfile(): PaycheckProfile {
  // Mirrors the reported scenario: semi-monthly $3,500 gross / $2,000 net with
  // a 16% Roth deferral already set up in payroll and a full match on the
  // first 4% of salary.
  return createPaycheckProfile({
    income: createIncomeData({
      grossPaycheck: 3500,
      netPaycheck: 2000,
      frequency: 'semi-monthly',
    }),
    benefits: createBenefitsData({
      employer401k: createEmployerBenefits({
        available: true,
        contributionType: 'roth',
        currentContribution: 0.16,
        traditionalContribution: 0,
        rothContribution: 0.16,
        matchPercent: 1,
        matchLimit: 0.04,
      }),
    }),
  })
}

describe('PaycheckSummaryBox — taxes-and-deductions residual', () => {
  it('nets the Roth deferral out of the residual so the rows sum to take-home', () => {
    renderExpanded(rothProfile())

    // Roth deferral: 3,500 × 16% = $560, withheld before the typed $2,000 net.
    // Residual taxes: 3,500 − 0 (traditional) − 560 (Roth) − 2,000 = $940 —
    // NOT the $1,500 that absorbing the deferral would produce.
    expect(screen.getByText('Taxes & Deductions')).toBeInTheDocument()
    expect(screen.getByText('-$940')).toBeInTheDocument()
    expect(screen.queryByText('-$1,500')).not.toBeInTheDocument()

    // The rows shown: 3,500 − 940 − 560 = 2,000 exactly.
    expect(screen.getByText('-$560')).toBeInTheDocument()
    expect(screen.getByText('$2,000')).toBeInTheDocument()
  })

  it('reports the effective tax rate on taxes only, not on the deferral', () => {
    renderExpanded(rothProfile())

    // 940 / 3,500 taxable = 26.9%, not the 42.9% the inflated residual gave.
    expect(screen.getByText('26.9%')).toBeInTheDocument()
  })

  it('nets a traditional deferral out of the residual the same way', () => {
    const profile = createPaycheckProfile({
      income: createIncomeData({
        grossPaycheck: 3500,
        netPaycheck: 2000,
        frequency: 'semi-monthly',
      }),
      benefits: createBenefitsData({
        employer401k: createEmployerBenefits({
          available: true,
          contributionType: 'traditional',
          currentContribution: 0.1,
          traditionalContribution: 0.1,
          rothContribution: 0,
          matchPercent: 0.5,
          matchLimit: 0.06,
        }),
      }),
    })
    renderExpanded(profile)

    // Traditional deferral 3,500 × 10% = $350; residual = 3,500 − 350 − 2,000
    // = $1,150; taxable income = 3,150 → 1,150 / 3,150 = 36.5%.
    expect(screen.getByText('-$1,150')).toBeInTheDocument()
    expect(screen.getByText('36.5%')).toBeInTheDocument()
  })
})

describe('PaycheckSummaryBox — employer match tax treatment', () => {
  it('labels the match as a pre-tax employer contribution even for a Roth deferrer', () => {
    renderExpanded(rothProfile())

    // Match: min(560, 3,500 × 4%) × 100% = $140, on top of pay.
    expect(screen.getByText('+$140')).toBeInTheDocument()
    expect(
      screen.getByText(/Pre-tax employer contribution.*traditional 401k bucket even when your own deferral is Roth/)
    ).toBeInTheDocument()
  })
})
