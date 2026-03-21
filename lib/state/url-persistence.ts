/**
 * URL State Persistence System
 * Only captures inputs for backward compatibility
 */

import { URLSerializableInputs } from '../design-system/types';

const CURRENT_VERSION = 1;
const URL_HASH_PREFIX = '#bufo=';

/**
 * Detect calculator type from current path or context
 */
export function detectCalculatorType(): 'paycheck' | 'retirement' {
  if (typeof window === 'undefined') return 'paycheck';
  
  const path = window.location.pathname;
  if (path.includes('retirement')) return 'retirement';
  return 'paycheck';
}

/**
 * Sanitize inputs to only include serializable data
 */
export function sanitizeInputsOnly(inputs: unknown): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  // Only capture primitive values and simple objects
  for (const [key, value] of Object.entries(inputs as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Only serialize arrays of primitives
      const primitiveArray = value.filter(item => 
        typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      );
      if (primitiveArray.length > 0) {
        sanitized[key] = primitiveArray;
      }
    } else if (typeof value === 'object') {
      // Recursively sanitize nested objects
      const sanitizedNested = sanitizeInputsOnly(value);
      if (Object.keys(sanitizedNested).length > 0) {
        sanitized[key] = sanitizedNested;
      }
    }
  }
  
  return sanitized;
}

/**
 * Serialize inputs to URL-safe string
 */
export function serializeInputsToURL(inputs: unknown): string {
  try {
    const state: URLSerializableInputs = {
      calculator: detectCalculatorType(),
      inputs: sanitizeInputsOnly(inputs),
      version: CURRENT_VERSION,
      timestamp: Date.now()
    };
    
    const jsonString = JSON.stringify(state);
    return btoa(encodeURIComponent(jsonString));
  } catch (error) {
    console.error('Failed to serialize inputs to URL:', error);
    return '';
  }
}

/**
 * Deserialize inputs from URL hash
 */
export function deserializeInputsFromURL(hash: string): unknown | null {
  try {
    // Remove prefix if present
    const cleanHash = hash.startsWith(URL_HASH_PREFIX) 
      ? hash.slice(URL_HASH_PREFIX.length)
      : hash;
    
    const jsonString = decodeURIComponent(atob(cleanHash));
    const state = JSON.parse(jsonString) as URLSerializableInputs;
    
    // Validate structure
    if (!state.inputs || typeof state.inputs !== 'object') {
      console.warn('Invalid URL state structure');
      return null;
    }
    
    // Migrate if needed
    return migrateInputsToCurrentVersion(state.inputs, state.version || 1);
  } catch (error) {
    console.error('Failed to deserialize inputs from URL:', error);
    return null;
  }
}

/**
 * Update URL with current inputs
 */
export function updateURLWithInputs(inputs: unknown): void {
  if (typeof window === 'undefined') return;
  
  try {
    const serialized = serializeInputsToURL(inputs);
    if (serialized) {
      const newURL = `${window.location.origin}${window.location.pathname}${URL_HASH_PREFIX}${serialized}`;
      window.history.replaceState(null, '', newURL);
    }
  } catch (error) {
    console.error('Failed to update URL with inputs:', error);
  }
}

/**
 * Load inputs from URL
 */
export function loadInputsFromURL(): unknown | null {
  if (typeof window === 'undefined') return null;
  
  const hash = window.location.hash;
  if (!hash || !hash.includes(URL_HASH_PREFIX)) return null;
  
  return deserializeInputsFromURL(hash);
}

/**
 * Clear URL state
 */
export function clearURLState(): void {
  if (typeof window === 'undefined') return;
  
  const newURL = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState(null, '', newURL);
}

/**
 * Migration functions for backward compatibility
 */
export function migrateInputsToCurrentVersion(inputs: unknown, fromVersion: number): unknown {
  const migrated = { ...(inputs as Record<string, unknown>) };
  
  // V1 to V2 migrations (if needed in future)
  if (fromVersion < 2) {
    // migrated = migrateV1ToV2(migrated);
  }
  
  // Always set current version
  migrated.version = CURRENT_VERSION;
  return migrated;
}

/**
 * Generate shareable URL for current inputs
 */
export function generateShareableURL(inputs: unknown): string {
  if (typeof window === 'undefined') return '';
  
  const serialized = serializeInputsToURL(inputs);
  if (!serialized) return window.location.href;
  
  return `${window.location.origin}${window.location.pathname}${URL_HASH_PREFIX}${serialized}`;
}

/**
 * Validate URL state structure
 */
export function isValidURLState(state: unknown): state is URLSerializableInputs {
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof (state as Record<string, unknown>).calculator === 'string' &&
    typeof (state as Record<string, unknown>).inputs === 'object' &&
    (state as Record<string, unknown>).inputs !== null &&
    typeof (state as Record<string, unknown>).version === 'number'
  );
}