'use client';

import { useEffect, useRef, useState } from 'react';
import { stableKey } from '@/lib/fields/binding';

interface Computed<R> {
  key: string;
  value: R;
}

/**
 * Runs `compute(inputs)` only after the browser has painted (a
 * requestAnimationFrame, then a macrotask), so a simulation never blocks the
 * first paint of the overview (audit H7). Returns null while the result for
 * the current inputs is pending.
 *
 * Inputs are keyed by stableKey, so a profile edit that leaves them equal
 * (the strategy preset, the cash target) does not run the simulation again.
 * `compute` must be a stable, pure function (a module-level one).
 */
export function useDeferredResult<I, R>(inputs: I, compute: (inputs: I) => R): R | null {
  const key = stableKey(inputs);
  const latest = useRef(inputs);
  const [computed, setComputed] = useState<Computed<R> | null>(null);

  useEffect(() => {
    latest.current = inputs;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setComputed({ key, value: compute(latest.current) }), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [key, compute]);

  return computed !== null && computed.key === key ? computed.value : null;
}

export default useDeferredResult;
