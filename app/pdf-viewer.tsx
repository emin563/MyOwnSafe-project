import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { PdfDocumentView } from '@/components/pdf/PdfDocumentView';
import { openFileWithOtherApps } from '@/services/openWithExternal';
import { Colors, Radius, Spacing, Typography } from '@/theme';

export default function PdfViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();
  const [openingExternal, setOpeningExternal] = useState(false);

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PDF</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No PDF selected</Text>
          <Text style={styles.errorText}>Open a PDF from a document in your vault.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRemote = /^https?:\/\//i.test(uri);
  const viewerUri = isRemote ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}` : uri;

  const openInOtherApp = async () => {
    try {
      setOpeningExternal(true);
      await openFileWithOtherApps(uri, 'pdf');
    } catch {
      // user may cancel; optional toast could go here
    } finally {
      setOpeningExternal(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'PDF'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {isRemote ? (
        <WebView
          source={{ uri: viewerUri }}
          style={styles.web}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
        />
      ) : (
        <View style={styles.localWrap}>
          <PdfDocumentView uri={uri} />
          <View style={styles.toolbar}>
            {openingExternal ? (
              <View style={styles.openingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.openingText}>Opening…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={openInOtherApp}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open with other apps"
              >
                <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.secondaryBtnText}>Open with…</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
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
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  web: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  localWrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
  },
  toolbar: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  openingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  openingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
});
