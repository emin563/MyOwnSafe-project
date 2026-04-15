import { Colors, Radius, Spacing, Typography } from '@/theme';
import type { BackupProgress } from '@/services/BackupService';
import {
  computeBlendedBackupDisplay,
  formatWillBeReadyOptimisticLine,
} from '@/services/backupTimeEstimate';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  /** When null, shows a generic state */
  progress: BackupProgress | null;
  /** Wall-clock start for ETA (set when the operation starts). */
  startedAtMs?: number | null;
  /** Total seconds estimated from archive size (set after preflight with totalBytes). */
  estimatedTotalSeconds?: number | null;
};

export function BackupProgressModal({
  visible,
  title,
  progress,
  startedAtMs = null,
  estimatedTotalSeconds = null,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const { message, etaRemainingSeconds } = useMemo(
    () => computeBlendedBackupDisplay(progress, startedAtMs ?? null, estimatedTotalSeconds ?? null),
    [progress, startedAtMs, estimatedTotalSeconds, tick]
  );

  const showEta =
    visible &&
    etaRemainingSeconds != null &&
    etaRemainingSeconds >= 1 &&
    progress != null &&
    progress.phase !== 'share';

  const etaText = showEta ? formatWillBeReadyOptimisticLine(etaRemainingSeconds) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {etaText ? <Text style={styles.etaPrimary}>{etaText}</Text> : null}
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
          <Text style={styles.status}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  etaPrimary: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: Typography.lineHeightBase,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  spinnerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: Spacing.lg,
  },
  status: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    lineHeight: 18,
    textAlign: 'center',
  },
});
