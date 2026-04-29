/**
 * RevenueCat Android/iOS public SDK keys (`goog_…` / `appl_…`) are safe to embed in the app.
 * This module only centralizes the "unset / template" checks used at build time and runtime.
 */

/** Default placeholder from docs / templates — treat as missing. */
export const REVENUECAT_API_KEY_PLACEHOLDER = 'YOUR_REVENUECAT_GOOG_API_KEY' as const;

export function isRevenueCatPublicKeyUnset(key: string | undefined | null): boolean {
  const k = typeof key === 'string' ? key.trim() : '';
  return !k || k === REVENUECAT_API_KEY_PLACEHOLDER;
}
