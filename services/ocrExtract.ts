import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type OcrExtractResult =
  | { text: string | null; ok: true }
  | { text: null; ok: false; reason: 'web' | 'expo-go' | 'unsupported' | 'error'; message?: string };

type OcrOptions = {
  mode?: 'auto' | 'document' | 'receipt' | 'handwritten';
  language?: 'auto' | 'en' | 'tr';
};

function normalizeExtractedText(raw: string, mode: OcrOptions['mode']): string {
  if (!raw) return '';
  let trimmed = raw.trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/\u00A0/g, ' ');

  const fixBrokenWords = (text: string): string =>
    text.replace(/([A-Za-z\u00C0-\u024F])-\n([A-Za-z\u00C0-\u024F])/g, '$1$2');

  const mergeSoftWrappedLines = (text: string): string => {
    const lines = text.split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const current = lines[i].trimRight();
      if (!current) {
        out.push('');
        continue;
      }
      const next = i + 1 < lines.length ? lines[i + 1].trimLeft() : '';
      const shouldMerge =
        !!next &&
        /[A-Za-z0-9,)\]]$/.test(current) &&
        /^[a-z0-9("']/.test(next) &&
        !/[.:;!?]$/.test(current);
      if (shouldMerge) {
        lines[i + 1] = `${current} ${next}`;
      } else {
        out.push(current);
      }
    }
    return out.join('\n');
  };

  const normalizeReceiptSpacing = (text: string): string => {
    return text
      .split('\n')
      .map((line) => {
        const cleaned = line.replace(/[ \t]{2,}/g, '  ').trimEnd();
        // Keep amount columns visually separated.
        return cleaned.replace(/([^\s])\s+(\d+[.,]\d{2}\b)/g, '$1  $2');
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  };

  if (mode === 'document') {
    return mergeSoftWrappedLines(
      fixBrokenWords(
        trimmed
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
      )
    );
  }
  if (mode === 'receipt') {
    return normalizeReceiptSpacing(fixBrokenWords(trimmed));
  }
  if (mode === 'handwritten') {
    // Handwritten: keep spacing/newlines as close to source as possible.
    return trimmed.replace(/\n{4,}/g, '\n\n\n');
  }
  // Auto: balanced clean-up with conservative merges.
  return mergeSoftWrappedLines(
    fixBrokenWords(
      trimmed
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
    )
  );
}

function scoreOcrText(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const lenScore = Math.min(120, t.length);
  const letters = (t.match(/[A-Za-z\u00C0-\u024F\u0100-\u017F]/g) ?? []).length;
  const digits = (t.match(/[0-9]/g) ?? []).length;
  const words = (t.match(/\b[^\s]+\b/g) ?? []).length;
  const symbolPenalty = (t.match(/[^\w\s.,:;!?'"()\-/%$€₺]/g) ?? []).length;
  return lenScore + letters * 0.35 + digits * 0.1 + words * 0.8 - symbolPenalty * 0.6;
}

/** Single variant: OCR on the original image (no expo-image-manipulator preprocessing). */
async function createOcrPreprocessVariants(fileUri: string, _options?: OcrOptions): Promise<string[]> {
  return [fileUri];
}

/**
 * OCR via expo-text-extractor. Must not import the package on Expo Go (native module missing → crash).
 * Dev / production builds: dynamic import + official extractTextFromImage (handles file:// like the library).
 */
export async function extractTextFromImageIfAvailable(fileUri: string, options?: OcrOptions): Promise<OcrExtractResult> {
  if (Platform.OS === 'web') {
    return { text: null, ok: false, reason: 'web' };
  }

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { text: null, ok: false, reason: 'expo-go' };
  }

  try {
    const { extractTextFromImage, isSupported } = await import('expo-text-extractor');
    if (!isSupported) {
      return { text: null, ok: false, reason: 'unsupported' };
    }
    const variants = await createOcrPreprocessVariants(fileUri, options);
    let bestText = '';
    let bestScore = -Infinity;

    for (const uri of variants) {
      const parts = await extractTextFromImage(uri);
      const raw = Array.isArray(parts) ? parts.join('\n') : String(parts ?? '');
      const normalized = normalizeExtractedText(raw, options?.mode);
      const score = scoreOcrText(normalized);
      if (score > bestScore) {
        bestScore = score;
        bestText = normalized;
      }
    }

    // Language option is currently reserved for engines that support language hints.
    void options?.language;
    return { text: bestText.trim() ? bestText : null, ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { text: null, ok: false, reason: 'error', message };
  }
}
