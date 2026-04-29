import { GoogleDriveBackupSection } from '@/components/settings/GoogleDriveBackupSection';
import { BackupProgressModal, PaywallModal, ProIncludedFeatureDialog, QuizWhyPro } from '@/components/ui';
import { GOOGLE_PRIVACY_MODAL_BODY, GOOGLE_PRIVACY_MODAL_TITLE } from '@/constants/googleServicesPrivacy';
import { getSetting, setSetting } from '@/db/settings';
import { createBackup, restoreFromBackup, type BackupProgress } from '@/services/BackupService';
import { cancelAllNotifications } from '@/services/NotificationService';
import {
    resetBackupProgressThrottle,
    shouldEmitBackupProgress,
    type BackupProgressThrottleState,
} from '@/services/backupProgressThrottle';
import { estimateBackupTotalSeconds } from '@/services/backupTimeEstimate';
import { FREE_TIER_RULES, PRO_ONLY_FEATURES } from '@/services/limits';
import type { MlKitScannerMode } from '@/services/mlKitScannerMode';
import { getOcrMetrics, resetOcrMetrics } from '@/services/ocrMetrics';
import {
    OCR_QA_CASES,
    getOcrQaChecklist,
    resetOcrQaChecklist,
    setOcrQaCaseStatus,
    type OcrQaCaseId,
    type OcrQaChecklist,
} from '@/services/ocrQaChecklist';
import { getPerformanceMetrics, resetPerformanceMetrics } from '@/services/performanceMetrics';
import { MULTI_PAGE_TESTED_LIMIT } from '@/services/performanceTargets';
import {
    getRegressionChecklist,
    resetRegressionChecklist,
    setRegressionCaseStatus,
    type RegressionCasePages,
    type RegressionChecklist,
} from '@/services/regressionChecklist';
import { useAppStore } from '@/store/app-store';
import { withExternalActivityGuard } from '@/store/auth-flags';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

type MetricsSummary = {
  label: string;
  p50Ms: number;
  targetMs: number;
  meetsTarget: boolean;
  count: number;
};

export default function SettingsScreen() {
  const {
    loadDocuments,
    loadCategories,
    loadSettings,
    setDevProPreview,
    isPro,
    billingProEntitled,
    devProPreview,
    setGoogleExtensionsPrivacyTipDismissed,
    resetOcrReadTrialsForDev,
    mlKitScannerMode,
    setMlKitScannerMode,
  } = useAppStore(
    useShallow((s) => ({
      loadDocuments: s.loadDocuments,
      loadCategories: s.loadCategories,
      loadSettings: s.loadSettings,
      setDevProPreview: s.setDevProPreview,
      isPro: s.isPro,
      billingProEntitled: s.billingProEntitled,
      devProPreview: s.devProPreview,
      setGoogleExtensionsPrivacyTipDismissed: s.setGoogleExtensionsPrivacyTipDismissed,
      resetOcrReadTrialsForDev: s.resetOcrReadTrialsForDev,
      mlKitScannerMode: s.mlKitScannerMode,
      setMlKitScannerMode: s.setMlKitScannerMode,
    }))
  );

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [backupStartedAt, setBackupStartedAt] = useState<number | null>(null);
  const [backupEstimatedSeconds, setBackupEstimatedSeconds] = useState<number | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [dataPortabilityProDialogVisible, setDataPortabilityProDialogVisible] = useState(false);
  const [pendingDataPortabilityAction, setPendingDataPortabilityAction] = useState<
    'backup' | 'restore' | 'drive' | null
  >(null);
  const [premiumExpanded, setPremiumExpanded] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [showWhyPro, setShowWhyPro] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsRows, setMetricsRows] = useState<MetricsSummary[]>([]);
  const [metricsMessage, setMetricsMessage] = useState<string | null>(null);
  const [ocrMetricsMessage, setOcrMetricsMessage] = useState<string | null>(null);
  const [ocrMetricsRows, setOcrMetricsRows] = useState<string[]>([]);
  const [ocrQaRows, setOcrQaRows] = useState<OcrQaChecklist | null>(null);
  const [ocrQaMessage, setOcrQaMessage] = useState<string | null>(null);
  const [regressionLoading, setRegressionLoading] = useState(false);
  const [regressionRows, setRegressionRows] = useState<RegressionChecklist | null>(null);
  const [regressionMessage, setRegressionMessage] = useState<string | null>(null);
  const [regressionReportActionAt, setRegressionReportActionAt] = useState<string | null>(null);
  const [developerToolsVisible, setDeveloperToolsVisible] = useState(false);
  const [googlePrivacyModalVisible, setGooglePrivacyModalVisible] = useState(false);
  const [googlePrivacyDontShowAgain, setGooglePrivacyDontShowAgain] = useState(false);
  const googlePrivacyTipShownThisSessionRef = useRef(false);
  const backupProgressThrottleRef = useRef<BackupProgressThrottleState>({ lastPhase: '', lastAt: 0 });

  const leaveSettings = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(drawer)');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        await loadSettings();
        if (cancelled) return;
        const { googleExtensionsPrivacyTipDismissed } = useAppStore.getState();
        if (googleExtensionsPrivacyTipDismissed) return;
        if (googlePrivacyTipShownThisSessionRef.current) return;
        googlePrivacyTipShownThisSessionRef.current = true;
        setGooglePrivacyDontShowAgain(false);
        setGooglePrivacyModalVisible(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [loadSettings])
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leaveSettings();
        return true;
      });
      return () => sub.remove();
    }, [leaveSettings])
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await getSetting('developerToolsVisible');
      if (!cancelled) setDeveloperToolsVisible(raw === '1');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeveloperToolsToggle = async (value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeveloperToolsVisible(value);
    await setSetting('developerToolsVisible', value ? '1' : '0');
  };

  // ── Backup ──────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    if (!isPro) {
      setPendingDataPortabilityAction('backup');
      setDataPortabilityProDialogVisible(true);
      return;
    }
    resetBackupProgressThrottle(backupProgressThrottleRef.current);
    setBackupLoading(true);
    setBackupProgress({ phase: 'preflight' });
    setBackupStartedAt(Date.now());
    setBackupEstimatedSeconds(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createBackup((p) => {
        if (shouldEmitBackupProgress(backupProgressThrottleRef.current, p, 120)) {
          setBackupProgress(p);
          if (p.phase === 'preflight' && typeof p.totalBytes === 'number') {
            setBackupEstimatedSeconds(estimateBackupTotalSeconds(p.totalBytes, p.fileCount ?? 0));
          }
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      Alert.alert('Backup Failed', message);
    } finally {
      setBackupLoading(false);
      setBackupProgress(null);
      setBackupStartedAt(null);
      setBackupEstimatedSeconds(null);
    }
  };

  // ── Restore ─────────────────────────────────────────────────────────────

  const handleRestore = async () => {
    if (!isPro) {
      setPendingDataPortabilityAction('restore');
      setDataPortabilityProDialogVisible(true);
      return;
    }
    Alert.alert(
      'Restore from Backup',
      'This will replace ALL current data with the contents of the selected backup file. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoreLoading(true);
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              // Cancel all pending notifications — they will be rescheduled
              await cancelAllNotifications();
              const success = await restoreFromBackup();
              if (success) {
                // Reload the store after restore
                await loadCategories();
                await loadDocuments(null);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Restore Complete', 'Your data has been restored successfully.');
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'An unknown error occurred.';
              Alert.alert('Restore Failed', message);
            } finally {
              setRestoreLoading(false);
            }
          },
        },
      ]
    );
  };

  const loadMetricsSnapshot = async () => {
    setMetricsLoading(true);
    setMetricsMessage(null);
    try {
      const metrics = await getPerformanceMetrics();
      const rows: MetricsSummary[] = [
        { key: 'scan_to_preview', label: 'Scan to preview' },
        { key: 'scan_to_pdf', label: 'Scan to PDF' },
        { key: 'open_pdf', label: 'Open PDF' },
        { key: 'show_progress_latency', label: 'Show progress latency' },
      ]
        .map((meta) => {
          const m = metrics[meta.key as keyof typeof metrics];
          if (!m) return null;
          return {
            label: meta.label,
            p50Ms: m.p50Ms,
            targetMs: m.targetMs,
            meetsTarget: m.meetsTarget,
            count: m.count,
          };
        })
        .filter((v): v is MetricsSummary => v != null);
      setMetricsRows(rows);
      if (rows.length === 0) {
        setMetricsMessage('No metrics yet. Run scan/open flows first, then tap again.');
      } else {
        setMetricsMessage(`Loaded ${rows.length} metric group${rows.length === 1 ? '' : 's'}.`);
      }
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadOcrMetricsSnapshot = async () => {
    setMetricsLoading(true);
    setOcrMetricsMessage(null);
    try {
      const m = await getOcrMetrics();
      const successPages = Math.max(0, m.totalPages - m.failedPages);
      const weakRate = m.totalPages > 0 ? Math.round((m.weakPages / m.totalPages) * 100) : 0;
      const timeoutRate = m.totalPages > 0 ? Math.round((m.timedOutPages / m.totalPages) * 100) : 0;
      setOcrMetricsRows([
        `OCR pages processed: ${m.totalPages}`,
        `Success pages: ${successPages}`,
        `Failed pages: ${m.failedPages}`,
        `Weak pages: ${m.weakPages} (${weakRate}%)`,
        `Retried pages: ${m.retriedPages}`,
        `Improved after retry: ${m.improvedPages}`,
        `Timeout pages: ${m.timedOutPages} (${timeoutRate}%)`,
        `OCR latency p50/avg: ${m.p50LatencyMs}ms / ${m.avgLatencyMs}ms`,
      ]);
      setOcrMetricsMessage(m.totalPages === 0 ? 'No OCR metrics yet. Run OCR flows first.' : 'Loaded OCR metrics snapshot.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadOcrQaSnapshot = async () => {
    setMetricsLoading(true);
    setOcrQaMessage(null);
    try {
      const snapshot = await getOcrQaChecklist();
      setOcrQaRows(snapshot);
      const tested = Object.values(snapshot).filter((v) => v !== 'pending').length;
      setOcrQaMessage(`Loaded OCR QA checklist. ${tested}/${OCR_QA_CASES.length} marked.`);
    } finally {
      setMetricsLoading(false);
    }
  };

  const setOcrQaStatus = async (id: OcrQaCaseId, status: 'pass' | 'fail') => {
    setMetricsLoading(true);
    try {
      const next = await setOcrQaCaseStatus(id, status);
      setOcrQaRows(next);
      setOcrQaMessage(`${OCR_QA_CASES.find((c) => c.id === id)?.label ?? id} marked as ${status.toUpperCase()}.`);
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadRegressionSnapshot = async () => {
    setRegressionLoading(true);
    setRegressionMessage(null);
    try {
      const snapshot = await getRegressionChecklist();
      setRegressionRows(snapshot);
      const testedCount = Object.values(snapshot).filter((v) => v !== 'pending').length;
      setRegressionMessage(`Loaded checklist. ${testedCount}/5 runs marked.`);
    } finally {
      setRegressionLoading(false);
    }
  };

  const updateRegressionStatus = async (pages: RegressionCasePages, status: 'pass' | 'fail') => {
    setRegressionLoading(true);
    try {
      const next = await setRegressionCaseStatus(pages, status);
      setRegressionRows(next);
      setRegressionMessage(`${pages}-page run marked as ${status.toUpperCase()}.`);
    } finally {
      setRegressionLoading(false);
    }
  };

  const copyRegressionReport = async () => {
    setRegressionLoading(true);
    try {
      const snapshot = regressionRows ?? (await getRegressionChecklist());
      setRegressionRows(snapshot);
      const report = buildRegressionReport(snapshot);
      await Clipboard.setStringAsync(report);
      setRegressionMessage('Regression report copied to clipboard.');
      setRegressionReportActionAt(`Last copied: ${new Date().toLocaleString()}`);
    } finally {
      setRegressionLoading(false);
    }
  };

  const shareRegressionReport = async () => {
    setRegressionLoading(true);
    try {
      const snapshot = regressionRows ?? (await getRegressionChecklist());
      setRegressionRows(snapshot);
      const report = buildRegressionReport(snapshot);
      await withExternalActivityGuard(() => Share.share({ message: report }));
      setRegressionMessage('Regression report shared.');
      setRegressionReportActionAt(`Last shared: ${new Date().toLocaleString()}`);
    } finally {
      setRegressionLoading(false);
    }
  };

  const buildRegressionReport = (snapshot: RegressionChecklist): string => {
    const statuses = Object.values(snapshot);
    const passed = statuses.filter((s) => s === 'pass').length;
    const failed = statuses.filter((s) => s === 'fail').length;
    const pending = statuses.filter((s) => s === 'pending').length;
    const lines = ([10, 50, 100, 200, 500] as const).map((pages) => {
      const state = snapshot[pages];
      const statusText = state === 'pass' ? 'PASS' : state === 'fail' ? 'FAIL' : 'PENDING';
      return `- ${pages} pages: ${statusText}`;
    });
    return [
      `Regression Checklist Report (${new Date().toISOString()})`,
      `Score: ${passed}/5 passed, ${failed} failed, ${pending} pending`,
      ...lines,
    ].join('\n');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackupProgressModal
        visible={backupLoading}
        title="Creating backup"
        progress={backupProgress}
        startedAtMs={backupStartedAt}
        estimatedTotalSeconds={backupEstimatedSeconds}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={leaveSettings} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Privacy Section */}
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => router.push('/privacy-offline')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Privacy & Offline</Text>
              <Text style={styles.rowHint}>
                On-device vault, optional Google scanner &amp; Drive backup, and how to use them privately
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => router.push('/app-locking-info')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>App Locking</Text>
              <Text style={styles.rowHint}>
                Secure Vault using your device&apos;s built-in App Lock, Secure Folder, or Private Space feature.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => router.push('/permissions-info')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="key-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Permissions</Text>
              <Text style={styles.rowHint}>
                Camera, files, optional reminders, and Google Play when you purchase Pro
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => router.push('/ocr-extraction-info')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="text-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Text from photo</Text>
              <Text style={styles.rowHint}>
                On-device OCR, free trials, and how vault search uses extracted text. Turn it on when you add a document
                — tap for details.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={() => router.push('/multi-page-info')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="document-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Multi-page PDF</Text>
              <Text style={styles.rowHint}>
                Multi-page scan flow, tested-limit warning (up to {MULTI_PAGE_TESTED_LIMIT} images), and long-file section guidance.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'android' ? (
          <>
            <Text style={styles.sectionTitle}>Scan defaults</Text>
            <View style={styles.card}>
              <Text style={styles.scanDefaultLabel}>Google document scanner</Text>
              <Text style={styles.scanMlKitHint}>
                Recommended: Crop only — uses Google&apos;s detect-and-straighten without extra filter passes (clearer text,
                less blur from recompression). Choose Full if you need every enhance / filter tool in the scanner UI.
              </Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { mode: 'base' as MlKitScannerMode, label: 'Crop only' },
                    { mode: 'base_with_filter' as MlKitScannerMode, label: 'Crop + filters' },
                    { mode: 'full' as MlKitScannerMode, label: 'Full' },
                  ] as const
                ).map(({ mode, label }) => {
                  const active = mlKitScannerMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.scanChip, active && styles.scanChipActive]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void setMlKitScannerMode(mode);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.scanChipText, active && styles.scanChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {!isPro && (
          <>
            <Text style={styles.sectionTitle}>Free plan</Text>
            <View style={styles.card}>
              {FREE_TIER_RULES.map((rule, i) => (
                <React.Fragment key={rule.title}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.freePlanRow}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>{rule.title}</Text>
                      <Text style={styles.rowHint}>{rule.detail}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
              <View style={styles.divider} />
              <View style={styles.freePlanProBlock}>
                <Text style={styles.freePlanProTitle}>Included only in Pro (one-time purchase)</Text>
                {PRO_ONLY_FEATURES.map((line) => (
                  <Text key={line} style={styles.freePlanProLine}>
                    • {line}
                  </Text>
                ))}
              </View>
            </View>
          </>
        )}

        {isPro && (
          <>
            <Text style={styles.sectionTitle}>Your plan</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Pro is active</Text>
                  <Text style={styles.rowHint}>
                    Unlimited documents, custom categories, tags, photo text reads, backup, bulk actions, Google Drive
                    sync, and full prompt library.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Data Portability Section */}
        <Text style={styles.sectionTitle}>Data Portability</Text>
        <View style={styles.card}>
          {/* Backup */}
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={handleBackup}
            disabled={backupLoading}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="archive-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Create Backup</Text>
              <Text style={styles.rowHint}>
                {isPro
                  ? 'Export all documents and media as a .zip file'
                  : 'Pro: full vault backup to a .zip. Tap to see pricing (one-time purchase).'}
              </Text>
            </View>
            {backupLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Restore */}
          <TouchableOpacity
            style={[styles.row, styles.rowBtn]}
            onPress={handleRestore}
            disabled={restoreLoading}
            activeOpacity={0.7}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="document-attach-outline" size={20} color={Colors.danger} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Restore from Backup</Text>
              <Text style={styles.rowHint}>
                {isPro
                  ? 'Replace current data with a backup .zip file'
                  : 'Pro: restore from a backup .zip. Tap to see pricing (one-time purchase).'}
              </Text>
            </View>
            {restoreLoading ? (
              <ActivityIndicator color={Colors.danger} size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <GoogleDriveBackupSection
            isPro={isPro}
            onRequestPro={() => {
              setPendingDataPortabilityAction('drive');
              setDataPortabilityProDialogVisible(true);
            }}
          />
        </View>

        {__DEV__ && (
          <>
            <Text style={styles.sectionTitle}>Developer</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Ionicons name="construct-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Show developer tools</Text>
                  <Text style={styles.rowHint}>
                    Metrics, OCR QA, regression checklists, and Pro testing switches
                  </Text>
                </View>
                <Switch
                  value={developerToolsVisible}
                  onValueChange={handleDeveloperToolsToggle}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.border}
                />
              </View>
            </View>

            {developerToolsVisible && (
              <>
                <Text style={styles.sectionTitle}>Developer tools</Text>
                <View style={styles.card}>
              {__DEV__ && (
                <View style={[styles.row, styles.devProSimRow]}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="code-slash-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Pro simulation</Text>
                    <Text style={styles.rowHint}>
                      Store follows Google Play; Free/Pro overrides limits without changing billing sync.
                    </Text>
                    <View style={styles.devProChipsRow}>
                      {(
                        [
                          { mode: 'store' as const, label: 'Store', preview: null },
                          { mode: 'free' as const, label: 'Free', preview: 'force_free' as const },
                          { mode: 'pro' as const, label: 'Pro', preview: 'force_pro' as const },
                        ] as const
                      ).map(({ mode, label, preview }) => {
                        const selected =
                          preview === null
                            ? devProPreview === null
                            : devProPreview === preview;
                        return (
                          <TouchableOpacity
                            key={mode}
                            style={[styles.devProChip, selected && styles.devProChipSelected]}
                            onPress={async () => {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              await setDevProPreview(preview);
                            }}
                            activeOpacity={0.75}
                          >
                            <Text
                              style={[styles.devProChipText, selected && styles.devProChipTextSelected]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.rowHint}>
                      Play entitlement: {billingProEntitled ? 'Pro' : 'Free'} · UI limits:{' '}
                      {isPro ? 'Pro' : 'Free'}
                    </Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await resetOcrReadTrialsForDev();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Reset OCR free trials</Text>
                  <Text style={styles.rowHint}>Sets photo-text trial count to 0 for testing Free limits</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={loadMetricsSnapshot}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="speedometer-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>View performance metrics</Text>
                  <Text style={styles.rowHint}>Shows local p50 timings vs targets (dev only)</Text>
                </View>
                {metricsLoading ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
              {metricsRows.length > 0 && (
                <View style={styles.metricsCard}>
                  {metricsRows.map((row) => (
                    <View key={row.label} style={styles.metricsRow}>
                      <Text style={styles.metricsName}>{row.label}</Text>
                      <Text style={[styles.metricsValue, row.meetsTarget ? styles.metricsGood : styles.metricsBad]}>
                        p50 {row.p50Ms}ms / target {row.targetMs}ms ({row.count})
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {metricsMessage ? (
                <View style={styles.metricsMessageWrap}>
                  <Text style={styles.metricsMessageText}>{metricsMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await resetPerformanceMetrics();
                  setMetricsRows([]);
                  setMetricsMessage('Metrics cleared.');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Reset performance metrics</Text>
                  <Text style={styles.rowHint}>Clears local timing history (dev only)</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={loadOcrMetricsSnapshot}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="reader-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>View OCR metrics</Text>
                  <Text style={styles.rowHint}>Success, weak/retry, timeout, and OCR latency stats</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {ocrMetricsRows.length > 0 && (
                <View style={styles.metricsCard}>
                  {ocrMetricsRows.map((line) => (
                    <Text key={line} style={styles.metricsMessageText}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
              {ocrMetricsMessage ? (
                <View style={styles.metricsMessageWrap}>
                  <Text style={styles.metricsMessageText}>{ocrMetricsMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await resetOcrMetrics();
                  setOcrMetricsRows([]);
                  setOcrMetricsMessage('OCR metrics cleared.');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Reset OCR metrics</Text>
                  <Text style={styles.rowHint}>Clears local OCR metric counters/history</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={loadOcrQaSnapshot}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>View OCR QA checklist</Text>
                  <Text style={styles.rowHint}>Clean docs, receipts, low light, angled, glare</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {ocrQaRows ? (
                <View style={styles.metricsCard}>
                  {OCR_QA_CASES.map((c) => {
                    const status = ocrQaRows[c.id];
                    return (
                      <View key={c.id} style={styles.regressionRow}>
                        <Text style={styles.metricsName}>{c.label}</Text>
                        <View style={styles.regressionActions}>
                          <TouchableOpacity
                            style={[styles.regressionBtn, status === 'pass' && styles.regressionBtnPass]}
                            onPress={() => {
                              void setOcrQaStatus(c.id, 'pass');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.regressionBtnText, status === 'pass' && styles.regressionBtnTextActive]}>
                              PASS
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.regressionBtn, status === 'fail' && styles.regressionBtnFail]}
                            onPress={() => {
                              void setOcrQaStatus(c.id, 'fail');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.regressionBtnText, status === 'fail' && styles.regressionBtnTextFailActive]}>
                              FAIL
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {ocrQaMessage ? (
                <View style={styles.metricsMessageWrap}>
                  <Text style={styles.metricsMessageText}>{ocrQaMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const reset = await resetOcrQaChecklist();
                  setOcrQaRows(reset);
                  setOcrQaMessage('OCR QA checklist cleared.');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Reset OCR QA checklist</Text>
                  <Text style={styles.rowHint}>Sets all OCR QA cases back to pending</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={loadRegressionSnapshot}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="checkmark-done-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>View regression checklist</Text>
                  <Text style={styles.rowHint}>Track pass/fail for 10/50/100/200/500 page runs</Text>
                </View>
                {regressionLoading ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
              {regressionRows ? (
                <View style={styles.metricsCard}>
                  {(() => {
                    const statuses = Object.values(regressionRows);
                    const passed = statuses.filter((s) => s === 'pass').length;
                    const failed = statuses.filter((s) => s === 'fail').length;
                    const scoreStyle =
                      failed > 0
                        ? styles.regressionScoreBad
                        : passed === 5
                          ? styles.regressionScoreGood
                          : styles.regressionScoreWarn;
                    return (
                      <View style={styles.regressionScoreRow}>
                        <Text style={styles.metricsName}>Overall checklist score</Text>
                        <Text style={[styles.regressionScoreText, scoreStyle]}>
                          {passed}/5 passed{failed > 0 ? `, ${failed} failed` : ''}
                        </Text>
                      </View>
                    );
                  })()}
                  {([10, 50, 100, 200, 500] as const).map((pages) => {
                    const status = regressionRows[pages];
                    return (
                      <View key={pages} style={styles.regressionRow}>
                        <Text style={styles.metricsName}>{pages} pages</Text>
                        <View style={styles.regressionActions}>
                          <TouchableOpacity
                            style={[
                              styles.regressionBtn,
                              status === 'pass' && styles.regressionBtnPass,
                            ]}
                            onPress={() => {
                              void updateRegressionStatus(pages, 'pass');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.regressionBtnText,
                                status === 'pass' && styles.regressionBtnTextActive,
                              ]}
                            >
                              PASS
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.regressionBtn,
                              status === 'fail' && styles.regressionBtnFail,
                            ]}
                            onPress={() => {
                              void updateRegressionStatus(pages, 'fail');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.regressionBtnText,
                                status === 'fail' && styles.regressionBtnTextFailActive,
                              ]}
                            >
                              FAIL
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {regressionMessage ? (
                <View style={styles.metricsMessageWrap}>
                  <Text style={styles.metricsMessageText}>{regressionMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const reset = await resetRegressionChecklist();
                  setRegressionRows(reset);
                  setRegressionMessage('Regression checklist cleared.');
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Reset regression checklist</Text>
                  <Text style={styles.rowHint}>Sets 10/50/100/200/500 runs to pending</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={copyRegressionReport}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="copy-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Copy regression report</Text>
                  <Text style={styles.rowHint}>Copies compact 10/50/100/200/500 pass-fail summary</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={async () => {
                  setRegressionLoading(true);
                  try {
                    const current = regressionRows ?? (await getRegressionChecklist());
                    let next = current;
                    for (const pages of [10, 50, 100, 200, 500] as const) {
                      if (next[pages] === 'pending') {
                        next = await setRegressionCaseStatus(pages, 'pass');
                      }
                    }
                    setRegressionRows(next);
                    setRegressionMessage('All pending runs marked as PASS.');
                  } finally {
                    setRegressionLoading(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Mark pending as PASS</Text>
                  <Text style={styles.rowHint}>Quickly completes checklist for unmarked runs</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={shareRegressionReport}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="share-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Share regression report</Text>
                  <Text style={styles.rowHint}>Opens share sheet with compact checklist summary</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              {regressionReportActionAt ? (
                <View style={styles.metricsMessageWrap}>
                  <Text style={styles.metricsMessageText}>{regressionReportActionAt}</Text>
                </View>
              ) : null}
                </View>
              </>
            )}
          </>
        )}

        {/* About: quiz + paywall — only for users who have not purchased Pro */}
        {!isPro && (
          <>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={() => setPremiumExpanded((e) => !e)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Is Pro right for you?</Text>
                  <Text style={styles.rowHint}>
                    {premiumExpanded ? 'Tap to collapse' : 'Quick fit check (3 questions)'}
                  </Text>
                </View>
                <Ionicons
                  name={premiumExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {premiumExpanded && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.premiumContent}>
                    <Text style={styles.premiumTitle}>{"Let's find your fit"}</Text>
                    <Text style={styles.premiumText}>
                      Three short questions on subscriptions, privacy, and how you use AI—then a
                      personalized summary. No pressure; upgrade anytime from Settings.
                    </Text>
                  </View>
                  <QuizWhyPro
                    onUpgrade={() => setPaywallVisible(true)}
                    onClose={() => setPremiumExpanded(false)}
                  />
                </>
              )}
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.row, styles.rowBtn]}
                onPress={() => setPaywallVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>MyOwnSafe Pro</Text>
                  <Text style={styles.rowHint}>
                    See full Free limits above, then unlock one-time for unlimited + backup + bulk tools
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
        visible={dataPortabilityProDialogVisible}
        onClose={() => {
          setDataPortabilityProDialogVisible(false);
          setPendingDataPortabilityAction(null);
        }}
        featureDescription="Create and restore full vault backups (zip export), plus optional Google Drive backup (Android). Unlock Pro to use these data portability features."
        onUpgrade={async () => {
          setDataPortabilityProDialogVisible(false);
          const action = pendingDataPortabilityAction;
          setPendingDataPortabilityAction(null);
          // After successful purchase/restore (handled inside PaywallModal), retry the action if relevant.
          if (action === 'backup') {
            await handleBackup();
          } else if (action === 'restore') {
            await handleRestore();
          }
        }}
      />
      <Modal
        visible={googlePrivacyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGooglePrivacyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.googlePrivacyOverlay}
          activeOpacity={1}
          onPress={() => setGooglePrivacyModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.googlePrivacyCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.googlePrivacyTitle}>{GOOGLE_PRIVACY_MODAL_TITLE}</Text>
            <Text style={styles.googlePrivacyBody}>{GOOGLE_PRIVACY_MODAL_BODY}</Text>
            <TouchableOpacity
              style={styles.googlePrivacyCheckRow}
              activeOpacity={0.8}
              onPress={() => setGooglePrivacyDontShowAgain((v) => !v)}
            >
              <Ionicons
                name={googlePrivacyDontShowAgain ? 'checkbox-outline' : 'square-outline'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.googlePrivacyCheckText}>Do not show this again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.googlePrivacyPrimaryBtn}
              activeOpacity={0.85}
              onPress={async () => {
                if (googlePrivacyDontShowAgain) {
                  await setGoogleExtensionsPrivacyTipDismissed(true);
                }
                setGooglePrivacyModalVisible(false);
              }}
            >
              <Text style={styles.googlePrivacyPrimaryBtnText}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.googlePrivacyLinkBtn}
              activeOpacity={0.8}
              onPress={() => {
                setGooglePrivacyModalVisible(false);
                router.push('/privacy-offline');
              }}
            >
              <Text style={styles.googlePrivacyLinkText}>Open Privacy &amp; Offline</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginLeft: Spacing.sm,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 64,
  },
  rowBtn: {},
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  rowLabelDanger: {
    color: Colors.danger,
  },
  rowHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 16,
  },
  devProSimRow: {
    alignItems: 'flex-start',
  },
  devProChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  devProChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  devProChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceRaised,
  },
  devProChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  devProChipTextSelected: {
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
  premiumContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  premiumTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  premiumText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  premiumNote: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  freePlanRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  freePlanProBlock: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  freePlanProTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  freePlanProLine: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 18,
    marginBottom: 4,
  },
  metricsCard: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  metricsRow: {
    gap: 2,
  },
  metricsName: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  metricsValue: {
    fontSize: Typography.fontSizeXs,
  },
  metricsGood: {
    color: Colors.primary,
  },
  metricsBad: {
    color: Colors.danger,
  },
  metricsMessageWrap: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  metricsMessageText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
  regressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  regressionScoreRow: {
    gap: 2,
    marginBottom: Spacing.xs,
  },
  regressionScoreText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  regressionScoreGood: {
    color: Colors.primary,
  },
  regressionScoreWarn: {
    color: Colors.textSecondary,
  },
  regressionScoreBad: {
    color: Colors.danger,
  },
  regressionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  regressionBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceRaised,
  },
  regressionBtnPass: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  regressionBtnFail: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  regressionBtnText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  regressionBtnTextActive: {
    color: Colors.primary,
  },
  regressionBtnTextFailActive: {
    color: Colors.danger,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  scanDefaultLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  scanMlKitHint: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  scanChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  scanChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  scanChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  scanChipTextActive: {
    color: Colors.primary,
  },
  googlePrivacyOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  googlePrivacyCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  googlePrivacyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.md,
  },
  googlePrivacyBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  googlePrivacyCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  googlePrivacyCheckText: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    flex: 1,
  },
  googlePrivacyPrimaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  googlePrivacyPrimaryBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  googlePrivacyLinkBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  googlePrivacyLinkText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
});
