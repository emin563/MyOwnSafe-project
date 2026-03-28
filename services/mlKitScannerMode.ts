/**
 * Maps to {@link https://developers.google.com/android/reference/com/google/mlkit/vision/documentscanner/GmsDocumentScannerOptions.Builder#setScannerMode(int) GmsDocumentScannerOptions} via Infinite Red bridge.
 *
 * - **base** — Crop and perspective only; no in-scanner filters or “enhance” pipeline (best text legibility / least recompression).
 * - **base_with_filter** — Base plus color filters (still lighter than full).
 * - **full** — All Google scanner tools (can apply strong contrast / “AI” style adjustments).
 */
export type MlKitScannerMode = 'base' | 'base_with_filter' | 'full';

export function normalizeMlKitScannerMode(value: string | null | undefined): MlKitScannerMode {
  if (value === 'base_with_filter' || value === 'full') return value;
  return 'base';
}
