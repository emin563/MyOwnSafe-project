import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { PromptCard } from '@/components/prompt/PromptCard';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Prompt } from '@/db/types';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { prompts, categories, selectedCategoryId, searchQuery } = useAppStore();

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const headerTitle = searchQuery
    ? `Results for "${searchQuery}"`
    : selectedCategory
    ? selectedCategory.name
    : 'All Prompts';

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const renderPrompt = ({ item }: { item: Prompt }) => (
    <PromptCard prompt={item} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/prompt/new')}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={prompts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPrompt}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState />}
      />
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No prompts yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the{' '}
        <Text style={styles.emptyHighlight}>+</Text>
        {' '}button to create your first prompt
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/prompt/new')}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={18} color={Colors.white} />
        <Text style={styles.emptyButtonText}>New Prompt</Text>
      </TouchableOpacity>
    </View>
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
  addButton: {
    padding: Spacing.xs,
  },
  list: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyHighlight: {
    color: Colors.primary,
    fontWeight: Typography.fontWeightBold,
    fontSize: Typography.fontSizeMd,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
});
