/**
 * The leverage worker entry. The store tests answer the runner with their own
 * stand-in worker, so they never load lib/workers/leverageWorker.ts; this
 * test does, with exposeCalculation mocked, and checks that the module
 * answers the runner with the real engine function and nothing else.
 */

import { describe, expect, it, vi } from 'vitest';
import { simulateDcaComparison } from '@/lib/calculations/leverageComparison';
import { exposeCalculation } from '@/lib/workers/exposeCalculation';

vi.mock('@/lib/workers/exposeCalculation', () => ({ exposeCalculation: vi.fn() }));

describe('leverageWorker', () => {
  it('exposes simulateDcaComparison once, unwrapped', async () => {
    await import('@/lib/workers/leverageWorker');
    expect(vi.mocked(exposeCalculation)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(exposeCalculation).mock.calls[0]).toEqual([simulateDcaComparison]);
    expect(vi.mocked(exposeCalculation).mock.calls[0]?.[0]).toBe(simulateDcaComparison);
  });
});
