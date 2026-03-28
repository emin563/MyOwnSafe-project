import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { loadOfflinePreview } from '@/services/offlinePreview';
import { openFileWithOtherApps } from '@/services/openWithExternal';
import { PreviewScreenHeader } from '@/components/preview/PreviewScreenHeader';
import { ZoomableImage } from '@/components/preview/ZoomableImage';
import { SimpleMarkdownPreview } from '@/components/preview/SimpleMarkdownPreview';
import { PREVIEW_COPY } from '@/constants/previewCopy';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import type { FileType } from '@/db/types';

function parseFileType(raw: string | undefined): FileType | null {
  if (raw === 'image' || raw === 'word' || raw === 'excel' || raw === 'document') return raw;
  return null;
}

function isMarkdownFileName(title: string | undefined, fileType: FileType | null): boolean {
  if (fileType !== 'document') return false;
  const t = title?.trim().toLowerCase() ?? '';
  return t.endsWith('.md') || t.endsWith('.markdown');
}

function subtitleForType(fileType: FileType, title: string | undefined): string {
  if (isMarkdownFileName(title, fileType)) {
    return PREVIEW_COPY.markdownSubtitle;
  }
  switch (fileType) {
    case 'word':
      return PREVIEW_COPY.wordSubtitle;
    case 'excel':
      return PREVIEW_COPY.excelSubtitle;
    case 'document':
      return PREVIEW_COPY.documentSubtitle;
    case 'image':
      return PREVIEW_COPY.imageSubtitle;
    default:
      return '';
  }
}

export default function FilePreviewScreen() {
  const { uri: uriParam, title, fileType: ftParam } = useLocalSearchParams<{
    uri?: string;
    title?: string;
    fileType?: string;
  }>();

  const uri = uriParam ? decodeURIComponent(uriParam) : '';
  const fileType = parseFileType(ftParam);

  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);

  const headerTitle = title?.trim() || PREVIEW_COPY.screenTitle;
  const subtitle = fileType ? subtitleForType(fileType, title) : null;

  useEffect(() => {
    let cancelled = false;
    if (!uri || !fileType) {
      setLoading(false);
      setError('Missing file or type.');
      return;
    }
    if (fileType === 'image') {
      setLoading(false);
      setBody(null);
      return;
    }
    void (async () => {
      const res = await loadOfflinePreview(uri, fileType);
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setBody(res.body);
      } else {
        setError(res.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, fileType]);

  const handleOpenExternal = useCallback(async () => {
    if (!uri || !fileType) return;
    try {
      setOpening(true);
      await openFileWithOtherApps(uri, fileType);
    } catch {
      // cancelled or no app
    } finally {
      setOpening(false);
    }
  }, [uri, fileType]);

  const handleCopy = useCallback(async () => {
    if (!body) return;
    await Clipboard.setStringAsync(body);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // optional
    }
    setCopiedFlash(true);
  }, [body]);

  useEffect(() => {
    if (!copiedFlash) return;
    const id = setTimeout(() => setCopiedFlash(false), 2000);
    return () => clearTimeout(id);
  }, [copiedFlash]);

  const showCopy = Boolean(body && fileType && fileType !== 'image' && !loading && !error);
  const showTruncationNote = Boolean(body?.includes('… (preview truncated)'));
  const useMarkdown = Boolean(body && isMarkdownFileName(title, fileType));

  const bodyTextStyle = [
    styles.bodyReadable,
    fileType === 'excel' ? styles.bodyMono : null,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PreviewScreenHeader
        title={headerTitle}
        onBack={() => router.back()}
        onOpenInApp={fileType ? handleOpenExternal : undefined}
        openLoading={opening}
        subtitle={subtitle}
      />

      {copiedFlash ? (
        <View style={styles.copiedBanner}>
          <Text style={styles.copiedBannerText}>{PREVIEW_COPY.copied}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centerText}>{PREVIEW_COPY.loading}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorTitle}>{PREVIEW_COPY.unavailableTitle}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          {fileType ? (
            <TouchableOpacity style={styles.openBtn} onPress={handleOpenExternal} activeOpacity={0.8}>
              <Text style={styles.openBtnText}>{PREVIEW_COPY.openInAppShort}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : fileType === 'image' && uri ? (
        <GestureHandlerRootView style={styles.imageColumn}>
          <View style={styles.imageZoomHost}>
            <ZoomableImage uri={uri} style={styles.previewImage} />
          </View>
        </GestureHandlerRootView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {showCopy ? (
            <TouchableOpacity
              style={styles.copyRow}
              onPress={() => void handleCopy()}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={PREVIEW_COPY.copyText}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.primary} />
              <Text style={styles.copyRowText}>{PREVIEW_COPY.copyText}</Text>
            </TouchableOpacity>
          ) : null}
          {useMarkdown ? (
            <SimpleMarkdownPreview markdown={body!} bodyStyle={styles.bodyReadable} />
          ) : (
            <Text style={bodyTextStyle} selectable>
              {body}
            </Text>
          )}
          {showTruncationNote ? (
            <Text style={styles.footer}>Part of the file is hidden in this preview for performance.</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  copiedBanner: {
    backgroundColor: Colors.surfaceHighlight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  copiedBannerText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  centerText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  errorBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: Typography.lineHeightBase,
  },
  openBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  openBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },
  imageColumn: {
    flex: 1,
  },
  imageZoomHost: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  previewImage: {
    width: '100%',
    minHeight: 280,
    maxHeight: 720,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  bodyReadable: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
  },
  bodyMono: {
    fontSize: Typography.fontSizeSm,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 22,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  copyRowText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  footer: {
    marginTop: Spacing.lg,
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
  },
});
