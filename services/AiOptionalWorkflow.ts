import { getSetting, setSetting } from '@/db/settings';

let disclaimerShownThisSession = false;

const DISCLAIMER_DISMISSED_KEY = 'aiShareDisclaimerDismissed';

export async function shouldShowAiShareDisclaimer(): Promise<boolean> {
  const dismissed = await getSetting(DISCLAIMER_DISMISSED_KEY);
  if (dismissed === 'true') return false;
  if (disclaimerShownThisSession) return false;
  return true;
}

export function markAiShareDisclaimerShownThisSession(): void {
  disclaimerShownThisSession = true;
}

export async function setAiShareDisclaimerDismissed(dismissed: boolean): Promise<void> {
  await setSetting(DISCLAIMER_DISMISSED_KEY, dismissed ? 'true' : 'false');
}

