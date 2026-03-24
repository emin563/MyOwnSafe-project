import { getSetting, setSetting } from '@/db/settings';

const OCR_METRICS_KEY = 'ocrMetricsV1';
const MAX_SAMPLES = 80;

type OcrMetricsStore = {
  totalPages: number;
  failedPages: number;
  weakPages: number;
  retriedPages: number;
  improvedPages: number;
  timedOutPages: number;
  latencySamples: number[];
  p50LatencyMs: number;
  avgLatencyMs: number;
  updatedAt: number;
};

const EMPTY_METRICS: OcrMetricsStore = {
  totalPages: 0,
  failedPages: 0,
  weakPages: 0,
  retriedPages: 0,
  improvedPages: 0,
  timedOutPages: 0,
  latencySamples: [],
  p50LatencyMs: 0,
  avgLatencyMs: 0,
  updatedAt: 0,
};

function safeParse(raw: string | null): OcrMetricsStore {
  if (!raw) return { ...EMPTY_METRICS };
  try {
    const parsed = JSON.parse(raw) as Partial<OcrMetricsStore>;
    return {
      ...EMPTY_METRICS,
      ...parsed,
      latencySamples: Array.isArray(parsed?.latencySamples)
        ? parsed!.latencySamples.filter((n) => Number.isFinite(n) && n >= 0).slice(-MAX_SAMPLES)
        : [],
    };
  } catch {
    return { ...EMPTY_METRICS };
  }
}

function computeP50(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export async function recordOcrPageMetric(sample: {
  latencyMs?: number;
  failed?: boolean;
  weak?: boolean;
  retried?: boolean;
  improved?: boolean;
  timedOut?: boolean;
}): Promise<void> {
  const current = safeParse(await getSetting(OCR_METRICS_KEY));
  const next = { ...current };

  next.totalPages += 1;
  if (sample.failed) next.failedPages += 1;
  if (sample.weak) next.weakPages += 1;
  if (sample.retried) next.retriedPages += 1;
  if (sample.improved) next.improvedPages += 1;
  if (sample.timedOut) next.timedOutPages += 1;

  if (Number.isFinite(sample.latencyMs) && (sample.latencyMs ?? 0) >= 0) {
    next.latencySamples = [...next.latencySamples, Math.round(sample.latencyMs!)].slice(-MAX_SAMPLES);
  }

  next.p50LatencyMs = computeP50(next.latencySamples);
  next.avgLatencyMs = next.latencySamples.length
    ? Math.round(next.latencySamples.reduce((sum, n) => sum + n, 0) / next.latencySamples.length)
    : 0;
  next.updatedAt = Date.now();

  await setSetting(OCR_METRICS_KEY, JSON.stringify(next));
}

export async function getOcrMetrics(): Promise<OcrMetricsStore> {
  return safeParse(await getSetting(OCR_METRICS_KEY));
}

export async function resetOcrMetrics(): Promise<void> {
  await setSetting(OCR_METRICS_KEY, JSON.stringify(EMPTY_METRICS));
}
