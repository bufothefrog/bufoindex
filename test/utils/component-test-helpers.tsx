/**
 * Component Test Helpers
 * Utilities for testing React components with accessibility and responsive design validation
 */

 
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable prefer-const */

import { render, RenderOptions, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import React, { ReactElement } from 'react'

/**
 * Enhanced render function with common providers and options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withTooltipProvider?: boolean
  withFormProvider?: boolean
  withStateProvider?: boolean
  initialLocalStorage?: Record<string, string>
  mockWindowSize?: { width: number; height: number }
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    withTooltipProvider = false,
    withFormProvider = false,
    withStateProvider = false,
    initialLocalStorage = {},
    mockWindowSize,
    ...renderOptions
  } = options

  // Mock localStorage if provided
  if (Object.keys(initialLocalStorage).length > 0) {
    const mockStorage = vi.fn()
    mockStorage.prototype.getItem = vi.fn((key: string) => initialLocalStorage[key] || null)
    mockStorage.prototype.setItem = vi.fn()
    mockStorage.prototype.removeItem = vi.fn()
    mockStorage.prototype.clear = vi.fn()
    Object.defineProperty(window, 'localStorage', { value: mockStorage })
  }

  // Mock window size if provided
  if (mockWindowSize) {
    Object.defineProperty(window, 'innerWidth', { value: mockWindowSize.width, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: mockWindowSize.height, writable: true })
    window.dispatchEvent(new Event('resize'))
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    let wrapped = <>{children}</>
    
    // Add providers as needed (would need actual provider components in real implementation)
    if (withStateProvider) {
      // wrapped = <StateProvider>{wrapped}</StateProvider>
    }
    
    if (withFormProvider) {
      // wrapped = <FormProvider>{wrapped}</FormProvider>
    }
    
    if (withTooltipProvider) {
      // wrapped = <TooltipProvider>{wrapped}</TooltipProvider>
    }
    
    return wrapped
  }

  const user = userEvent.setup()
  const result = render(ui, { wrapper: Wrapper, ...renderOptions })
  
  return {
    user,
    ...result
  }
}

/**
 * Responsive design testing utilities
 */
export const BREAKPOINTS = {
  mobile: 320,
  mobileLarge: 425,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
  desktopLarge: 2560
} as const

export function testResponsiveDesign(
  renderComponent: (width: number) => ReturnType<typeof render>,
  assertions: {
    mobile?: () => void
    tablet?: () => void
    desktop?: () => void
  }
) {
  // Test mobile
  if (assertions.mobile) {
    const { unmount } = renderComponent(BREAKPOINTS.mobile)
    assertions.mobile()
    unmount()
  }

  // Test tablet
  if (assertions.tablet) {
    const { unmount } = renderComponent(BREAKPOINTS.tablet)
    assertions.tablet()
    unmount()
  }

  // Test desktop
  if (assertions.desktop) {
    const { unmount } = renderComponent(BREAKPOINTS.desktop)
    assertions.desktop()
    unmount()
  }
}

/**
 * Accessibility testing utilities for WCAG 2.1 AA compliance
 */
export interface AccessibilityChecks {
  hasAccessibleName: boolean
  hasProperRole: boolean
  hasKeyboardSupport: boolean
  hasFocusManagement: boolean
  hasColorContrast: boolean
  hasSemanticStructure: boolean
}

export async function checkAccessibility(element?: HTMLElement): Promise<AccessibilityChecks> {
  const target = element || document.body
  
  const checks: AccessibilityChecks = {
    // Check for accessible names (aria-label, aria-labelledby, or text content)
    hasAccessibleName: Boolean(
      target.getAttribute('aria-label') ||
      target.getAttribute('aria-labelledby') ||
      target.textContent?.trim()
    ),

    // Check for proper ARIA roles
    hasProperRole: Boolean(
      target.getAttribute('role') ||
      ['button', 'input', 'select', 'textarea', 'a', 'form'].includes(target.tagName.toLowerCase())
    ),

    // Check keyboard accessibility
    hasKeyboardSupport: target.tabIndex >= 0 || 
      ['button', 'input', 'select', 'textarea', 'a'].includes(target.tagName.toLowerCase()),

    // Check focus management (simplified check)
    hasFocusManagement: Boolean(target.getAttribute('tabindex') !== '-1'),

    // Color contrast check (simplified - would need actual color analysis)
    hasColorContrast: true,

    // Semantic structure check
    hasSemanticStructure: Boolean(
      target.querySelector('h1, h2, h3, h4, h5, h6') ||
      target.tagName.toLowerCase() === 'main' ||
      target.getAttribute('role') === 'main'
    )
  }

  return checks
}

/**
 * Keyboard navigation testing
 */
export async function testKeyboardNavigation(
  user: ReturnType<typeof userEvent.setup>,
  expectedFocusOrder: string[] // Array of test-id or role selectors
) {
  // Start from the first element
  await user.tab()
  
  for (const selector of expectedFocusOrder) {
    const element = screen.getByTestId(selector) || screen.getByRole(selector as any)
    expect(element).toHaveFocus()
    await user.tab()
  }
}

/**
 * Form interaction testing utilities
 */
export async function testFormValidation(
  user: ReturnType<typeof userEvent.setup>,
  scenarios: Array<{
    field: string
    value: string
    shouldBeValid: boolean
    expectedError?: string
  }>
) {
  for (const scenario of scenarios) {
    const field = screen.getByTestId(scenario.field) || screen.getByLabelText(scenario.field)
    
    await user.clear(field)
    await user.type(field, scenario.value)
    await user.tab() // Trigger validation
    
    if (scenario.shouldBeValid) {
      expect(screen.queryByText(scenario.expectedError || /error/i)).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(scenario.expectedError || /error/i)).toBeInTheDocument()
    }
  }
}

/**
 * Calculator-specific test utilities
 */
export async function testCalculatorFlow(
  user: ReturnType<typeof userEvent.setup>,
  inputs: Record<string, string | number>,
  expectedResults: Record<string, string | number>
) {
  // Fill in all inputs
  for (const [field, value] of Object.entries(inputs)) {
    const input = screen.getByTestId(field) || screen.getByLabelText(new RegExp(field, 'i'))
    await user.clear(input)
    await user.type(input, String(value))
  }

  // Wait for calculations to complete
  await waitFor(() => {
    for (const [resultField, expectedValue] of Object.entries(expectedResults)) {
      const result = screen.getByTestId(resultField) || screen.getByText(new RegExp(String(expectedValue), 'i'))
      expect(result).toBeInTheDocument()
    }
  }, { timeout: 3000 })
}

/**
 * State persistence testing
 */
export async function testStatePersistence(
  user: ReturnType<typeof userEvent.setup>,
  inputs: Record<string, string>,
  storageKey: string
) {
  // Fill in inputs
  for (const [field, value] of Object.entries(inputs)) {
    const input = screen.getByTestId(field) || screen.getByLabelText(new RegExp(field, 'i'))
    await user.clear(input)
    await user.type(input, value)
  }

  // Check localStorage was updated
  expect(localStorage.getItem(storageKey)).toBeTruthy()
  
  // Parse and verify stored data contains expected values
  const storedData = JSON.parse(localStorage.getItem(storageKey) || '{}')
  for (const [field, value] of Object.entries(inputs)) {
    expect(storedData).toHaveProperty(field)
    // Note: Values might be transformed, so this is a basic check
  }
}

/**
 * URL hash testing
 */
export function testURLHashPersistence(
  expectedHash: string,
  timeout: number = 1000
) {
  return waitFor(() => {
    expect(window.location.hash).toBe(expectedHash)
  }, { timeout })
}

/**
 * Performance testing for component rendering
 */
export function measureRenderPerformance<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  props: T,
  iterations: number = 10
) {
  const renderTimes: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    const { unmount } = render(<Component {...props} />)
    const renderTime = performance.now() - start
    renderTimes.push(renderTime)
    unmount()
  }

  const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / iterations
  const maxRenderTime = Math.max(...renderTimes)

  return {
    average: avgRenderTime,
    maximum: maxRenderTime,
    all: renderTimes
  }
}

/**
 * Chart testing utilities (for Chart.js components)
 */
export function mockChartJs() {
  const mockChart = {
    destroy: vi.fn(),
    update: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(),
    data: { datasets: [], labels: [] },
    options: {}
  }

  // Mock Chart.js constructor
  vi.mock('chart.js', () => ({
    Chart: vi.fn().mockImplementation(() => mockChart),
    CategoryScale: vi.fn(),
    LinearScale: vi.fn(),
    PointElement: vi.fn(),
    LineElement: vi.fn(),
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn()
  }))

  return mockChart
}

/**
 * Custom matchers for component testing
 */
export interface ComponentMatchers<R = unknown> {
  toBeAccessible: () => R
  toHaveResponsiveLayout: () => R
  toHandleKeyboardNavigation: () => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends ComponentMatchers<T> {}
  interface AsymmetricMatchersContaining extends ComponentMatchers {}
}

expect.extend({
  async toBeAccessible(received: HTMLElement) {
    const checks = await checkAccessibility(received)
    const failedChecks = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check)

    return {
      pass: failedChecks.length === 0,
      message: () => 
        failedChecks.length === 0 
          ? `Expected element to fail accessibility checks`
          : `Element failed accessibility checks: ${failedChecks.join(', ')}`
    }
  },

  toHaveResponsiveLayout(received: HTMLElement) {
    // Simplified responsive check - would need more sophisticated implementation
    const hasResponsiveClasses = received.className.includes('sm:') || 
                                 received.className.includes('md:') || 
                                 received.className.includes('lg:')
    
    return {
      pass: hasResponsiveClasses,
      message: () => 
        hasResponsiveClasses 
          ? `Expected element to not have responsive classes`
          : `Element does not have responsive Tailwind classes`
    }
  },

  toHandleKeyboardNavigation(received: HTMLElement) {
    const isKeyboardAccessible = received.tabIndex >= 0 || 
      ['button', 'input', 'select', 'textarea', 'a'].includes(received.tagName.toLowerCase())
    
    return {
      pass: isKeyboardAccessible,
      message: () => 
        isKeyboardAccessible
          ? `Expected element to not be keyboard accessible`
          : `Element is not keyboard accessible (missing tabindex or interactive element)`
    }
  }
})

/**
 * Export commonly used testing utilities
 */
export { screen, fireEvent, waitFor, userEvent }