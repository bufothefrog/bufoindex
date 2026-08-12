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
    include: [
      'test/lib/**/*.test.{ts,js}',
      'test/components/**/*.test.{tsx,ts}',
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