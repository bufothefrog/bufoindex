import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Lib tests that need a DOM; they run in the jsdom project.
const DOM_LIB_TESTS = [
  'test/lib/chart-theme.test.ts',
  'test/lib/store/**/*.test.{ts,js}',
  'test/lib/test-utils/**/*.test.{ts,js}',
  'test/lib/workers/**/*.test.{ts,js}',
]

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    css: true,
    // Plain logic tests run without a simulated browser, which is faster.
    // Component tests, and lib tests that need window, localStorage or a
    // Worker (chart theme, stores, test utilities, workers), run in jsdom.
    // A new lib test that needs a DOM goes in one of the jsdom groups or
    // carries its own @vitest-environment comment.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['./test/setup.ts'],
          include: ['test/lib/**/*.test.{ts,js}'],
          exclude: DOM_LIB_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          include: ['test/components/**/*.test.{tsx,ts}', ...DOM_LIB_TESTS],
        },
      },
    ],
    exclude: [
      'node_modules/',
      '.next/',
      'public/',
      'docs/',
    ],
    testTimeout: 10000,
    hookTimeout: 5000,
    pool: 'threads',
    maxWorkers: 4,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportOnFailure: true,
      include: [
        'lib/**/*.ts',
      ],
      exclude: [
        'node_modules/',
        'test/',
        '.next/',
        'public/',
        'docs/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        // Type-only modules — no executable statements to cover
        'lib/types/**',
        'lib/design-system/types.ts',
        'lib/formulas/types.ts',
      ],
      thresholds: {
        // Global floors across all covered lib/ code
        statements: 55,
        // Financial logic is held to a higher bar
        'lib/calculations/**/*.ts': {
          statements: 80,
          branches: 65,
        },
      },
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