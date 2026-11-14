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
      // CI uploads coverage/lcov.info; lcov also writes an HTML view in
      // coverage/lcov-report/.
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      include: [
        'lib/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        // Type-only modules: no executable statements to cover
        'lib/types/**',
        'lib/design-system/types.ts',
        'lib/formulas/types.ts',
      ],
      // Floors set just under the measured coverage, so a change that drops
      // tested code or removes tests fails the run.
      thresholds: {
        // Across all covered lib/ code
        statements: 97,
        branches: 92,
        // The financial logic, where a wrong number is a bug
        'lib/calculations/**/*.ts': {
          statements: 96,
          branches: 90,
        },
      },
    },
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})