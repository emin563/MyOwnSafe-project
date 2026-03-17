import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Colors, Spacing, Typography } from '@/theme';

export default function PdfViewerScreen() {
  const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();

  if (!uri) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PDF</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No PDF selected</Text>
          <Text style={styles.errorText}>Please open a PDF from a document.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use Google Docs viewer for remote URLs; for file:// URIs, WebView can render on Android,
  // while iOS can be finicky. This is a pragmatic baseline; we can improve with base64 later.
  const isRemote = /^https?:\/\//i.test(uri);
  const viewerUri = isRemote ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(uri)}` : uri;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'PDF'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <WebView
        source={{ uri: viewerUri }}
        style={styles.web}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
      />
    </SafeAreaView>
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
});

