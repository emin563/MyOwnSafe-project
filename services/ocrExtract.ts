import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export type OcrExtractResult =
  | { text: string | null; ok: true }
  | { text: null; ok: false; reason: 'web' | 'expo-go' | 'unsupported' | 'error'; message?: string };

/**
 * OCR via expo-text-extractor. Must not import the package on Expo Go (native module missing → crash).
 * Dev / production builds: dynamic import + official extractTextFromImage (handles file:// like the library).
 */
export async function extractTextFromImageIfAvailable(fileUri: string): Promise<OcrExtractResult> {
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
    const parts = await extractTextFromImage(fileUri);
    const raw = Array.isArray(parts) ? parts.join('\n') : String(parts ?? '');
    const text = raw.trim() ? raw : null;
    return { text, ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { text: null, ok: false, reason: 'error', message };
  }
}
