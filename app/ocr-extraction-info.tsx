import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { FREE_OCR_BASE_READS, FREE_OCR_WEEKLY_BONUS } from '@/services/limits';

const SECTIONS = [
  {
    icon: 'camera-outline' as const,
    title: 'How to enable',
    body:
      'When you add a document, use “Text from photo (OCR)” on the first screen, or the same chip under Camera / Import, before you scan or pick an image. OCR options (mode and language) are on that screen—not in Settings. Nothing is read until you opt in.',
  },
  {
    icon: 'phone-portrait-outline' as const,
    title: 'On your device',
    body:
      'Text recognition runs on-device when you use this feature. Vault does not send your photos to a server for OCR.',
  },
  {
    icon: 'contrast-outline' as const,
    title: 'Clear, legible text',
    body:
      'Text in the photo must be sharp and readable—good lighting, no heavy blur, and contrast between letters and background. Very small, faint, or skewed text may not be recognized reliably.',
  },
  {
    icon: 'search-outline' as const,
    title: 'Vault search',
    body:
      'After text is saved with a document, you can find it with the vault search bar — the same way you search titles, notes, and tags.',
  },
  {
    icon: 'copy-outline' as const,
    title: 'Free plan & Pro',
    body: `On the Free plan you start with ${FREE_OCR_BASE_READS} on-device reads for new photos and imports, and get +${FREE_OCR_WEEKLY_BONUS} additional reads every week. Duplicating a document copies text that was already extracted and does not use another read. Pro does not cap how often you can extract text.`,
  },
] as const;

export default function OcrExtractionInfoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Text from photo</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="text-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>OCR text extraction</Text>
          <Text style={styles.heroSubtitle}>
            Optional on-device reading of text in photos so you can copy it and find it in search.
          </Text>
        </View>

        <View style={styles.card}>
          {SECTIONS.map((item, i) => (
            <View
              key={item.title}
              style={[styles.row, i < SECTIONS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={20} color={Colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.noteText}>
            If “Text from photo” is off, new photos are not scanned for text. Existing documents keep any text that was
            already saved.
          </Text>
        </View>
      </ScrollView>
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
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: Typography.lineHeightBase,
  },
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  rowBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
  },
  noteText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
});
