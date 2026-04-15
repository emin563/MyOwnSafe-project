/**
 * Expiry dates are stored as YYYY-MM-DD (SQLite-friendly, sortable).
 * Helpers for parsing flexible user input and for the date picker (local calendar dates).
 */

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function localDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse stored ISO to a local calendar date (avoids UTC midnight shifting the day). */
export function isoToLocalDate(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidYmd(y, mo, d)) return null;
  return new Date(y, mo - 1, d);
}

export type ParseExpiryResult =
  | { ok: true; iso: string | null }
  | { ok: false; message: string };

/**
 * Parse optional expiry input to YYYY-MM-DD. Empty / whitespace -> null.
 * Accepts ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY/MM/DD, and unambiguous slash forms.
 */
export function parseExpiryDateInput(raw: string): ParseExpiryResult {
  const s = raw.trim();
  if (!s) return { ok: true, iso: null };

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split('-').map(Number);
    return isValidYmd(y, mo, d)
      ? { ok: true, iso: s }
      : { ok: false, message: 'That calendar date is not valid.' };
  }

  const normalized = s.replace(/[.]/g, '/').replace(/-/g, '/');
  const parts = normalized
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 3) {
    return {
      ok: false,
      message: 'Try a date like 15/04/2026, or tap the calendar to pick one.',
    };
  }

  const nums = parts.map((p) => ( /^\d+$/.test(p) ? parseInt(p, 10) : NaN));
  if (nums.some((n) => Number.isNaN(n))) {
    return { ok: false, message: 'Use numbers for the day, month, and year.' };
  }

  let y: number;
  let mo: number;
  let day: number;

  if (parts[0].length === 4) {
    y = nums[0];
    mo = nums[1];
    day = nums[2];
  } else if (parts[2].length === 4) {
    y = nums[2];
    const a = nums[0];
    const b = nums[1];
    if (a > 12) {
      day = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      day = b;
    } else {
      // Ambiguous 01/02/2026 — treat as day/month (common outside US).
      day = a;
      mo = b;
    }
  } else {
    return { ok: false, message: 'Use a four-digit year (e.g. 15/04/2026).' };
  }

  if (!isValidYmd(y, mo, day)) {
    return { ok: false, message: 'That calendar date is not valid.' };
  }

  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { ok: true, iso };
}
