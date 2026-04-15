import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PillButton } from './PillButton';
import { AI_DESTINATIONS, type AiDestination } from '@/services/AiDestinations';
import { getSetting, setSetting } from '@/db/settings';
import { useAppStore } from '@/store/app-store';
import { withExternalActivityGuard } from '@/store/auth-flags';
import { isAllowedShareSourceUri } from '@/services/archiveUri';

type Props = {
  visible: boolean;
  onClose: () => void;
  fileUri: string;
  /** When true, show only privacy note + share button. */
  minimal?: boolean;
};

const PRIVACY_DISMISSED_KEY = 'aiSharePrivacyDismissed';

export function AiDestinationSheet({ visible, onClose, fileUri, minimal = false }: Props) {
  const showToast = useAppStore((s) => s.showToast);
  const [privacyDismissed, setPrivacyDismissed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const v = await getSetting(PRIVACY_DISMISSED_KEY);
        setPrivacyDismissed(v === 'true');
        setDontShowAgain(false);
      } catch {
        setPrivacyDismissed(false);
        setDontShowAgain(false);
      }
    })();
  }, [visible]);

  const destinations = useMemo(() => AI_DESTINATIONS, []);

  const shareFileToSheet = async () => {
    if (!fileUri) return;
    if (!isAllowedShareSourceUri(fileUri)) {
      showToast('Cannot share this file from here.', 'info');
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Sharing.shareAsync(fileUri, { dialogTitle: 'Share to AI' });
  };

  const shareDocument = async () => {
    await withExternalActivityGuard(shareFileToSheet);
  };

  const handleDestination = async (dest: AiDestination) => {
    try {
      await withExternalActivityGuard(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (dest.deepLinkUrl) {
          const canOpen = await Linking.canOpenURL(dest.deepLinkUrl);
          if (canOpen) {
            Linking.openURL(dest.deepLinkUrl).catch(() => {});
            showToast('Opened AI app. Now attach the document.', 'info');
          } else {
            showToast('AI app not installed. Opening share sheet.', 'info');
          }
        }

        if (dontShowAgain && !privacyDismissed) {
          try {
            await setSetting(PRIVACY_DISMISSED_KEY, 'true');
            setPrivacyDismissed(true);
          } catch {
            // ignore
          }
        }

        await shareFileToSheet();
      });
    } catch {
      // ignore
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet}>
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.handle} />
            <Text style={styles.title}>Share to AI</Text>
            {!minimal && (
              <Text style={styles.subtitle}>
                Pick an AI app. If it’s not installed, we’ll fall back to the system share sheet.
              </Text>
            )}

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {!minimal &&
                destinations.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.row}
                    onPress={() => handleDestination(d)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons
                        name={d.id === 'more' ? 'share-outline' : 'sparkles-outline'}
                        size={18}
                        color={d.id === 'more' ? Colors.textSecondary : Colors.primary}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{d.title}</Text>
                      <Text style={styles.rowDesc} numberOfLines={2}>
                        {d.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}

              {!privacyDismissed && (
                <View style={styles.privacyBox}>
                  <Text style={styles.privacyTitle}>Privacy note</Text>
                  <Text style={styles.privacyText}>
                    Sharing sends a copy to another app/service. Their privacy rules apply.
                  </Text>
                  {!minimal && (
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setDontShowAgain((v) => !v)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={dontShowAgain ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={dontShowAgain ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={styles.checkboxText}>Don’t show again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <PillButton
                label="Share"
                variant="primary"
                size="md"
                onPress={shareDocument}
                style={{ flex: 1 }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceRaised,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  rowDesc: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 18,
  },
  privacyBox: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  privacyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 4,
  },
  privacyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  checkboxText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});

