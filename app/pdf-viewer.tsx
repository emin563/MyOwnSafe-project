import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { PdfDocumentView } from '@/components/pdf/PdfDocumentView';
import { PreviewScreenHeader } from '@/components/preview/PreviewScreenHeader';
import { openFileWithOtherApps } from '@/services/openWithExternal';
import { PREVIEW_COPY } from '@/constants/previewCopy';
import { Colors, Spacing, Typography } from '@/theme';

export default function PdfViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();
  const [openingExternal, setOpeningExternal] = useState(false);

  const isRemote = uri ? /^https?:\/\//i.test(uri) : false;
  const viewerUri = uri && isRemote ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}` : uri ?? '';
  const headerTitle = title?.trim() || 'PDF';

  const openInOtherApp = async () => {
    if (!uri || isRemote) return;
    try {
      setOpeningExternal(true);
      await openFileWithOtherApps(uri, 'pdf');
    } catch {
      // user may cancel
    } finally {
      setOpeningExternal(false);
    }
  };

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PreviewScreenHeader title={PREVIEW_COPY.screenTitle} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No PDF selected</Text>
          <Text style={styles.errorText}>Open a PDF from a document or import preview.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PreviewScreenHeader
        title={headerTitle}
        onBack={() => router.back()}
        onOpenInApp={isRemote ? undefined : openInOtherApp}
        openLoading={openingExternal}
        subtitle={PREVIEW_COPY.pdfSubtitle}
      />

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
    lineHeight: Typography.lineHeightBase,
  },
  web: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
