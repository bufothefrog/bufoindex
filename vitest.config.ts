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
      'test/integration/**/*.test.{ts,tsx}',
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
        'lib/calculations/**/*.ts',
        'lib/utils/**/*.ts',
      ],
      exclude: [
        'node_modules/',
        'test/',
        '.next/',
        'public/',
        'docs/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
      ],
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