import { getSetting, setSetting } from '@/db/settings';

const REGRESSION_KEY = 'regressionChecklistV1';
const TEST_CASES = [10, 50, 100, 200, 500] as const;

export type RegressionCasePages = (typeof TEST_CASES)[number];
export type RegressionCaseStatus = 'pending' | 'pass' | 'fail';

export type RegressionChecklist = Record<RegressionCasePages, RegressionCaseStatus>;

const DEFAULT_CHECKLIST: RegressionChecklist = {
  10: 'pending',
  50: 'pending',
  100: 'pending',
  200: 'pending',
  500: 'pending',
};

function safeParse(raw: string | null): RegressionChecklist {
  if (!raw) return { ...DEFAULT_CHECKLIST };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<RegressionCasePages, RegressionCaseStatus>>;
    const next: RegressionChecklist = { ...DEFAULT_CHECKLIST };
    for (const pages of TEST_CASES) {
      const value = parsed?.[pages];
      next[pages] = value === 'pass' || value === 'fail' ? value : 'pending';
    }
    return next;
  } catch {
    return { ...DEFAULT_CHECKLIST };
  }
}

export async function getRegressionChecklist(): Promise<RegressionChecklist> {
  const raw = await getSetting(REGRESSION_KEY);
  return safeParse(raw);
}

export async function setRegressionCaseStatus(
  pages: RegressionCasePages,
  status: RegressionCaseStatus
): Promise<RegressionChecklist> {
  const current = await getRegressionChecklist();
  const next: RegressionChecklist = { ...current, [pages]: status };
  await setSetting(REGRESSION_KEY, JSON.stringify(next));
  return next;
}

export async function resetRegressionChecklist(): Promise<RegressionChecklist> {
  await setSetting(REGRESSION_KEY, JSON.stringify(DEFAULT_CHECKLIST));
  return { ...DEFAULT_CHECKLIST };
}
