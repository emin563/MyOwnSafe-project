import { getSetting, setSetting } from '@/db/settings';
import { SPEED_SLO } from '@/services/performanceTargets';

const METRICS_KEY = 'performanceMetricsV1';
const MAX_SAMPLES = 50;

export type PerformanceMetricName =
  | 'scan_to_preview'
  | 'scan_to_pdf'
  | 'open_pdf'
  | 'show_progress_latency';

type MetricEntry = {
  count: number;
  lastMs: number;
  avgMs: number;
  p50Ms: number;
  samples: number[];
  targetMs: number;
  meetsTarget: boolean;
  updatedAt: number;
};

type MetricsStore = Partial<Record<PerformanceMetricName, MetricEntry>>;

const METRIC_TARGETS: Record<PerformanceMetricName, number> = {
  scan_to_preview: SPEED_SLO.scanToPreviewP50Ms,
  scan_to_pdf: SPEED_SLO.scanToPdfP50Ms,
  open_pdf: SPEED_SLO.openPdfP50Ms,
  show_progress_latency: SPEED_SLO.showProgressByMs,
};

function safeParse(raw: string | null): MetricsStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MetricsStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function computeP50(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export async function recordPerformanceMetric(metric: PerformanceMetricName, durationMs: number): Promise<void> {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  const clamped = Math.round(durationMs);
  const current = safeParse(await getSetting(METRICS_KEY));
  const prev = current[metric];

  const samples = [...(prev?.samples ?? []), clamped].slice(-MAX_SAMPLES);
  const p50Ms = computeP50(samples);
  const count = (prev?.count ?? 0) + 1;
  const avgMs = Math.round(((prev?.avgMs ?? 0) * (count - 1) + clamped) / count);
  const targetMs = METRIC_TARGETS[metric];
  const entry: MetricEntry = {
    count,
    lastMs: clamped,
    avgMs,
    p50Ms,
    samples,
    targetMs,
    meetsTarget: p50Ms <= targetMs,
    updatedAt: Date.now(),
  };

  current[metric] = entry;
  await setSetting(METRICS_KEY, JSON.stringify(current));
}

export async function getPerformanceMetrics(): Promise<MetricsStore> {
  return safeParse(await getSetting(METRICS_KEY));
}

export async function resetPerformanceMetrics(): Promise<void> {
  await setSetting(METRICS_KEY, JSON.stringify({}));
}

