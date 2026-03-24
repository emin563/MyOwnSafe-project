/**
 * Centralized product targets for performance and tested operational limits.
 * Keep these values in sync with UI copy and QA expectations.
 */
export const MULTI_PAGE_TESTED_LIMIT = 500;

/**
 * Service-level objectives (SLO) for key user flows.
 * Values are in milliseconds.
 */
export const SPEED_SLO = {
  scanToPreviewP50Ms: 800,
  scanToPdfP50Ms: 3000,
  openPdfP50Ms: 1500,
  showProgressByMs: 500,
} as const;

