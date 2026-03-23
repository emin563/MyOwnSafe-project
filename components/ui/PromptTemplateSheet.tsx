import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Typography } from '@/theme';
import { PillButton } from './PillButton';
import type { FileType } from '@/db/types';
import {
  filterPromptTemplates,
  renderPrompt,
  PROMPT_CATEGORIES,
  isFreePromptTemplate,
  type PromptTemplate,
  type PromptTemplate as PromptTemplateAsset,
} from '@/services/PromptTemplates';
import { useAppStore } from '@/store/app-store';
import { SearchInput } from './SearchInput';
import { PaywallModal } from './PaywallModal';

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinueToAi: () => void;
  document: {
    id: number;
    title: string;
    fileType: FileType;
    categoryName?: string | null;
  };
  fileUri: string;
};

export function PromptTemplateSheet({ visible, onClose, onContinueToAi, document, fileUri }: Props) {
  const { showToast, isPro, setIsPro } = useAppStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | (typeof PROMPT_CATEGORIES)[number]>('All');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const templates = useMemo(() => {
    return filterPromptTemplates({
      fileType: document.fileType,
      vaultCategoryName: document.categoryName ?? null,
      category,
      query,
    });
  }, [document.fileType, document.categoryName, category, query]);

  const docTypeLabel = useMemo(() => {
    switch (document.fileType) {
      case 'image':
        return 'image';
      case 'pdf':
        return 'PDF';
      case 'word':
        return 'Word document';
      case 'excel':
        return 'Excel spreadsheet';
      default:
        return 'document';
    }
  }, [document.fileType]);

  const categoryName = document.categoryName?.trim() ? document.categoryName!.trim() : 'Uncategorized';

  const copyTemplate = async (t: PromptTemplateAsset) => {
    const text = renderPrompt(t, { docTitle: document.title, docType: docTypeLabel, categoryName });
    await Clipboard.setStringAsync(text);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast('Prompt copied. Now choose an AI app.', 'success');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            onClose();
          }}
        />
        <View
          style={styles.sheet}
          onLayout={(e) => {
          }}
        >
          <View style={styles.content}>
            <View style={styles.handle} />

            <Text style={styles.title}>Use AI when you want</Text>
            <Text style={styles.subtitle}>
              {isPro
                ? 'Pick a prompt. We’ll copy it, then you can share the document to any AI app.'
                : 'Free includes one prompt template per category. Pro unlocks every template—same flow: copy, then share to any AI app.'}
            </Text>

            <SearchInput
              placeholder="Search prompts..."
              value={query}
              onChangeText={setQuery}
              containerStyle={{ marginBottom: Spacing.sm }}
            />

            <View style={styles.chipsWrap}>
              <TouchableOpacity
                style={[styles.chip, category === 'All' && styles.chipActive]}
                onPress={() => setCategory('All')}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, category === 'All' && styles.chipTextActive]} numberOfLines={1}>
                  All
                </Text>
              </TouchableOpacity>
              {PROMPT_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]} numberOfLines={1}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              style={styles.list}
              data={templates}
              keyExtractor={(t) => t.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              windowSize={7}
              removeClippedSubviews
              ListEmptyComponent={
                templates.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No prompts found</Text>
                    <Text style={styles.emptySubtitle}>
                      Try a different category or search term.
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                <View style={styles.privacyBox}>
                  <Text style={styles.privacyTitle}>Privacy note</Text>
                  <Text style={styles.privacyText}>
                    Sharing sends a copy to another app/service. Their privacy rules apply.
                  </Text>
                </View>
              }
              renderItem={({ item: t }) => (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{t.title}</Text>
                      <Text style={styles.cardDesc}>{t.description}</Text>
                    </View>
                    {!isPro && !isFreePromptTemplate(t.id) ? (
                      <View style={styles.proPill}>
                        <Ionicons name="lock-closed-outline" size={12} color={Colors.primary} />
                        <Text style={styles.proPillText}>Pro</Text>
                      </View>
                    ) : (
                      <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <PillButton
                      label={!isPro && !isFreePromptTemplate(t.id) ? 'Unlock Pro' : 'Copy prompt'}
                      variant="secondary"
                      size="md"
                      onPress={() => {
                        if (!isPro && !isFreePromptTemplate(t.id)) {
                          setPaywallVisible(true);
                          return;
                        }
                        copyTemplate(t);
                      }}
                      style={styles.copyBtn}
                      icon={
                        !isPro && !isFreePromptTemplate(t.id) ? (
                          <Ionicons name="lock-closed-outline" size={16} color={Colors.text} />
                        ) : (
                          <Ionicons name="copy-outline" size={16} color={Colors.text} />
                        )
                      }
                    />
                    <PillButton
                      label="Copy + Continue to AI"
                      variant="primary"
                      size="md"
                      onPress={async () => {
                        if (!isPro && !isFreePromptTemplate(t.id)) {
                          setPaywallVisible(true);
                          return;
                        }
                        await copyTemplate(t);
                        onContinueToAi();
                      }}
                      style={styles.continueBtn}
                      icon={<Ionicons name="arrow-forward" size={16} color={Colors.white} />}
                    />
                  </View>
                </View>
              )}
            />

            <View style={styles.actions}>
              <PillButton label="Close" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
              <PillButton
                label="Continue to AI"
                variant="primary"
                size="md"
                onPress={onContinueToAi}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>

        <PaywallModal
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          onUpgrade={() => {
            setIsPro(true);
            setPaywallVisible(false);
          }}
          onRestore={() => {
            setIsPro(true);
            setPaywallVisible(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Colors.surfaceRaised,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
    maxHeight: '85%',
    height: '85%',
  },
  content: {
    flex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.15)',
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightMedium,
    lineHeight: 16,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  proPillText: {
    color: Colors.primary,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  cardDesc: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 18,
  },
  copyBtn: {
    alignSelf: 'flex-start',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  continueBtn: {
    alignSelf: 'flex-start',
  },
  privacyBox: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  privacyTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 4,
  },
  privacyText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});

