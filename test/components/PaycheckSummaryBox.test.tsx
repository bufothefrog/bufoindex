import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
 * take-home the user typed. Payroll withholds EVERY employee 401k deferral,
 * traditional (pre-tax) and Roth (after-tax), before take-home, so the
 * residual must subtract both, or the deferral is double-counted: once inside
 * an inflated "taxes" line and again as its own row.
 */
function renderExpanded(profile: PaycheckProfile) {
  render(<PaycheckSummaryBox profile={profile} />)
  fireEvent.click(screen.getByRole('button', { name: /paycheck breakdown/i }))
}

/** The value (dd) printed for the row whose label (dt) contains `label`. */
function valueOf(label: string): string | null {
  const term = screen.getAllByRole('term').find((dt) => within(dt).queryByText(label) !== null)
  expect(term, `a row labelled ${label}`).toBeDefined()
  return within(term!.parentElement as HTMLElement).getByRole('definition').textContent
}

/** Every row label (the first text in each dt, before any subtitle), in order. */
function labels(): string[] {
  return screen.getAllByRole('term').map((dt) => {
    const walker = document.createTreeWalker(dt, NodeFilter.SHOW_TEXT)
    return walker.nextNode()?.textContent ?? ''
  })
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

describe('PaycheckSummaryBox: header', () => {
  it('names the pay frequency and shows gross to take-home while collapsed', () => {
    render(<PaycheckSummaryBox profile={rothProfile()} />)

    const toggle = screen.getByRole('button', { name: /Semi-Monthly Paycheck Breakdown/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(toggle).getByText('$3,500 \u2192 $2,000')).toBeInTheDocument()
    expect(screen.queryByRole('term')).not.toBeInTheDocument()
  })

  it('expands from the keyboard', () => {
    render(<PaycheckSummaryBox profile={rothProfile()} />)

    const toggle = screen.getByRole('button', { name: /paycheck breakdown/i })
    fireEvent.keyDown(toggle, { key: 'Enter' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(valueOf('Gross Paycheck')).toBe('$3,500')
    fireEvent.keyDown(toggle, { key: ' ' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('PaycheckSummaryBox: taxes-and-deductions residual', () => {
  it('nets the Roth deferral out of the residual so the rows sum to take-home', () => {
    renderExpanded(rothProfile())

    // Roth deferral: 3,500 x 16% = $560, withheld before the typed $2,000 net.
    // Residual taxes: 3,500 - 0 (traditional) - 560 (Roth) - 2,000 = $940,
    // NOT the $1,500 that absorbing the deferral would produce.
    expect(valueOf('Taxes & Deductions')).toBe('-$940')
    expect(screen.queryByText('-$1,500')).not.toBeInTheDocument()

    // The rows shown: 3,500 - 940 - 560 = 2,000 exactly.
    expect(valueOf('Roth 401k')).toBe('-$560')
    expect(valueOf('Take-Home Pay')).toBe('$2,000')
    expect(screen.getByText('16.0% contribution (after-tax)')).toBeInTheDocument()
    // No traditional deferral, so no traditional row.
    expect(labels()).toEqual([
      'Gross Paycheck',
      'Taxes & Deductions',
      'Roth 401k',
      'Take-Home Pay',
      'Employer 401k Match',
      'Monthly equivalent',
      'Effective tax rate',
    ])
  })

  it('reports the effective tax rate on taxes only, not on the deferral', () => {
    renderExpanded(rothProfile())

    // 940 / 3,500 taxable = 26.9%, not the 42.9% the inflated residual gave.
    expect(valueOf('Effective tax rate')).toBe('26.9%')
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

    // Traditional deferral 3,500 x 10% = $350; residual = 3,500 - 350 - 2,000
    // = $1,150; taxable income = 3,150 -> 1,150 / 3,150 = 36.5%.
    expect(valueOf('Traditional 401k')).toBe('-$350')
    expect(screen.getByText('10.0% contribution (pre-tax)')).toBeInTheDocument()
    expect(valueOf('Taxes & Deductions')).toBe('-$1,150')
    expect(valueOf('Effective tax rate')).toBe('36.5%')
  })

  it('shows the monthly equivalents', () => {
    renderExpanded(rothProfile())

    // The factory's monthly figures.
    expect(valueOf('Monthly equivalent')).toBe('Gross: $6,500 | Net: $4,500')
  })
})

describe('PaycheckSummaryBox: employer match tax treatment', () => {
  it('labels the match as a pre-tax employer contribution even for a Roth deferrer', () => {
    renderExpanded(rothProfile())

    // Match: min(560, 3,500 x 4%) x 100% = $140, on top of pay.
    expect(valueOf('Employer 401k Match')).toBe('+$140')
    expect(
      screen.getByText(/Pre-tax employer contribution.*traditional 401k bucket even when your own deferral is Roth/)
    ).toBeInTheDocument()
  })

  it('leaves out the deferral and match rows without a plan', () => {
    const profile = createPaycheckProfile({
      income: createIncomeData({ grossPaycheck: 3000, netPaycheck: 2250 }),
      benefits: createBenefitsData({ employer401k: createEmployerBenefits({ available: false }) }),
    })
    renderExpanded(profile)

    expect(labels()).toEqual([
      'Gross Paycheck',
      'Taxes & Deductions',
      'Take-Home Pay',
      'Monthly equivalent',
      'Effective tax rate',
    ])
    expect(valueOf('Taxes & Deductions')).toBe('-$750')
    expect(valueOf('Effective tax rate')).toBe('25.0%')
  })
})
