import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { DocumentCard } from '@/components/document/DocumentCard';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Document } from '@/db/types';

// #region agent log
function sendDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  fetch('http://127.0.0.1:7480/ingest/66512b4c-ea2c-44b0-a600-fed3b773abbf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '8dfdc1',
    },
    body: JSON.stringify({
      sessionId: '8dfdc1',
      runId: 'drawer-warning-pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export default function HomeScreen() {
  const navigation = useNavigation();
  const { documents, categories, selectedCategoryId, searchQuery } = useAppStore();

  useEffect(() => {
    // #region agent log
    sendDebugLog('H4', 'app/(drawer)/index.tsx:46', 'home-screen-mounted', {
      documentsCount: documents.length,
      categoriesCount: categories.length,
      selectedCategoryId,
      searchQueryLength: searchQuery.length,
    });
    // #endregion
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const headerTitle = searchQuery
    ? `Results for "${searchQuery}"`
    : selectedCategory
    ? selectedCategory.name
    : 'All Documents';

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <DocumentCard document={item} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton} activeOpacity={0.7}>
          <Ionicons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {selectedCategory && (
            <Ionicons name={selectedCategory.icon_name as any} size={16} color={Colors.primary} style={styles.headerIcon} />
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/capture')}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDocument}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState searchQuery={searchQuery} />}
      />
    </SafeAreaView>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  if (searchQuery) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          No documents matched "{searchQuery}". Try a different search term.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No documents yet</Text>
      <Text style={styles.emptySubtitle}>
        Scan a receipt, warranty, or ID to start building your secure archive.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/capture')}
        activeOpacity={0.7}
      >
        <Ionicons name="camera-outline" size={18} color={Colors.white} />
        <Text style={styles.emptyButtonText}>Scan Document</Text>
      </TouchableOpacity>
    </View>
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerIcon: {
    marginRight: 2,
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
