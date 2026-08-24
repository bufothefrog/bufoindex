/**
 * Shared random number generation utilities
 * Consolidated Box-Muller transform with log(0) protection
 */

/**
 * Create a seeded PRNG using Numerical Recipes LCG (period 2^32)
 * Does NOT replace Math.random -- returns a local function
 */
export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Box-Muller transform for normally distributed random numbers
 * Protected against log(0) with do-while guard
 */
export function boxMullerRandom(
  mean: number = 0,
  stdDev: number = 1,
  rng: () => number = Math.random
): number {
  let u1: number;
  const u2 = rng();
  do { u1 = rng(); } while (u1 === 0);
  const mag = Math.sqrt(-2.0 * Math.log(u1));
  return mag * Math.sin(2.0 * Math.PI * u2) * stdDev + mean;
}
