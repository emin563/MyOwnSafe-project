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

const SECTIONS = [
  {
    icon: 'logo-android' as const,
    title: 'Why use system locks?',
    body:
      'To provide the most reliable and secure experience, Vault relies on your operating system’s built-in security. System locks are more secure and prevent bugs where apps accidentally lock while you are taking a photo or attaching a file.',
  },
  {
    icon: 'shield-half-outline' as const,
    title: 'Samsung (Secure Folder)',
    body:
      '1. Open your device Settings.\n2. Tap "Security and privacy" > "Secure Folder".\n3. Follow the setup steps.\n4. Open Secure Folder and tap "+" to add Vault.',
  },
  {
    icon: 'lock-closed-outline' as const,
    title: 'Pixel & Android 15 (Private Space)',
    body:
      '1. Open your app drawer (swipe up from the home screen).\n2. Scroll to the very bottom and tap "Private space".\n3. Set it up, then install or move Vault into this secure area.',
  },
  {
    icon: 'finger-print-outline' as const,
    title: 'Other Androids (App Lock)',
    body:
      'Brands like Xiaomi, OnePlus, Oppo, and Vivo have a native App Lock.\n\n1. Open your device Settings.\n2. Search for "App Lock" in the settings search bar.\n3. Turn it on and select Vault from the list of apps.',
  },
] as const;

export default function AppLockingInfoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Locking</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="lock-closed-outline" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Locking your Vault</Text>
          <Text style={styles.heroSubtitle}>
            How to secure your documents with your fingerprint, face, or device PIN using Android&apos;s native features.
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
            Depending on your specific Android version and manufacturer, the exact names of these settings might vary slightly.
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
    padding: Spacing.base,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 24,
    marginRight: Spacing.md,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
  },
  rowBody: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: Typography.lineHeightBase,
  },
  note: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  noteText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    lineHeight: Typography.lineHeightBase,
  },
});
