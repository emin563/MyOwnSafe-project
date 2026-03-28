import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import {
  GOOGLE_PRIVACY_CHOICE,
  GOOGLE_PRIVACY_DRIVE,
  GOOGLE_PRIVACY_SCANNER,
  GOOGLE_PRIVACY_SECTION_TITLE,
} from '@/constants/googleServicesPrivacy';

const FACTS = [
  {
    icon: 'person-circle-outline',
    title: 'No account required',
    description: 'You can use Vault without signing up or logging in.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'No cloud upload by default',
    description: 'Vault does not upload your documents anywhere unless you explicitly share/export.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Stored on-device',
    description: 'Your files are saved locally in your vault storage on this device.',
  },
  {
    icon: 'eye-off-outline',
    title: 'No tracking / analytics',
    description: 'Vault does not include tracking or analytics SDKs.',
  },
] as const;

export default function PrivacyOfflineScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Offline</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Your vault stays under your control</Text>
          <Text style={styles.heroSubtitle}>
            Vault is designed to work offline-first. These are the core privacy facts about how your data is handled.
          </Text>
        </View>

        <View style={styles.card}>
          {FACTS.map((item) => (
            <View key={item.title} style={styles.factRow}>
              <View style={styles.factIcon}>
                <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
              </View>
              <View style={styles.factText}>
                <Text style={styles.factTitle}>{item.title}</Text>
                <Text style={styles.factDesc}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeading}>{GOOGLE_PRIVACY_SECTION_TITLE}</Text>
        <View style={styles.card}>
          <View style={styles.factRow}>
            <View style={styles.factIcon}>
              <Ionicons name="scan-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.factText}>
              <Text style={styles.factTitle}>{GOOGLE_PRIVACY_SCANNER.title}</Text>
              <Text style={styles.factDesc}>{GOOGLE_PRIVACY_SCANNER.body}</Text>
            </View>
          </View>
          <View style={[styles.factRow, styles.factRowLast]}>
            <View style={styles.factIcon}>
              <Ionicons name="logo-google" size={20} color={Colors.primary} />
            </View>
            <View style={styles.factText}>
              <Text style={styles.factTitle}>{GOOGLE_PRIVACY_DRIVE.title}</Text>
              <Text style={styles.factDesc}>{GOOGLE_PRIVACY_DRIVE.body}</Text>
            </View>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.noteText}>{GOOGLE_PRIVACY_CHOICE}</Text>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.noteText}>
            If you share a document (for example Open in another app or Save to device), your OS and the receiving app
            will handle the file.
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
  sectionHeading: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  factRowLast: {
    borderBottomWidth: 0,
  },
  factIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factText: {
    flex: 1,
    gap: 2,
  },
  factTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  factDesc: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  noteText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
  },
});
