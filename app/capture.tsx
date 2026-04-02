import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { saveFileToArchive } from '@/services/StorageService';
import { getTotalFileCount } from '@/db/documents';
import { useAppStore } from '@/store/app-store';
import { authFlags } from '@/store/auth-flags';
import type { FileType } from '@/db/types';
import { LimitReachedDialog, PaywallModal, ProIncludedFeatureDialog } from '@/components/ui';
import { createPdfFromImages } from '@/services/PdfService';
import { extractTextFromImageIfAvailable } from '@/services/ocrExtract';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { getFreeLimit, getOcrReadTrialsRemaining } from '@/services/limits';
import {
  OCR_LANGUAGE_CATEGORIES,
  getOcrLanguageLabel,
  type OcrLanguageCode,
} from '@/services/ocrLanguages';
import { MULTI_PAGE_TESTED_LIMIT } from '@/services/performanceTargets';
import { recordPerformanceMetric } from '@/services/performanceMetrics';
import { recordOcrPageMetric } from '@/services/ocrMetrics';
import {
  isAndroidMlKitScannerPlatform,
  launchVaultMlKitScan,
} from '@/services/mlKitDocumentScan';

const FREE_DOCUMENT_LIMIT = getFreeLimit('documents');
const PDF_BUILD_TIMEOUT_MS = 6 * 60 * 1000;
/** Fixed PDF page layout when merging camera pages (same as previous default). */
const DEFAULT_PDF_PAGE_PLACEMENT: 'fill' | 'fit' = 'fill';
type OcrProcessingMode = 'auto' | 'document' | 'receipt' | 'handwritten';
const OCR_PAGE_TIMEOUT_MS = 8000;

/** JPEG quality for multi-page Expo Camera captures — scales down with page count for stability (former “Balanced” preset). */
function getMultiPageCaptureQuality(pageCount: number): number {
  if (pageCount >= 800) return 0.02;
  if (pageCount >= 600) return 0.03;
  if (pageCount >= 400) return 0.04;
  if (pageCount >= 250) return 0.06;
  if (pageCount >= 100) return 0.08;
  if (pageCount >= 20) return 0.12;
  if (pageCount >= 10) return 0.2;
  return 0.35;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isWeakOcrText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 30) return true;
  const letters = (t.match(/[A-Za-z\u00C0-\u024F\u0100-\u017F]/g) ?? []).length;
  return letters / Math.max(1, t.length) < 0.35;
}

export default function CaptureScreen() {
  const { tab: paramTab } = useLocalSearchParams<{ tab?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [multiPageMode, setMultiPageMode] = useState(false);
  const [multiPageImages, setMultiPageImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'camera' | 'import'>(
    paramTab === 'import' ? 'import' : 'camera'
  );
  /** Hub screen before camera/import; avoids auto-opening ML Kit until the user chooses a path. */
  const [flowPhase, setFlowPhase] = useState<'chooser' | 'active'>('chooser');
  const [limitVisible, setLimitVisible] = useState(false);
  const [limitKind, setLimitKind] = useState<'documents'>('documents');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showLongOpOverlay, setShowLongOpOverlay] = useState(false);
  const [longOpMessage, setLongOpMessage] = useState('Loading, this may take a few minutes');
  const [longOpPercent, setLongOpPercent] = useState<number | null>(null);
  const [stressTargetPickerVisible, setStressTargetPickerVisible] = useState(false);
  const [multiPageDisclaimerVisible, setMultiPageDisclaimerVisible] = useState(false);
  const [multiPageDontShowAgain, setMultiPageDontShowAgain] = useState(false);
  const [mlKitScannerWarningVisible, setMlKitScannerWarningVisible] = useState(false);
  const [mlKitScannerDontShowAgain, setMlKitScannerDontShowAgain] = useState(false);
  const [pendingAfterUpgradeAction, setPendingAfterUpgradeAction] = useState<null | 'capture' | 'finishMultiPage'>(null);
  const [ocrOptionsVisible, setOcrOptionsVisible] = useState(false);
  const [proMultiPagePitchVisible, setProMultiPagePitchVisible] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const finishingMultiPageRef = useRef(false);
  const captureStartedAtRef = useRef<number | null>(null);
  /** When set, handleFinishMultiPageUnsafe builds PDF from these URIs (Android ML Kit) instead of multiPageImages. */
  const mlKitPendingUrisRef = useRef<string[] | null>(null);

  /** Android dev builds with ML Kit: skip Expo Camera preview and open the document scanner directly. */
  const androidMlKitDirect =
    Platform.OS === 'android' && isAndroidMlKitScannerPlatform();

  const isPro = useAppStore((s) => s.isPro);
  const ocrReadTrialsUsed = useAppStore((s) => s.ocrReadTrialsUsed);
  const firstLaunchAt = useAppStore((s) => s.firstLaunchAt);
  const ocrExtractOnCapture = useAppStore((s) => s.ocrExtractOnCapture);
  const setOcrExtractOnCapture = useAppStore((s) => s.setOcrExtractOnCapture);
  const consumeOcrReadTrial = useAppStore((s) => s.consumeOcrReadTrial);
  const setPendingOcrText = useAppStore((s) => s.setPendingOcrText);
  const showToast = useAppStore((s) => s.showToast);
  const multiPageLimitDisclaimerDismissed = useAppStore((s) => s.multiPageLimitDisclaimerDismissed);
  const setMultiPageLimitDisclaimerDismissed = useAppStore((s) => s.setMultiPageLimitDisclaimerDismissed);
  const mlKitMultiPageWarningDismissed = useAppStore((s) => s.mlKitMultiPageWarningDismissed);
  const setMlKitMultiPageWarningDismissed = useAppStore((s) => s.setMlKitMultiPageWarningDismissed);
  const ocrProcessingMode = useAppStore((s) => s.ocrProcessingMode);
  const setOcrProcessingMode = useAppStore((s) => s.setOcrProcessingMode);
  const ocrLanguage = useAppStore((s) => s.ocrLanguage);
  const setOcrLanguage = useAppStore((s) => s.setOcrLanguage);
  const ocrExtractActive = ocrExtractOnCapture;
  const loadSettings = useAppStore((s) => s.loadSettings);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings])
  );

  useEffect(() => {
    if (!isPro && multiPageMode) {
      setMultiPageMode(false);
      setMultiPageImages([]);
    }
  }, [isPro, multiPageMode]);

  const ocrReadsRemaining = getOcrReadTrialsRemaining(ocrReadTrialsUsed, firstLaunchAt);
  const headerTitle =
    flowPhase === 'chooser'
      ? 'Add document'
      : activeTab === 'camera' && !isPro
        ? `Add Document (${ocrReadsRemaining} free read${ocrReadsRemaining === 1 ? '' : 's'} left)`
        : 'Add Document';

  // Prevent lock from showing when app goes to background while on this screen (e.g. picker or back).
  useEffect(() => {
    authFlags.systemPickerOpen = true;
    return () => {
      authFlags.systemPickerOpen = false;
    };
  }, []);

  useEffect(() => {
    if (androidMlKitDirect) return;
    if (activeTab === 'camera' && !permission?.granted) {
      requestPermission();
    }
  }, [activeTab, permission?.granted, requestPermission, androidMlKitDirect]);

  useEffect(() => {
    if (!capturing) {
      setShowLongOpOverlay(false);
      captureStartedAtRef.current = null;
      setLongOpMessage('Loading, this may take a few minutes');
      setLongOpPercent(null);
      return;
    }
    captureStartedAtRef.current = Date.now();
    const timeoutId = setTimeout(() => {
      setShowLongOpOverlay(true);
      if (captureStartedAtRef.current != null) {
        void recordPerformanceMetric('show_progress_latency', Date.now() - captureStartedAtRef.current);
      }
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [capturing]);

  const checkSlotLimit = async (): Promise<boolean> => {
    const { isPro } = useAppStore.getState();
    if (isPro) return true;
    const totalFiles = await getTotalFileCount();
    if (totalFiles >= FREE_DOCUMENT_LIMIT) {
      setLimitKind('documents');
      setLimitVisible(true);
      return false;
    }
    return true;
  };

  const handleFinishMultiPage = async () => {
    if (capturing) return;
    if (finishingMultiPageRef.current) {
      return;
    }
    if (multiPageImages.length === 0) return;
    if (multiPageImages.length > MULTI_PAGE_TESTED_LIMIT) {
      Alert.alert(
        'Large run warning',
        `This export has ${multiPageImages.length} pages. Your device may run out of memory above ${MULTI_PAGE_TESTED_LIMIT} pages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Save first ${MULTI_PAGE_TESTED_LIMIT}`,
            onPress: () => {
              const firstPart = multiPageImages.slice(0, MULTI_PAGE_TESTED_LIMIT);
              if (firstPart.length === 0) return;
              setMultiPageImages(firstPart);
              showToast(
                `Prepared first ${MULTI_PAGE_TESTED_LIMIT} pages. Tap Finish again to export safely.`,
                'info'
              );
            },
          },
          {
            text: 'Continue anyway',
            style: 'destructive',
            onPress: () => {
              finishingMultiPageRef.current = false;
              setTimeout(() => {
                void handleFinishMultiPageUnsafe();
              }, 0);
            },
          },
        ]
      );
      return;
    }
    await handleFinishMultiPageUnsafe();
  };

  const handleFinishMultiPageUnsafe = async () => {
    if (capturing) return;
    if (finishingMultiPageRef.current) {
      return;
    }
    const fromMlKitFlow = mlKitPendingUrisRef.current != null;
    const pageUris =
      fromMlKitFlow && mlKitPendingUrisRef.current && mlKitPendingUrisRef.current.length > 0
        ? mlKitPendingUrisRef.current
        : multiPageImages;
    if (pageUris.length === 0) return;
    finishingMultiPageRef.current = true;
    setPendingAfterUpgradeAction('finishMultiPage');
    if (!(await checkSlotLimit())) {
      finishingMultiPageRef.current = false;
      return;
    }
    setPendingAfterUpgradeAction(null);
    const flowStartedAt = Date.now();
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Multi-scan generates a PDF, but OCR must run against the original page images.
      let preExtractedOcrText: string | null = null;
      if (ocrExtractOnCapture) {
        const pageResults: Array<string | null> = new Array(pageUris.length).fill(null);
        const weakPageIndexes: number[] = [];
        const totalPages = pageUris.length;
        setShowLongOpOverlay(true);
        // Extract sequentially for stability (native OCR is CPU/GPU heavy).
        for (let pageIndex = 0; pageIndex < pageUris.length; pageIndex++) {
          setLongOpMessage(`Reading text: page ${pageIndex + 1} of ${totalPages}`);
          setLongOpPercent(Math.round(((pageIndex) / totalPages) * 50));
          const pageUri = pageUris[pageIndex];
          const ocrPageStartedAt = Date.now();
          const result = await withTimeout(
            extractTextFromImageIfAvailable(pageUri, { mode: ocrProcessingMode, language: ocrLanguage }),
            OCR_PAGE_TIMEOUT_MS,
            'OCR page timed out'
          ).catch(() => ({ ok: false as const, text: null, reason: 'error' as const, message: 'OCR timeout' }));
          if (!result.ok) {
            await recordOcrPageMetric({
              latencyMs: Date.now() - ocrPageStartedAt,
              failed: true,
              timedOut: /timeout/i.test(result.message ?? ''),
            });
            if (result.reason === 'expo-go') {
              try {
                  await setOcrExtractOnCapture(false);
                  showToast(
                    'Text extraction from photos needs a development build. Turn it on from Add → Camera or Import (text from photo) after installing one.',
                    'info'
                  );
              } catch {
                // ignore
              }
              for (let i = 0; i < pageResults.length; i += 1) {
                pageResults[i] = null;
              }
              break;
            }
              if (result.reason === 'web') break;
            if (result.reason === 'unsupported') break;
            if (result.reason === 'error') {
              if (__DEV__) console.warn('[OCR]', result.message);
              showToast('OCR failed on this page. Try better lighting or steadier capture.', 'info');
            }
            continue;
          }
          if (result.text && result.text.trim()) {
            const weak = isWeakOcrText(result.text);
            if (weak) weakPageIndexes.push(pageIndex);
            await recordOcrPageMetric({
              latencyMs: Date.now() - ocrPageStartedAt,
              weak,
            });
            const consumed = await consumeOcrReadTrial();
            if (!consumed) break;
            pageResults[pageIndex] = result.text.trim();
          }
        }

        // Retry weak pages once with document mode for cleaner output.
        if (weakPageIndexes.length > 0) {
          setLongOpMessage(`Retrying ${weakPageIndexes.length} weak page(s)…`);
          setLongOpPercent(50);
          for (let ri = 0; ri < weakPageIndexes.length; ri++) {
            const weakIndex = weakPageIndexes[ri];
            setLongOpPercent(50 + Math.round(((ri) / weakPageIndexes.length) * 10));
            const pageUri = pageUris[weakIndex];
            const retryStartedAt = Date.now();
            const retried = await withTimeout(
              extractTextFromImageIfAvailable(pageUri, { mode: 'document', language: ocrLanguage }),
              OCR_PAGE_TIMEOUT_MS,
              'OCR retry timed out'
            ).catch(() => ({ ok: false as const, text: null, reason: 'error' as const, message: 'OCR retry timeout' }));
            if (!retried.ok || !retried.text?.trim()) {
              const retryMessage = !retried.ok ? retried.message ?? '' : '';
              await recordOcrPageMetric({
                latencyMs: Date.now() - retryStartedAt,
                retried: true,
                failed: true,
                timedOut: /timeout/i.test(retryMessage),
              });
              continue;
            }
            const improved = !isWeakOcrText(retried.text);
            await recordOcrPageMetric({
              latencyMs: Date.now() - retryStartedAt,
              retried: true,
              improved,
            });
            if (improved) {
              pageResults[weakIndex] = retried.text.trim();
            }
          }
          showToast('OCR retry completed for weak pages.', 'info');
        }

        const finalizedPages = pageResults
          .map((text, idx) => (text ? { pageNumber: idx + 1, text } : null))
          .filter((v): v is { pageNumber: number; text: string } => v != null);

        if (finalizedPages.length > 0) {
          preExtractedOcrText = finalizedPages
            .map((p) => `=== Page ${p.pageNumber} ===\n${p.text}`)
            .join('\n\n');
        }
      }

      // PDF generation occupies 60-100% of the progress bar (OCR occupied 0-60%).
      const PDF_BASE_PCT = 60;
      const updatePdfProgress = (progress: { stage: 'chunk' | 'merge' | 'finalize'; current: number; total: number }) => {
        const safeRatio = progress.total > 0 ? progress.current / progress.total : 0;
        if (progress.stage === 'chunk') {
          const pct = Math.max(PDF_BASE_PCT, Math.min(PDF_BASE_PCT + 28, PDF_BASE_PCT + Math.round(safeRatio * 28)));
          setLongOpPercent(pct);
          setLongOpMessage(`Preparing PDF chunks (${progress.current}/${progress.total})`);
          return;
        }
        if (progress.stage === 'merge') {
          const pct = Math.max(88, Math.min(97, 88 + Math.round(safeRatio * 9)));
          setLongOpPercent(pct);
          setLongOpMessage(`Merging PDF parts (${progress.current}/${progress.total})`);
          return;
        }
        setLongOpPercent(99);
        setLongOpMessage('Finalizing PDF file');
      };

      const pdfTempUri = await withTimeout(
        createPdfFromImages(pageUris, updatePdfProgress, { pagePlacementMode: DEFAULT_PDF_PAGE_PLACEMENT }),
        PDF_BUILD_TIMEOUT_MS,
        'PDF generation timed out'
      );
      const pdfName = `scan_${Date.now()}.pdf`;
      const permanentUri = await saveFileToArchive(pdfTempUri, pdfName);
      void recordPerformanceMetric('scan_to_pdf', Date.now() - flowStartedAt);

      setPendingOcrText(
        preExtractedOcrText
          ? { fileUri: permanentUri, fileType: 'pdf', ocrText: preExtractedOcrText }
          : null
      );

      setMultiPageImages([]);
      setMultiPageMode(false);
      router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'pdf' } });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isLikelyMemoryIssue = /OutOfMemoryError|memory|allocate|OOM/i.test(errorMessage);
      const isLikelyTimeout = /timed out/i.test(errorMessage);
      const pageCount = pageUris.length;
      const sectionHint = `${MULTI_PAGE_TESTED_LIMIT}-page`;
      const primaryMessage = isLikelyTimeout
        ? `PDF creation took too long on this device. Try ${sectionHint} sections for faster and safer results.`
        : isLikelyMemoryIssue || pageCount > MULTI_PAGE_TESTED_LIMIT
          ? `This run is too large for your device memory. Try ${sectionHint} sections for better stability.`
          : 'Could not create the PDF. Please try again.';

      const saveSection = async (sectionSize: number) => {
        if (capturing) return;
        if (pageUris.length === 0) return;
        if (!(await checkSlotLimit())) return;

        const currentPages = [...pageUris];
        const sectionPages = currentPages.slice(0, sectionSize);
        const remainingPages = currentPages.slice(sectionPages.length);
        if (sectionPages.length === 0) return;

        const sectionFlowStartedAt = Date.now();
        setCapturing(true);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const pdfTempUri = await withTimeout(createPdfFromImages(sectionPages, (progress) => {
            const safeRatio = progress.total > 0 ? progress.current / progress.total : 0;
            if (progress.stage === 'chunk') {
              const pct = Math.max(1, Math.min(70, Math.round(safeRatio * 70)));
              setLongOpPercent(pct);
              setLongOpMessage(`Preparing PDF chunks (${progress.current}/${progress.total})`);
              return;
            }
            if (progress.stage === 'merge') {
              const pct = Math.max(71, Math.min(95, 70 + Math.round(safeRatio * 25)));
              setLongOpPercent(pct);
              setLongOpMessage(`Merging PDF parts (${progress.current}/${progress.total})`);
              return;
            }
            setLongOpPercent(99);
            setLongOpMessage('Finalizing PDF file');
          }, { pagePlacementMode: DEFAULT_PDF_PAGE_PLACEMENT }), PDF_BUILD_TIMEOUT_MS, 'PDF generation timed out');
          const pdfName = `scan_part_${Date.now()}.pdf`;
          const permanentUri = await saveFileToArchive(pdfTempUri, pdfName);
          void recordPerformanceMetric('scan_to_pdf', Date.now() - sectionFlowStartedAt);

          setPendingOcrText(null);
          if (!fromMlKitFlow) {
            setMultiPageImages(remainingPages);
            setMultiPageMode(remainingPages.length > 0);
          }
          showToast(
            remainingPages.length > 0
              ? `Saved first ${sectionPages.length} pages. ${remainingPages.length} pages remain.`
              : `Saved ${sectionPages.length} pages successfully.`,
            'success'
          );
          router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'pdf' } });
        } catch {
          Alert.alert('PDF Failed', 'Section export failed. Please reduce the section size and retry.');
        } finally {
          setCapturing(false);
        }
      };

      const actions: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
        { text: 'Retry', onPress: () => { void handleFinishMultiPage(); } },
      ];

      if (pageCount > MULTI_PAGE_TESTED_LIMIT || isLikelyMemoryIssue || isLikelyTimeout) {
        actions.push({
          text: `Save first ${MULTI_PAGE_TESTED_LIMIT} pages`,
          onPress: () => { void saveSection(MULTI_PAGE_TESTED_LIMIT); },
        });
      }

      actions.push({ text: 'Close', style: 'cancel' });
      Alert.alert('PDF Failed', primaryMessage, actions);
    } finally {
      finishingMultiPageRef.current = false;
      setCapturing(false);
    }
  };

  /** Avoid unhandled GO_BACK when capture is the only stack entry (e.g. cold open). */
  const leaveCaptureScreen = useCallback(() => {
    const can = router.canGoBack();
    if (can) {
      router.back();
    } else {
      router.replace('/(drawer)');
    }
  }, []);

  const runAndroidMlKitDocumentScan = useCallback(
    async (options?: { skipMlKitMultiPageWarning?: boolean }) => {
    if (capturing) return;
    if (
      multiPageMode &&
      !mlKitMultiPageWarningDismissed &&
      !options?.skipMlKitMultiPageWarning
    ) {
      setMlKitScannerDontShowAgain(false);
      setMlKitScannerWarningVisible(true);
      return;
    }
    setPendingAfterUpgradeAction('capture');
    if (!(await checkSlotLimit())) {
      return;
    }
    setPendingAfterUpgradeAction(null);

    const flowStartedAt = Date.now();
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const scan = await launchVaultMlKitScan(multiPageMode);
      if (!scan.ok) {
        if (scan.canceled) {
          leaveCaptureScreen();
          return;
        }
        if (scan.message) {
          Alert.alert('Document scan', scan.message);
        }
        return;
      }

      const permanentUris: string[] = [];
      for (const uri of scan.pageUris) {
        permanentUris.push(await saveFileToArchive(uri));
      }

      if (permanentUris.length === 1) {
        void recordPerformanceMetric('scan_to_preview', Date.now() - flowStartedAt);
        const permanentUri = permanentUris[0];
        router.replace({
          pathname: '/document/[id]',
          params: { id: 'new', fileUri: permanentUri, fileType: 'image' },
        });
        return;
      }

      setCapturing(false);
      mlKitPendingUrisRef.current = permanentUris;
      try {
        await handleFinishMultiPageUnsafe();
      } finally {
        mlKitPendingUrisRef.current = null;
      }
    } catch {
      Alert.alert('Capture Failed', 'Could not complete the document scan. Please try again.');
    } finally {
      setCapturing(false);
    }
  },
  [capturing, leaveCaptureScreen, mlKitMultiPageWarningDismissed, multiPageMode]
);

  const handleCapture = async () => {
    if (capturing) return;

    if (androidMlKitDirect) {
      await runAndroidMlKitDocumentScan();
      return;
    }

    if (!cameraRef.current) {
      return;
    }

    setPendingAfterUpgradeAction('capture');
    if (!multiPageMode) {
      if (!(await checkSlotLimit())) {
        return;
      }
    } else {
      const { isPro } = useAppStore.getState();
      if (!isPro) {
        const totalFiles = await getTotalFileCount();
        if (totalFiles >= FREE_DOCUMENT_LIMIT) {
          setLimitKind('documents');
          setLimitVisible(true);
          return;
        }
      }
    }
    setPendingAfterUpgradeAction(null);

    if (!cameraRef.current) return;
    const flowStartedAt = Date.now();
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const captureQuality = multiPageMode ? getMultiPageCaptureQuality(multiPageImages.length) : 0.9;
      const photo = await cameraRef.current.takePictureAsync({ quality: captureQuality });
      if (!photo?.uri) return;
      if (multiPageMode) {
        setMultiPageImages((prev) => [...prev, photo.uri]);
        return;
      }
      const permanentUri = await saveFileToArchive(photo.uri);
      void recordPerformanceMetric('scan_to_preview', Date.now() - flowStartedAt);
      router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'image' } });
    } catch (error) {
      Alert.alert('Capture Failed', 'Could not capture the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!androidMlKitDirect || activeTab !== 'camera' || flowPhase !== 'active') {
        return () => {};
      }
      let cancelled = false;
      const id = setTimeout(() => {
        if (!cancelled) {
          void runAndroidMlKitDocumentScan();
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }, [androidMlKitDirect, activeTab, flowPhase, runAndroidMlKitDocumentScan])
  );

  const toggleMultiPageMode = useCallback(() => {
    if (!isPro) {
      setProMultiPagePitchVisible(true);
      return;
    }
    if (multiPageMode) {
      setMultiPageMode(false);
      setMultiPageImages([]);
      return;
    }
    if (!multiPageLimitDisclaimerDismissed) {
      setMultiPageDontShowAgain(false);
      setMultiPageDisclaimerVisible(true);
      return;
    }
    setMultiPageMode(true);
  }, [isPro, multiPageMode, multiPageLimitDisclaimerDismissed]);

  const beginActiveCameraFlow = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlowPhase('active');
    setActiveTab('camera');
  }, []);

  const beginActiveImportFlow = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlowPhase('active');
    setActiveTab('import');
  }, []);

  const handleAutoStressCapture = async (targetCount: number) => {
    if (!isPro || !cameraRef.current || capturing) return;
    if (targetCount <= 0) return;
    try {
      const flowStartedAt = Date.now();
      setCapturing(true);
      setMultiPageMode(true);
      setMultiPageImages([]);
      const capturedUris: string[] = [];
      for (let index = 0; index < targetCount; index += 1) {
        const captureQuality = getMultiPageCaptureQuality(index);
        const photo = await cameraRef.current.takePictureAsync({ quality: captureQuality });
        if (!photo?.uri) {
          throw new Error(`Camera returned empty URI at index ${index}`);
        }
        capturedUris.push(photo.uri);
      }
      setMultiPageImages(capturedUris);
      void recordPerformanceMetric('scan_to_preview', Date.now() - flowStartedAt);
      Alert.alert(
        'Stress Capture Complete',
        `Captured ${capturedUris.length}/${targetCount} photos automatically. Tap Finish to test PDF creation.`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Stress Capture Failed', errorMessage);
    } finally {
      setCapturing(false);
    }
  };

  const handleImportImage = async () => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      if (result.assets.length === 1) {
        const permanentUri = await saveFileToArchive(result.assets[0].uri);
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'image' } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (const asset of result.assets) {
        const permanentUri = await saveFileToArchive(asset.uri);
        const name = (asset as any)?.fileName || (asset as any)?.filename;
        bulk.push({ fileUri: permanentUri, fileType: 'image', name });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the images. Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportPdf = async () => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: Platform.OS === 'android',
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      if (result.assets.length === 1) {
        const permanentUri = await saveFileToArchive(result.assets[0].uri, `doc_${Date.now()}.pdf`);
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'pdf' } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const inferredName = asset.name || `doc_${Date.now()}_${i}.pdf`;
        const permanentUri = await saveFileToArchive(asset.uri, inferredName);
        bulk.push({ fileUri: permanentUri, fileType: 'pdf', name: inferredName });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the PDF(s). Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportDocuments = async (
    pickerType: string | string[],
    fileType: FileType,
    defaultExt: string
  ) => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerType,
        copyToCacheDirectory: true,
        multiple: Platform.OS === 'android',
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      const getFileName = (uri: string, name?: string, i?: number) => {
        const ext = name?.split('.').pop()?.toLowerCase() || defaultExt;
        return name && /\.(docx?|xlsx?|txt|csv)$/i.test(name) ? name : `doc_${Date.now()}${i !== undefined ? `_${i}` : ''}.${ext}`;
      };
      if (result.assets.length === 1) {
        const asset = result.assets[0];
        const permanentUri = await saveFileToArchive(asset.uri, getFileName(asset.uri, asset.name));
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const pickedName = getFileName(asset.uri, asset.name, i);
        const permanentUri = await saveFileToArchive(asset.uri, pickedName);
        bulk.push({ fileUri: permanentUri, fileType, name: pickedName });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the file(s). Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportWord = () =>
    handleImportDocuments(
      [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      'word',
      'docx'
    );

  const handleImportExcel = () =>
    handleImportDocuments(
      [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      'excel',
      'xlsx'
    );

  const handleImportOther = () =>
    handleImportDocuments(
      ['text/plain', 'text/csv', 'application/csv'],
      'document',
      'txt'
    );

  return (
    <>
      <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leaveCaptureScreen} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerBtn} />
      </View>

      {flowPhase === 'chooser' ? (
        <ScrollView
          style={styles.chooserScroll}
          contentContainerStyle={styles.chooserScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.chooserHeadline}>Add a document</Text>
          <Text style={styles.chooserLead}>
            Choose how to capture or import. Turn on text extraction only when you need it; it uses your free OCR reads on the free plan.
          </Text>

          <View style={styles.chooserChipRow}>
            <TouchableOpacity
              style={[styles.multiChip, ocrExtractActive && styles.multiChipActive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await setOcrExtractOnCapture(!ocrExtractActive);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="text-outline" size={16} color={ocrExtractActive ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.multiChipText, ocrExtractActive && styles.multiChipTextActive]}>
                Text from photo (OCR)
              </Text>
              {!isPro && (
                <View style={styles.multiCount}>
                  <Text style={styles.multiCountText}>{ocrReadsRemaining}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.multiChip} onPress={() => setOcrOptionsVisible(true)} activeOpacity={0.7}>
              <Ionicons name="options-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.multiChipText}>OCR options</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.multiChip, styles.chooserMultiRow, isPro && multiPageMode && styles.multiChipActive]}
            onPress={toggleMultiPageMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name="document-outline"
              size={16}
              color={isPro && multiPageMode ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[styles.multiChipText, isPro && multiPageMode && styles.multiChipTextActive]}
            >
              Multi-page PDF
            </Text>
            {!isPro ? (
              <View style={styles.multiCount}>
                <Text style={styles.multiCountText}>Pro</Text>
              </View>
            ) : null}
            {isPro && multiPageMode ? (
              <View style={styles.multiCount}>
                <Text style={styles.multiCountText}>{multiPageImages.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.chooserPrimaryCard} onPress={beginActiveCameraFlow} activeOpacity={0.75}>
            <View style={styles.chooserPrimaryIcon}>
              <Ionicons name="camera-outline" size={28} color={Colors.primary} />
            </View>
            <View style={styles.chooserPrimaryText}>
              <Text style={styles.chooserPrimaryTitle}>Scan with camera</Text>
              <Text style={styles.chooserPrimarySubtitle}>
                {androidMlKitDirect
                  ? 'Opens Google’s document scanner (crop, filters, multi-page when enabled above).'
                  : 'Use the camera to capture a page or multi-page set.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.chooserPrimaryCard} onPress={beginActiveImportFlow} activeOpacity={0.75}>
            <View style={[styles.chooserPrimaryIcon, styles.chooserPrimaryIconAlt]}>
              <Ionicons name="folder-open-outline" size={28} color={Colors.primary} />
            </View>
            <View style={styles.chooserPrimaryText}>
              <Text style={styles.chooserPrimaryTitle}>Import</Text>
              <Text style={styles.chooserPrimarySubtitle}>
                {androidMlKitDirect
                  ? 'Vault’s import picker first. You can open Google’s document scanner from the Import tab only if you want to crop there.'
                  : 'Photos, PDF, Word, Excel, and other files from your device.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'camera' && styles.tabActive]}
              onPress={() => setActiveTab('camera')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={activeTab === 'camera' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'import' && styles.tabActive]}
              onPress={() => setActiveTab('import')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="document-attach-outline"
                size={16}
                color={activeTab === 'import' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'import' && styles.tabTextActive]}>Import</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'camera' ? (
        <CameraTab
          permission={permission}
          requestPermission={requestPermission}
          cameraRef={cameraRef}
          facing={facing}
          flash={flash}
          capturing={capturing}
          onCapture={handleCapture}
          onFlipCamera={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          onToggleFlash={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          ocrExtractOnCapture={ocrExtractActive}
          onToggleOcrExtract={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await setOcrExtractOnCapture(!ocrExtractActive);
          }}
          onOpenOcrOptions={() => setOcrOptionsVisible(true)}
          ocrReadsRemaining={ocrReadsRemaining}
          isPro={isPro}
          multiPageMode={multiPageMode}
          pageCount={multiPageImages.length}
          onToggleMultiPage={toggleMultiPageMode}
          onFinishMultiPage={handleFinishMultiPage}
          onAutoStressCapture={() => {
            setStressTargetPickerVisible(true);
          }}
          mlKitDirectPlaceholder={androidMlKitDirect}
          onRetryMlKit={() => {
            void runAndroidMlKitDocumentScan();
          }}
        />
          ) : (
            <ImportTab
              ocrExtractOnCapture={ocrExtractActive}
              onToggleOcrExtract={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await setOcrExtractOnCapture(!ocrExtractActive);
              }}
              onOpenOcrOptions={() => setOcrOptionsVisible(true)}
              ocrReadsRemaining={ocrReadsRemaining}
              isPro={isPro}
              mlKitScannerOptional={androidMlKitDirect}
              onOpenMlKitDocumentScanner={() => {
                void runAndroidMlKitDocumentScan();
              }}
              onImportImage={handleImportImage}
              onImportPdf={handleImportPdf}
              onImportWord={handleImportWord}
              onImportExcel={handleImportExcel}
              onImportOther={handleImportOther}
            />
          )}
        </>
      )}
    </SafeAreaView>
      <LimitReachedDialog
        visible={limitVisible}
        kind={limitKind}
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          const actionToRetry = pendingAfterUpgradeAction;
          setPendingAfterUpgradeAction(null);
          if (actionToRetry === 'capture') {
            if (androidMlKitDirect) {
              await runAndroidMlKitDocumentScan();
            } else {
              await handleCapture();
            }
          } else if (actionToRetry === 'finishMultiPage') {
            await handleFinishMultiPage();
          }
        }}
        onManage={() => router.replace('/(drawer)')}
      />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={() => {
          setPaywallVisible(false);
        }}
        onRestore={() => {
          setPaywallVisible(false);
        }}
      />
      <ProIncludedFeatureDialog
        visible={proMultiPagePitchVisible}
        onClose={() => setProMultiPagePitchVisible(false)}
        featureDescription="Combine several scans into a single multi-page PDF. Unlock Pro to use this feature."
        onUpgrade={() => {
          setProMultiPagePitchVisible(false);
        }}
      />
      <Modal visible={showLongOpOverlay} transparent animationType="fade">
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.blockingBody}>{longOpMessage}</Text>
            {longOpPercent != null ? (
              <Text style={styles.blockingPercent}>{longOpPercent}%</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={stressTargetPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStressTargetPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.stressPickerOverlay}
          activeOpacity={1}
          onPress={() => setStressTargetPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.stressPickerCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.stressPickerTitle}>Auto Stress Test</Text>
            <Text style={styles.stressPickerHint}>Choose target capture count</Text>
            {[50, 100, 150].map((target) => (
              <TouchableOpacity
                key={target}
                style={styles.stressPickerBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setStressTargetPickerVisible(false);
                  void handleAutoStressCapture(target);
                }}
              >
                <Text style={styles.stressPickerBtnText}>{target}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.stressPickerBtn, styles.stressPickerCancelBtn]}
              activeOpacity={0.8}
              onPress={() => setStressTargetPickerVisible(false)}
            >
              <Text style={styles.stressPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={ocrOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOcrOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.stressPickerOverlay}
          activeOpacity={1}
          onPress={() => setOcrOptionsVisible(false)}
        >
          <TouchableOpacity
            style={[styles.stressPickerCard, styles.ocrOptionsCard]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.stressPickerTitle}>OCR options</Text>
            <Text style={styles.stressPickerHint}>Tune OCR behavior for clearer extraction.</Text>
            <Text style={styles.ocrOptionLabel}>Mode</Text>
            <View style={styles.ocrLangRow}>
              {(['auto', 'document', 'receipt', 'handwritten'] as const).map((mode) => {
                const active = ocrProcessingMode === mode;
                const label =
                  mode === 'auto' ? 'Auto' : mode === 'document' ? 'Document' : mode === 'receipt' ? 'Receipt' : 'Handwritten';
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.profileChip, active && styles.profileChipActive]}
                    onPress={async () => {
                      await setOcrProcessingMode(mode as OcrProcessingMode);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.profileChipText, active && styles.profileChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.ocrOptionLabel}>Language</Text>
            <ScrollView
              style={styles.ocrOptionsScroll}
              contentContainerStyle={styles.ocrOptionsScrollContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {OCR_LANGUAGE_CATEGORIES.map((category, catIdx) => (
                <View key={category.title} style={styles.ocrLangCategory}>
                  <Text style={[styles.ocrCategoryTitle, catIdx === 0 && styles.ocrCategoryTitleFirst]}>
                    {category.title}
                  </Text>
                  <View style={styles.ocrLangRow}>
                    {category.codes.map((code) => {
                      const active = ocrLanguage === code;
                      return (
                        <TouchableOpacity
                          key={code}
                          style={[styles.profileChip, active && styles.profileChipActive]}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            await setOcrLanguage(code);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[styles.profileChipText, active && styles.profileChipTextActive]}
                            numberOfLines={2}
                          >
                            {getOcrLanguageLabel(code)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.stressPickerBtn, styles.stressPickerCancelBtn]}
              activeOpacity={0.8}
              onPress={() => setOcrOptionsVisible(false)}
            >
              <Text style={styles.stressPickerCancelText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={multiPageDisclaimerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMultiPageDisclaimerVisible(false)}
      >
        <TouchableOpacity
          style={styles.stressPickerOverlay}
          activeOpacity={1}
          onPress={() => setMultiPageDisclaimerVisible(false)}
        >
          <TouchableOpacity
            style={styles.stressPickerCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.stressPickerTitle}>Multi-page PDF notice</Text>
            <Text style={styles.stressPickerHint}>
              Multi-page scan has been tested up to {MULTI_PAGE_TESTED_LIMIT} images. More than that may cause errors. For long books or
              files, scan in sections.
            </Text>
            <TouchableOpacity
              style={styles.disclaimerCheckRow}
              activeOpacity={0.8}
              onPress={() => setMultiPageDontShowAgain((v) => !v)}
            >
              <Ionicons
                name={multiPageDontShowAgain ? 'checkbox-outline' : 'square-outline'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.disclaimerCheckText}>Do not show this again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stressPickerBtn}
              activeOpacity={0.8}
              onPress={async () => {
                if (multiPageDontShowAgain) {
                  await setMultiPageLimitDisclaimerDismissed(true);
                }
                setMultiPageDisclaimerVisible(false);
                setMultiPageMode(true);
              }}
            >
              <Text style={styles.stressPickerBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stressPickerBtn, styles.stressPickerCancelBtn]}
              activeOpacity={0.8}
              onPress={() => setMultiPageDisclaimerVisible(false)}
            >
              <Text style={styles.stressPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={mlKitScannerWarningVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMlKitScannerWarningVisible(false)}
      >
        <TouchableOpacity
          style={styles.stressPickerOverlay}
          activeOpacity={1}
          onPress={() => setMlKitScannerWarningVisible(false)}
        >
          <TouchableOpacity
            style={styles.stressPickerCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.stressPickerTitle}>Document scanner</Text>
            <Text style={styles.stressPickerHint}>
              Google&apos;s multi-page scanner allows a maximum of {MULTI_PAGE_TESTED_LIMIT} pages per session. For longer
              documents, finish one scan and start another.
            </Text>
            <TouchableOpacity
              style={styles.disclaimerCheckRow}
              activeOpacity={0.8}
              onPress={() => setMlKitScannerDontShowAgain((v) => !v)}
            >
              <Ionicons
                name={mlKitScannerDontShowAgain ? 'checkbox-outline' : 'square-outline'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.disclaimerCheckText}>Do not show this again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stressPickerBtn}
              activeOpacity={0.8}
              onPress={async () => {
                if (mlKitScannerDontShowAgain) {
                  await setMlKitMultiPageWarningDismissed(true);
                }
                setMlKitScannerWarningVisible(false);
                void runAndroidMlKitDocumentScan({ skipMlKitMultiPageWarning: true });
              }}
            >
              <Text style={styles.stressPickerBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stressPickerBtn, styles.stressPickerCancelBtn]}
              activeOpacity={0.8}
              onPress={() => setMlKitScannerWarningVisible(false)}
            >
              <Text style={styles.stressPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

type CameraTabProps = {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  cameraRef: React.RefObject<CameraView | null>;
  facing: 'back' | 'front';
  flash: 'off' | 'on';
  capturing: boolean;
  onCapture: () => void;
  onFlipCamera: () => void;
  onToggleFlash: () => void;
  ocrExtractOnCapture: boolean;
  onToggleOcrExtract: () => void | Promise<void>;
  onOpenOcrOptions: () => void;
  ocrReadsRemaining: number;
  isPro: boolean;
  multiPageMode: boolean;
  pageCount: number;
  onToggleMultiPage: () => void;
  onFinishMultiPage: () => void;
  onAutoStressCapture: () => void;
  /** Android + ML Kit: no Expo Camera preview; scanner opens from the screen focus. */
  mlKitDirectPlaceholder?: boolean;
  onRetryMlKit?: () => void;
};

function CameraTab({
  permission,
  requestPermission,
  cameraRef,
  facing,
  flash,
  capturing,
  onCapture,
  onFlipCamera,
  onToggleFlash,
  ocrExtractOnCapture,
  onToggleOcrExtract,
  onOpenOcrOptions,
  ocrReadsRemaining,
  isPro,
  multiPageMode,
  pageCount,
  onToggleMultiPage,
  onFinishMultiPage,
  onAutoStressCapture,
  mlKitDirectPlaceholder,
  onRetryMlKit,
}: CameraTabProps) {
  if (mlKitDirectPlaceholder) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.permissionTitle}>Document scanner</Text>
        <Text style={styles.permissionSubtitle}>
          Google&apos;s scanner opens automatically. One page saves as an image; multiple pages are merged into one PDF
          with a fixed layout tuned for clarity and stability.
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => onRetryMlKit?.()}
          activeOpacity={0.8}
          disabled={capturing}
        >
          <Text style={styles.permissionBtnText}>{capturing ? 'Working…' : 'Scan again'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.multiChip} onPress={onOpenOcrOptions} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.multiChipText}>OCR options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          Allow camera access to scan and capture documents directly.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.multiChip}
          onPress={onOpenOcrOptions}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.multiChipText}>OCR options</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <View style={styles.cameraPreview}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
        />
        <View pointerEvents="none" style={styles.cameraOverlay} />
      </View>

      <View style={styles.multiRow}>
        <TouchableOpacity
          style={[styles.multiChip, ocrExtractOnCapture && styles.multiChipActive]}
          onPress={onToggleOcrExtract}
          activeOpacity={0.7}
        >
          <Ionicons name="text-outline" size={16} color={ocrExtractOnCapture ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.multiChipText, ocrExtractOnCapture && styles.multiChipTextActive]}>
            Text from photo
          </Text>
          {!isPro && (
            <View style={styles.multiCount}>
              <Text style={styles.multiCountText}>{ocrReadsRemaining}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.multiChip, isPro && multiPageMode && styles.multiChipActive]}
          onPress={onToggleMultiPage}
          activeOpacity={0.7}
        >
          <Ionicons
            name="document-outline"
            size={16}
            color={isPro && multiPageMode ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.multiChipText, isPro && multiPageMode && styles.multiChipTextActive]}>
            Multi-page PDF
          </Text>
          {!isPro ? (
            <View style={styles.multiCount}>
              <Text style={styles.multiCountText}>Pro</Text>
            </View>
          ) : null}
          {isPro && multiPageMode ? (
            <View style={styles.multiCount}>
              <Text style={styles.multiCountText}>{pageCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {isPro && multiPageMode && (
          <TouchableOpacity
            style={[styles.multiFinishBtn, pageCount === 0 && styles.multiFinishBtnDisabled]}
            onPress={onFinishMultiPage}
            disabled={pageCount === 0 || capturing}
            activeOpacity={0.8}
          >
            <Text style={styles.multiFinishText}>Finish</Text>
          </TouchableOpacity>
        )}
        {__DEV__ && isPro && multiPageMode && (
          <TouchableOpacity
            style={styles.multiStressBtn}
            onPress={onAutoStressCapture}
            disabled={capturing}
            activeOpacity={0.8}
          >
            <Text style={styles.multiStressText}>Auto Stress</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.cameraControlBtn} onPress={onToggleFlash} activeOpacity={0.7}>
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={22}
            color={flash === 'on' ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={onCapture}
          activeOpacity={0.8}
          disabled={capturing}
        >
          {capturing ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <View style={styles.captureBtnInner} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cameraControlBtn} onPress={onFlipCamera} activeOpacity={0.7}>
          <Ionicons name="camera-reverse-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cameraHint}>
        Position the document within the frame. Turn on &quot;Text from photo&quot; only when you want on-device text
        extraction (uses your free OCR reads on the Free plan).
      </Text>
    </View>
  );
}

type ImportTabProps = {
  ocrExtractOnCapture: boolean;
  onToggleOcrExtract: () => void | Promise<void>;
  onOpenOcrOptions: () => void;
  ocrReadsRemaining: number;
  isPro: boolean;
  /** Android + ML Kit: show optional card to open Google’s scanner (never auto). */
  mlKitScannerOptional?: boolean;
  onOpenMlKitDocumentScanner?: () => void;
  onImportImage: () => void;
  onImportPdf: () => void;
  onImportWord: () => void;
  onImportExcel: () => void;
  onImportOther: () => void;
};

function ImportTab({
  ocrExtractOnCapture,
  onToggleOcrExtract,
  onOpenOcrOptions,
  ocrReadsRemaining,
  isPro,
  mlKitScannerOptional,
  onOpenMlKitDocumentScanner,
  onImportImage,
  onImportPdf,
  onImportWord,
  onImportExcel,
  onImportOther,
}: ImportTabProps) {
  return (
    <ScrollView
      style={styles.importScroll}
      contentContainerStyle={styles.importScrollContent}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.importTitle}>Import from Device</Text>
      <Text style={styles.importSubtitle}>
        Select a photo, document, or file from your device storage.
      </Text>

      {mlKitScannerOptional && onOpenMlKitDocumentScanner ? (
        <TouchableOpacity
          style={[styles.importCard, styles.importMlKitOptionalCard]}
          onPress={onOpenMlKitDocumentScanner}
          activeOpacity={0.7}
        >
          <View style={[styles.importIcon, styles.importMlKitOptionalIcon]}>
            <Ionicons name="scan-outline" size={32} color={Colors.primary} />
          </View>
          <View style={styles.importCardText}>
            <Text style={styles.importCardTitle}>Google document scanner (optional)</Text>
            <Text style={styles.importCardSubtitle}>
              Only if you want to crop or straighten using Google’s tool. Otherwise use the options below — Vault does not
              open this automatically.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.importOcrRow}>
        <TouchableOpacity
          style={[styles.multiChip, ocrExtractOnCapture && styles.multiChipActive]}
          onPress={onToggleOcrExtract}
          activeOpacity={0.7}
        >
          <Ionicons name="text-outline" size={16} color={ocrExtractOnCapture ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.multiChipText, ocrExtractOnCapture && styles.multiChipTextActive]}>
            Text from photo
          </Text>
          {!isPro && (
            <View style={styles.multiCount}>
              <Text style={styles.multiCountText}>{ocrReadsRemaining}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.multiChip}
          onPress={onOpenOcrOptions}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.multiChipText}>OCR options</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.importCard} onPress={onImportImage} activeOpacity={0.7}>
        <View style={styles.importIcon}>
          <Ionicons name="image-outline" size={32} color={Colors.primary} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Photo / Image</Text>
          <Text style={styles.importCardSubtitle}>JPG, PNG, HEIC from your gallery</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportPdf} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconPdf]}>
          <Ionicons name="document-outline" size={32} color={Colors.danger} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>PDF Document</Text>
          <Text style={styles.importCardSubtitle}>Import a PDF file from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportWord} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconWord]}>
          <Ionicons name="document-text-outline" size={32} color="#2b579a" />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Word Document</Text>
          <Text style={styles.importCardSubtitle}>DOC, DOCX from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportExcel} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconExcel]}>
          <Ionicons name="grid-outline" size={32} color="#217346" />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Excel Spreadsheet</Text>
          <Text style={styles.importCardSubtitle}>XLS, XLSX from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportOther} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconOther]}>
          <Ionicons name="document-attach-outline" size={32} color={Colors.textSecondary} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Other (Text, CSV)</Text>
          <Text style={styles.importCardSubtitle}>TXT, CSV and other documents</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  tabActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  chooserScroll: {
    flex: 1,
  },
  chooserScrollContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  chooserHeadline: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
  },
  chooserLead: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    marginBottom: Spacing.xs,
  },
  chooserChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chooserMultiRow: {
    alignSelf: 'flex-start',
  },
  chooserPrimaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chooserPrimaryIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooserPrimaryIconAlt: {
    backgroundColor: 'rgba(16, 163, 127, 0.08)',
  },
  chooserPrimaryText: {
    flex: 1,
    gap: 4,
  },
  chooserPrimaryTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  chooserPrimarySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.base,
  },
  permissionTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: Typography.lineHeightBase,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraPreview: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '85%',
    height: '70%',
    borderWidth: 2,
    borderColor: 'rgba(16, 163, 127, 0.7)',
    borderRadius: Radius.lg,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.background,
  },
  multiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },
  multiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  multiChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  multiChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  multiChipTextActive: {
    color: Colors.primary,
  },
  multiCount: {
    marginLeft: Spacing.xs,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  multiCountText: {
    color: Colors.white,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightBold,
  },
  multiFinishBtn: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
  },
  multiFinishBtnDisabled: {
    opacity: 0.5,
  },
  multiFinishText: {
    color: Colors.white,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  multiStressBtn: {
    borderRadius: Radius.pill,
    backgroundColor: '#1f2937',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
  },
  multiStressText: {
    color: Colors.white,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  profileChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  profileChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  profileChipText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  profileChipTextActive: {
    color: Colors.primary,
  },
  ocrOptionsCard: {
    maxWidth: 400,
    width: '100%',
    maxHeight: '88%',
    alignItems: 'stretch',
  },
  ocrOptionsScroll: {
    maxHeight: 360,
    width: '100%',
  },
  ocrOptionsScrollContent: {
    paddingBottom: Spacing.sm,
  },
  ocrLangCategory: {
    width: '100%',
  },
  ocrCategoryTitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  ocrCategoryTitleFirst: {
    marginTop: 0,
  },
  ocrLangRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    width: '100%',
  },
  ocrOptionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginTop: Spacing.xs,
  },
  blockingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  blockingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  blockingBody: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
  },
  blockingPercent: {
    color: Colors.primary,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  stressPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  stressPickerCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  stressPickerTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  stressPickerHint: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  stressPickerBtn: {
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  stressPickerBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  stressPickerCancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stressPickerCancelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  disclaimerCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  disclaimerCheckText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
  cameraControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.borderLight,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
  cameraHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    textAlign: 'center',
    paddingBottom: Spacing.xs,
    paddingTop: 2,
    backgroundColor: Colors.background,
  },
  importScroll: {
    flex: 1,
  },
  importScrollContent: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl + 60,
  },
  importTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
  },
  importSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    marginBottom: Spacing.md,
  },
  importOcrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  importCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.base,
  },
  importMlKitOptionalCard: {
    borderStyle: 'dashed',
    borderColor: 'rgba(16, 163, 127, 0.45)',
    marginBottom: Spacing.lg,
  },
  importMlKitOptionalIcon: {
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  importIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconPdf: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  importIconWord: {
    backgroundColor: 'rgba(43, 87, 154, 0.12)',
  },
  importIconExcel: {
    backgroundColor: 'rgba(33, 115, 70, 0.12)',
  },
  importIconOther: {
    backgroundColor: Colors.surfaceHighlight,
  },
  importCardText: {
    flex: 1,
  },
  importCardTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  importCardSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
});
