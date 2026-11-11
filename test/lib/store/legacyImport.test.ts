import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyCalculatorStorage, LEGACY_CALCULATOR_STORAGE_KEYS } from '@/lib/store/legacyImport';

beforeEach(() => {
  window.localStorage.clear();
});

describe('clearLegacyCalculatorStorage (O7: discard)', () => {
  it('names the two pre-profile calculator keys', () => {
    expect(LEGACY_CALCULATOR_STORAGE_KEYS).toEqual(['retirement-calculator', 'paycheck-allocator-storage']);
  });

  it('removes only the legacy keys that exist, then is a no-op', () => {
    window.localStorage.setItem('retirement-calculator', '{"state":{},"version":3}');
    window.localStorage.setItem('bufo-profile', '{"state":{}}');
    expect(clearLegacyCalculatorStorage()).toEqual(['retirement-calculator']);
    expect(window.localStorage.getItem('retirement-calculator')).toBeNull();
    expect(window.localStorage.getItem('bufo-profile')).not.toBeNull();
    expect(clearLegacyCalculatorStorage()).toEqual([]);
  });

  it('tolerates missing or throwing storage', () => {
    expect(clearLegacyCalculatorStorage(null)).toEqual([]);
    const storage = {
      getItem: vi.fn((key: string) => (key === 'paycheck-allocator-storage' ? '{}' : 'x')),
      removeItem: vi.fn((key: string) => {
        if (key === 'retirement-calculator') throw new Error('blocked');
      }),
    };
    expect(clearLegacyCalculatorStorage(storage)).toEqual(['paycheck-allocator-storage']);
  });
});
