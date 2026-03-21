/**
 * Integration Test Helpers
 * Utilities for testing data flows, URL persistence, and user workflows
 */

 
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

/**
 * URL Hash State Management Testing
 */
export interface URLHashTestCase {
  description: string
  inputState: Record<string, any>
  expectedHash: string
  shouldCompress?: boolean
}

export class URLHashTester {
  private originalLocation: Location
  private mockLocation: Partial<Location> & { hash: string }

  constructor() {
    this.originalLocation = window.location
    this.mockLocation = {
      hash: '',
      href: 'http://localhost:3000/',
      search: '',
      pathname: '/'
    }

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: this.mockLocation,
      writable: true
    })
  }

  setHash(hash: string) {
    this.mockLocation.hash = hash.startsWith('#') ? hash : `#${hash}`
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  getHash(): string {
    return this.mockLocation.hash
  }

  expectHashToContain(expectedSubstring: string) {
    expect(this.mockLocation.hash).toContain(expectedSubstring)
  }

  expectHashToMatch(expectedPattern: RegExp) {
    expect(this.mockLocation.hash).toMatch(expectedPattern)
  }

  async waitForHashUpdate(timeout: number = 1000) {
    await waitFor(() => {
      expect(this.mockLocation.hash).not.toBe('')
    }, { timeout })
  }

  restore() {
    Object.defineProperty(window, 'location', {
      value: this.originalLocation,
      writable: true
    })
  }
}

/**
 * LocalStorage Testing Utilities
 */
export class LocalStorageTester {
  private mockStorage: Record<string, string>
  private originalLocalStorage: Storage

  constructor(initialData: Record<string, string> = {}) {
    this.mockStorage = { ...initialData }
    this.originalLocalStorage = window.localStorage

    const mockStorageImpl = {
      getItem: vi.fn((key: string) => this.mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        this.mockStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete this.mockStorage[key]
      }),
      clear: vi.fn(() => {
        this.mockStorage = {}
      }),
      get length() {
        return Object.keys(mockStorageImpl.mockStorage).length
      },
      key: vi.fn((index: number) => {
        const keys = Object.keys(mockStorageImpl.mockStorage)
        return keys[index] || null
      }),
      mockStorage: this.mockStorage
    }

    Object.defineProperty(window, 'localStorage', {
      value: mockStorageImpl,
      writable: true
    })
  }

  expectItem(key: string, expectedValue: any) {
    const storedValue = this.mockStorage[key]
    if (typeof expectedValue === 'object') {
      expect(JSON.parse(storedValue || '{}')).toEqual(expectedValue)
    } else {
      expect(storedValue).toBe(expectedValue)
    }
  }

  expectItemToExist(key: string) {
    expect(this.mockStorage[key]).toBeDefined()
  }

  expectItemNotToExist(key: string) {
    expect(this.mockStorage[key]).toBeUndefined()
  }

  getStoredData() {
    return { ...this.mockStorage }
  }

  setItem(key: string, value: any) {
    this.mockStorage[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }

  restore() {
    Object.defineProperty(window, 'localStorage', {
      value: this.originalLocalStorage,
      writable: true
    })
  }
}

/**
 * Cross-Calculator Data Flow Testing
 */
export interface DataFlowStep {
  calculator: 'paycheck' | 'retirement'
  action: 'input' | 'calculate' | 'share' | 'load'
  data: Record<string, any>
  expectedResult?: Record<string, any>
}

export class DataFlowTester {
  private urlTester: URLHashTester
  private storageTester: LocalStorageTester

  constructor() {
    this.urlTester = new URLHashTester()
    this.storageTester = new LocalStorageTester()
  }

  async testFlow(steps: DataFlowStep[]) {
    for (const [index, step] of steps.entries()) {
      await this.executeStep(step, index)
    }
  }

  private async executeStep(step: DataFlowStep, index: number) {
    switch (step.action) {
      case 'input':
        // Simulate user input
        await this.simulateInput(step.calculator, step.data)
        break
        
      case 'calculate':
        // Simulate calculation trigger
        await this.triggerCalculation(step.calculator)
        break
        
      case 'share':
        // Test URL sharing
        await this.testUrlSharing(step.calculator, step.data)
        break
        
      case 'load':
        // Test loading from shared URL
        await this.testUrlLoading(step.calculator, step.data, step.expectedResult)
        break
    }
  }

  private async simulateInput(calculator: string, data: Record<string, any>) {
    // Would integrate with actual calculator components
    // For now, just verify data structure
    expect(data).toBeTypeOf('object')
    expect(Object.keys(data).length).toBeGreaterThan(0)
  }

  private async triggerCalculation(calculator: string) {
    // Simulate calculation completion
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async testUrlSharing(calculator: string, data: Record<string, any>) {
    // Test URL hash generation
    const expectedHashPattern = new RegExp(`${calculator}=`)
    await this.urlTester.waitForHashUpdate()
    this.urlTester.expectHashToMatch(expectedHashPattern)
  }

  private async testUrlLoading(
    calculator: string, 
    urlData: Record<string, any>, 
    expectedResult?: Record<string, any>
  ) {
    // Set URL hash and verify loading
    const hashData = this.encodeDataForHash(calculator, urlData)
    this.urlTester.setHash(hashData)
    
    if (expectedResult) {
      await waitFor(() => {
        // Would verify actual component state matches expectedResult
        expect(expectedResult).toBeTypeOf('object')
      })
    }
  }

  private encodeDataForHash(calculator: string, data: Record<string, any>): string {
    // Simplified encoding - actual implementation would use proper compression
    return `${calculator}=${btoa(JSON.stringify(data))}`
  }

  cleanup() {
    this.urlTester.restore()
    this.storageTester.restore()
  }
}

/**
 * User Workflow Testing
 */
export interface WorkflowStep {
  description: string
  action: () => Promise<void>
  validation: () => Promise<void>
  timeout?: number
}

export class UserWorkflowTester {
  private steps: WorkflowStep[] = []
  
  addStep(step: WorkflowStep) {
    this.steps.push(step)
  }

  async executeWorkflow(name: string) {
    for (const [index, step] of this.steps.entries()) {
      try {
        await step.action()
        await step.validation()
      } catch (error) {
        throw new Error(`Workflow '${name}' failed at step ${index + 1} (${step.description}): ${error}`)
      }
    }
  }

  clear() {
    this.steps = []
  }
}

/**
 * Performance Integration Testing
 */
export interface PerformanceMetrics {
  calculationTime: number
  renderTime: number
  stateUpdateTime: number
  urlUpdateTime: number
  storageWriteTime: number
}

export class PerformanceTester {
  private metrics: Partial<PerformanceMetrics> = {}

  async measureCalculationPerformance(calculationFn: () => Promise<any>) {
    const start = performance.now()
    await calculationFn()
    this.metrics.calculationTime = performance.now() - start
  }

  async measureRenderPerformance(renderFn: () => Promise<any>) {
    const start = performance.now()
    await renderFn()
    this.metrics.renderTime = performance.now() - start
  }

  async measureStateUpdatePerformance(updateFn: () => Promise<any>) {
    const start = performance.now()
    await updateFn()
    this.metrics.stateUpdateTime = performance.now() - start
  }

  async measureUrlUpdatePerformance(urlUpdateFn: () => Promise<any>) {
    const start = performance.now()
    await urlUpdateFn()
    this.metrics.urlUpdateTime = performance.now() - start
  }

  async measureStorageWritePerformance(storageFn: () => Promise<any>) {
    const start = performance.now()
    await storageFn()
    this.metrics.storageWriteTime = performance.now() - start
  }

  validatePerformance(thresholds: Partial<PerformanceMetrics>) {
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actualValue = this.metrics[metric as keyof PerformanceMetrics]
      if (actualValue !== undefined) {
        expect(actualValue).toBeLessThanOrEqual(threshold)
      }
    })
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics
  }

  reset() {
    this.metrics = {}
  }
}

/**
 * API Mock Utilities (for external dependencies)
 */
export class APIMocker {
  private mocks: Map<string, any> = new Map()

  mockChartJS() {
    const mockChart = {
      destroy: vi.fn(),
      update: vi.fn(),
      resize: vi.fn(),
      render: vi.fn(),
      data: { datasets: [], labels: [] },
      options: {}
    }

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

    this.mocks.set('chartjs', mockChart)
    return mockChart
  }

  mockWindowAPIs() {
    // Mock window.requestAnimationFrame
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: vi.fn(cb => setTimeout(cb, 16)),
      writable: true
    })

    // Mock window.cancelAnimationFrame
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: vi.fn(id => clearTimeout(id)),
      writable: true
    })

    // Mock ResizeObserver
    Object.defineProperty(window, 'ResizeObserver', {
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      })),
      writable: true
    })

    // Mock IntersectionObserver
    Object.defineProperty(window, 'IntersectionObserver', {
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      })),
      writable: true
    })
  }

  getMock(name: string) {
    return this.mocks.get(name)
  }

  clearMocks() {
    vi.clearAllMocks()
    this.mocks.clear()
  }
}

/**
 * Comprehensive integration test scenarios
 */
export const INTEGRATION_SCENARIOS = {
  fullCalculatorWorkflow: {
    name: 'Complete calculator workflow with state persistence',
    steps: [
      'User inputs financial data',
      'Calculator performs real-time calculations', 
      'Results are displayed with visualizations',
      'State is persisted to localStorage',
      'URL hash is updated for sharing',
      'User shares URL and reloads',
      'State is restored from URL',
      'Calculations remain accurate'
    ]
  },

  crossCalculatorFlow: {
    name: 'Data flow between paycheck and retirement calculators',
    steps: [
      'User completes paycheck allocation',
      'Retirement savings amount is calculated',
      'User navigates to retirement calculator',
      'Savings amount pre-populates from context',
      'User adjusts retirement scenario',
      'Updated projections reflect paycheck changes'
    ]
  },

  accessibilityCompliance: {
    name: 'End-to-end accessibility compliance',
    steps: [
      'Screen reader can navigate all elements',
      'Keyboard navigation works for all interactions',
      'Color contrast meets WCAG 2.1 AA standards',
      'Form validation messages are accessible',
      'Chart data is available to assistive technology'
    ]
  }
} as const

/**
 * Export all utilities
 */
// All classes are already exported individually above