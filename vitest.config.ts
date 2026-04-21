import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: true,
    // Test organization and patterns
    include: [
      // Unit tests for calculations (100% coverage required)
      'test/lib/calculations/**/*.test.{ts,js}',
      // Unit tests for utility modules (90% coverage target)
      'test/lib/utils/**/*.test.{ts,js}',
      // Component tests (80% coverage target)
      'test/components/**/*.test.{tsx,ts}',
      // Integration tests (70% coverage target)
      'test/integration/**/*.test.{ts,tsx}',
      // Legacy sample tests during development
      'test/**/sample.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules/',
      '.next/',
      'public/',
      'docs/',
      'test/utils/',
      'test/mocks/',
      'test/__fixtures__/'
    ],
    // Test execution configuration
    testTimeout: 10000, // 10s for complex calculations
    hookTimeout: 5000,  // 5s for setup/teardown
    // Parallel execution with controlled concurrency
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
        useAtomics: true
      }
    },
    // Coverage configuration with Sprint 7 targets
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportOnFailure: true,
      exclude: [
        'node_modules/',
        'test/',
        '.next/',
        'public/',
        'docs/',
        '**/*.config.js',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/*.stories.{ts,tsx}',
        'test/utils/**',
        'test/mocks/**',
        'test/__fixtures__/**'
      ],
      // Sprint 7 Coverage Targets
      thresholds: {
        // Global targets for overall codebase
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        // CRITICAL: 100% coverage for financial calculations
        './lib/calculations/**/*.{ts,js}': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        // HIGH: 90% coverage for core utilities
        './lib/utils/**/*.{ts,js}': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // MEDIUM: 80% coverage for components
        './components/**/*.{tsx,ts}': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // MEDIUM: 80% coverage for app routes
        './app/**/*.{tsx,ts}': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        }
      }
    },
    // Performance benchmarking
    benchmark: {
      include: ['test/**/*.{bench,benchmark}.{js,ts}'],
      exclude: ['node_modules/', '.next/'],
      reporters: ['verbose']
    },
    // Enhanced reporting for CI/CD
    reporters: ['verbose', 'junit', 'json'],
    outputFile: {
      junit: './coverage/junit.xml',
      json: './coverage/test-results.json'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/test': resolve(__dirname, './test'),
    },
  },
})