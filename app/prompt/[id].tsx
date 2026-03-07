import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { getPromptById } from '@/db/prompts';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Prompt } from '@/db/types';
import type { Category } from '@/db/types';

export default function PromptEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { categories, addPrompt, editPrompt, selectedCategoryId } = useAppStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(selectedCategoryId);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadPrompt();
    }
  }, [id]);

  const loadPrompt = async () => {
    const prompt = await getPromptById(Number(id));
    if (prompt) {
      setTitle(prompt.title);
      setContent(prompt.content);
      setCategoryId(prompt.category_id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and content.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await addPrompt(title.trim(), content.trim(), categoryId);
      } else {
        await editPrompt(Number(id), title.trim(), content.trim(), categoryId);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!content.trim()) return;
    await Clipboard.setStringAsync(content.trim());
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNew ? 'New Prompt' : 'Edit Prompt'}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleCopy}
              style={[styles.headerBtn, copied && styles.headerBtnActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={20}
                color={copied ? Colors.primary : Colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Prompt title..."
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            autoFocus={isNew}
          />

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.categorySelector}
            onPress={() => setCategoryPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.categorySelectorText}>
              {selectedCategory ? selectedCategory.name : 'Select category (optional)'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Write your prompt here..."
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primary}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryPicker
        visible={categoryPickerVisible}
        categories={categories}
        selectedId={categoryId}
        onSelect={(cat) => {
          setCategoryId(cat?.id ?? null);
          setCategoryPickerVisible(false);
        }}
        onClose={() => setCategoryPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

type CategoryPickerProps = {
  visible: boolean;
  categories: Category[];
  selectedId: number | null;
  onSelect: (category: Category | null) => void;
  onClose: () => void;
};

function CategoryPicker({ visible, categories, selectedId, onSelect, onClose }: CategoryPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={pickerStyles.sheet}>
          <TouchableOpacity activeOpacity={1}>
            <View style={pickerStyles.handle} />
            <Text style={pickerStyles.title}>Select Category</Text>
            <TouchableOpacity
              style={[pickerStyles.item, selectedId === null && pickerStyles.itemActive]}
              onPress={() => onSelect(null)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="layers-outline"
                size={18}
                color={selectedId === null ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[pickerStyles.itemText, selectedId === null && pickerStyles.itemTextActive]}>
                No category
              </Text>
              {selectedId === null && (
                <Ionicons name="checkmark" size={18} color={Colors.primary} />
              )}
            </TouchableOpacity>
            <View style={pickerStyles.divider} />
            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              style={pickerStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[pickerStyles.item, selectedId === item.id && pickerStyles.itemActive]}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={[pickerStyles.dot, selectedId === item.id && pickerStyles.dotActive]} />
                  <Text
                    style={[pickerStyles.itemText, selectedId === item.id && pickerStyles.itemTextActive]}
                  >
                    {item.name}
                  </Text>
                  {selectedId === item.id && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={pickerStyles.emptyText}>No categories. Create one from the sidebar.</Text>
              }
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
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
  headerBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  headerBtnActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  titleInput: {
    color: Colors.text,
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightSemibold,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    minHeight: 60,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  categorySelectorText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  contentInput: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    minHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceRaised,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xxxl,
    maxHeight: '60%',
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
    marginBottom: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  itemActive: {
    backgroundColor: Colors.surfaceHighlight,
  },
  itemText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
  },
  itemTextActive: {
    color: Colors.text,
    fontWeight: Typography.fontWeightMedium,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  list: {
    maxHeight: 300,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
