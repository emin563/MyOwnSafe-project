/**
 * OCR language hints for on-device text recognition.
 * Stored per user; passed through the OCR pipeline when the native engine supports hints.
 */

export type OcrLanguageCode =
  | 'auto'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'tr'
  | 'sv'
  | 'da'
  | 'nb'
  | 'fi'
  | 'cs'
  | 'sk'
  | 'hu'
  | 'ro'
  | 'hr'
  | 'sl'
  | 'el'
  | 'ru'
  | 'uk'
  | 'bg'
  | 'ar'
  | 'he'
  | 'fa'
  | 'ur'
  | 'hi'
  | 'bn'
  | 'ta'
  | 'te'
  | 'zh-Hans'
  | 'zh-Hant'
  | 'ja'
  | 'ko'
  | 'th'
  | 'vi';

const KNOWN_CODES = new Set<string>([
  'auto',
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'pl',
  'tr',
  'sv',
  'da',
  'nb',
  'fi',
  'cs',
  'sk',
  'hu',
  'ro',
  'hr',
  'sl',
  'el',
  'ru',
  'uk',
  'bg',
  'ar',
  'he',
  'fa',
  'ur',
  'hi',
  'bn',
  'ta',
  'te',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'th',
  'vi',
]);

export function isOcrLanguageCode(value: string): value is OcrLanguageCode {
  return KNOWN_CODES.has(value);
}

export function normalizeOcrLanguageCode(value: string | null | undefined): OcrLanguageCode {
  if (value == null || value === '') return 'auto';
  if (isOcrLanguageCode(value)) return value;
  return 'auto';
}

const LABELS: Record<OcrLanguageCode, string> = {
  auto: 'Auto-detect',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  sv: 'Swedish',
  da: 'Danish',
  nb: 'Norwegian (Bokmål)',
  fi: 'Finnish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  hr: 'Croatian',
  sl: 'Slovenian',
  el: 'Greek',
  ru: 'Russian',
  uk: 'Ukrainian',
  bg: 'Bulgarian',
  ar: 'Arabic',
  he: 'Hebrew',
  fa: 'Persian (Farsi)',
  ur: 'Urdu',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  vi: 'Vietnamese',
};

export function getOcrLanguageLabel(code: OcrLanguageCode): string {
  return LABELS[code] ?? code;
}

/** Grouped for pickers (mode sheet, settings copy, etc.). */
export const OCR_LANGUAGE_CATEGORIES: readonly {
  readonly title: string;
  readonly codes: readonly OcrLanguageCode[];
}[] = [
  {
    title: 'Automatic',
    codes: ['auto'],
  },
  {
    title: 'English & major European (Latin)',
    codes: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl'],
  },
  {
    title: 'Northern, Central & Eastern Europe (Latin)',
    codes: ['pl', 'tr', 'sv', 'da', 'nb', 'fi', 'cs', 'sk', 'hu', 'ro', 'hr', 'sl', 'el'],
  },
  {
    title: 'Cyrillic',
    codes: ['ru', 'uk', 'bg'],
  },
  {
    title: 'Middle East & Hebrew',
    codes: ['ar', 'he', 'fa', 'ur'],
  },
  {
    title: 'South Asia',
    codes: ['hi', 'bn', 'ta', 'te'],
  },
  {
    title: 'East Asia',
    codes: ['zh-Hans', 'zh-Hant', 'ja', 'ko'],
  },
  {
    title: 'Southeast Asia',
    codes: ['th', 'vi'],
  },
] as const;
