import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  type NotificationPermissionStatus,
} from '@/services/NotificationService';
import { CAMERA_REQUIRED_MESSAGE, FILE_REQUIRED_MESSAGE } from '@/services/requiredPermissions';
import { getAndroidReadPhotosStatusForUi, requestAndroidReadPhotosPermission } from '@/services/androidPhotoPermission';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type PermLabel = 'granted' | 'denied' | 'undetermined' | 'unknown';

function statusLabel(s: PermLabel | NotificationPermissionStatus): string {
  if (s === 'granted') return 'Allowed';
  if (s === 'denied') return 'Not allowed';
  if (s === 'undetermined') return 'Not asked yet';
  if (s === 'unsupported') return 'Not available';
  return '…';
}

export default function PermissionsInfoScreen() {
  const insets = useSafeAreaInsets();
  const [camera, setCamera] = useState<PermLabel>('unknown');
  const [media, setMedia] = useState<PermLabel>('unknown');
  const [notifications, setNotifications] = useState<NotificationPermissionStatus | 'unknown'>('unknown');
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const cam = await Camera.getCameraPermissionsAsync();
      setCamera(cam.granted ? 'granted' : cam.status === 'denied' ? 'denied' : 'undetermined');
    } catch {
      setCamera('unknown');
    }
    try {
      if (Platform.OS === 'android') {
        const nativePhotos = await getAndroidReadPhotosStatusForUi();
        setMedia(nativePhotos === 'granted' ? 'granted' : 'denied');
      } else {
        const lib = await ImagePicker.getMediaLibraryPermissionsAsync();
        setMedia(lib.granted ? 'granted' : lib.status === 'denied' ? 'denied' : 'undetermined');
      }
    } catch {
      setMedia('unknown');
    }
    try {
      setNotifications(await getNotificationPermissionStatus());
    } catch {
      setNotifications('unknown');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onRequestNotifications = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestNotificationPermissions();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const onRequestCamera = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await Camera.requestCameraPermissionsAsync();
      await refresh();
      if (!result.granted) {
        Alert.alert('Permission needed', CAMERA_REQUIRED_MESSAGE);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  const onRequestFiles = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS === 'android') {
        const ok = await requestAndroidReadPhotosPermission();
        await refresh();
        if (!ok) {
          Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
        }
      } else {
        const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
        await refresh();
        if (!result.granted) {
          Alert.alert('Permission needed', FILE_REQUIRED_MESSAGE);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [busy, refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Spacing.xl + Math.max(insets.bottom, 12) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="settings-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>What Vault uses your device for</Text>
          <Text style={styles.heroSubtitle}>
            Review or change access here. If something is turned off, you may see a short notice when you try to scan
            or import — that explains what to enable.
          </Text>
        </View>

        <Text style={styles.groupLabel}>Required</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowTitle}>Camera</Text>
                <View style={styles.badgeReq}>
                  <Text style={styles.badgeReqText}>Required</Text>
                </View>
              </View>
              <Text style={styles.rowHint}>Scan documents into your vault.</Text>
              <Text style={styles.rowStatus}>Status: {statusLabel(camera)}</Text>
              {camera !== 'granted' ? (
                <TouchableOpacity
                  style={styles.inlineBtn}
                  onPress={onRequestCamera}
                  activeOpacity={0.8}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.inlineBtnText}>Allow camera</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.inCardDivider} />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="folder-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowTitle}>File management</Text>
                <View style={styles.badgeReq}>
                  <Text style={styles.badgeReqText}>Required</Text>
                </View>
              </View>
              <Text style={styles.rowHint}>Import photos and files you select; save exports.</Text>
              <Text style={styles.rowStatus}>Status: {statusLabel(media)}</Text>
              {media !== 'granted' ? (
                <TouchableOpacity
                  style={styles.inlineBtn}
                  onPress={onRequestFiles}
                  activeOpacity={0.8}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.inlineBtnText}>Allow files &amp; photos</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.groupLabel}>Optional</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowTitle}>Notifications</Text>
                <View style={styles.badgeOpt}>
                  <Text style={styles.badgeOptText}>Optional</Text>
                </View>
              </View>
              <Text style={styles.rowHint}>Expiry and warranty reminders.</Text>
              <Text style={styles.rowStatus}>Status: {statusLabel(notifications)}</Text>
              {notifications !== 'granted' && notifications !== 'unsupported' ? (
                <TouchableOpacity
                  style={styles.inlineBtn}
                  onPress={onRequestNotifications}
                  activeOpacity={0.8}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.inlineBtnText}>Allow reminders</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.groupLabel}>One-time</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="storefront-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTitleRow}>
                <Text style={styles.rowTitle}>Google Play (Pro)</Text>
                <View style={styles.badgeOnce}>
                  <Text style={styles.badgeOnceText}>When you buy</Text>
                </View>
              </View>
              <Text style={styles.rowHint}>
                When you start a Pro purchase, Google Play shows its billing flow. Nothing is charged without your
                confirmation.
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.moreToggle} onPress={() => setMoreOpen((v) => !v)} activeOpacity={0.75}>
          <Text style={styles.moreToggleText}>{moreOpen ? 'Show less' : 'Show more'}</Text>
          <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
        </TouchableOpacity>

        {moreOpen ? (
          <View style={styles.moreBox}>
            <Text style={styles.moreParagraph}>
              <Text style={styles.moreBold}>Camera — </Text>
              Used when you capture scans. You can limit access to while the app is open in Android settings.
            </Text>
            <Text style={styles.moreParagraph}>
              <Text style={styles.moreBold}>Files &amp; photos — </Text>
              Used when you import from your gallery or save exports. The system may offer while-in-use or one-time
              access.
            </Text>
            <Text style={styles.moreParagraph}>
              <Text style={styles.moreBold}>Notifications — </Text>
              Optional local reminders only; you can leave these off and keep using the vault.
            </Text>
            <Text style={styles.moreParagraph}>
              <Text style={styles.moreBold}>Google Play — </Text>
              Applies only when you begin an in-app purchase for Pro; it is separate from camera or file access.
            </Text>
          </View>
        ) : null}

        {Platform.OS === 'android' ? (
          <TouchableOpacity
            style={styles.systemBtn}
            onPress={() => void Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.primary} />
            <Text style={styles.systemBtnText}>Open Android app settings</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    marginBottom: Spacing.lg,
  },
  heroIcon: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  groupLabel: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rowIcon: {
    width: 28,
    paddingTop: 2,
  },
  rowContent: {
    flex: 1,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  rowTitle: {
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
  },
  badgeReq: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeReqText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: '#fca5a5',
  },
  badgeOpt: {
    backgroundColor: 'rgba(16, 163, 127, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeOptText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
  badgeOnce: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeOnceText: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textSecondary,
  },
  rowHint: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  rowStatus: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    marginTop: 6,
  },
  inlineBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 32,
    justifyContent: 'center',
  },
  inlineBtnText: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
  inCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  moreToggleText: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
  moreBox: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  moreParagraph: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  moreBold: {
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.text,
  },
  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  systemBtnText: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.primary,
  },
});
