import { deleteSetting, getSetting, setSetting } from '@/db/settings';

/** Persisted Free-tier “Is Pro right for you?” quiz; cleared when Pro is purchased / entitled. */

const KEY_SUBS = 'quizWhyPro_subscriptions';
const KEY_PRIVACY = 'quizWhyPro_privacy';
const KEY_AI = 'quizWhyPro_aiFreedom';
const KEY_STEP = 'quizWhyPro_stepIndex';

export type QuizTiredOfSubs = 'frustrated' | 'dont_mind' | null;
export type QuizPrivacy = 'prefer_local' | 'trust' | null;
export type QuizAiFreedom = 'want_choice' | 'fine' | null;

export type QuizPersistedState = {
  tiredOfSubs: QuizTiredOfSubs;
  privacy: QuizPrivacy;
  aiFreedom: QuizAiFreedom;
  stepIndex: number;
};

function parseSubs(raw: string | null): QuizTiredOfSubs {
  if (raw === 'frustrated' || raw === 'dont_mind') return raw;
  return null;
}

function parsePrivacy(raw: string | null): QuizPrivacy {
  if (raw === 'prefer_local' || raw === 'trust') return raw;
  return null;
}

function parseAi(raw: string | null): QuizAiFreedom {
  if (raw === 'want_choice' || raw === 'fine') return raw;
  return null;
}

/** First step index that still needs an answer (0–2), or 3 if all three are answered. */
export function firstIncompleteStep(
  tiredOfSubs: QuizTiredOfSubs,
  privacy: QuizPrivacy,
  aiFreedom: QuizAiFreedom
): number {
  if (tiredOfSubs === null) return 0;
  if (privacy === null) return 1;
  if (aiFreedom === null) return 2;
  return 3;
}

/**
 * Resolve which screen to show: unfinished questions first; then model (3) or summary (4) from storage.
 */
export function resolveQuizStepIndex(
  tiredOfSubs: QuizTiredOfSubs,
  privacy: QuizPrivacy,
  aiFreedom: QuizAiFreedom,
  savedStepRaw: string | null
): number {
  const fi = firstIncompleteStep(tiredOfSubs, privacy, aiFreedom);
  if (fi < 3) return fi;

  const saved = savedStepRaw != null ? Number.parseInt(savedStepRaw, 10) : NaN;
  if (saved === 4) return 4;
  if (saved === 3) return 3;
  return 3;
}

export async function loadQuizWhyProState(): Promise<QuizPersistedState> {
  const [rawSubs, rawPriv, rawAi, rawStep] = await Promise.all([
    getSetting(KEY_SUBS),
    getSetting(KEY_PRIVACY),
    getSetting(KEY_AI),
    getSetting(KEY_STEP),
  ]);

  const tiredOfSubs = parseSubs(rawSubs);
  const privacy = parsePrivacy(rawPriv);
  const aiFreedom = parseAi(rawAi);
  const stepIndex = resolveQuizStepIndex(tiredOfSubs, privacy, aiFreedom, rawStep);

  return { tiredOfSubs, privacy, aiFreedom, stepIndex };
}

export async function persistQuizSubscription(value: NonNullable<QuizTiredOfSubs>): Promise<void> {
  await setSetting(KEY_SUBS, value);
}

export async function persistQuizPrivacy(value: NonNullable<QuizPrivacy>): Promise<void> {
  await setSetting(KEY_PRIVACY, value);
}

export async function persistQuizAiFreedom(value: NonNullable<QuizAiFreedom>): Promise<void> {
  await setSetting(KEY_AI, value);
}

export async function persistQuizStepIndex(index: number): Promise<void> {
  await setSetting(KEY_STEP, String(index));
}

/** Call when the user becomes Pro (purchase, restore, or billing sync). Removes all quiz + step data. */
export async function clearQuizWhyProData(): Promise<void> {
  await Promise.all([deleteSetting(KEY_SUBS), deleteSetting(KEY_PRIVACY), deleteSetting(KEY_AI), deleteSetting(KEY_STEP)]);
}
