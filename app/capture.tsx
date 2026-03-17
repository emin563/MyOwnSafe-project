import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { saveFileToArchive } from '@/services/StorageService';
import { getTotalFileCount } from '@/db/documents';
import { useAppStore } from '@/store/app-store';
import { authFlags } from '@/store/auth-flags';
import type { FileType } from '@/db/types';
import { LimitReachedDialog, PaywallModal } from '@/components/ui';
import { createPdfFromImages } from '@/services/PdfService';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { getFreeLimit } from '@/services/limits';

const FREE_DOCUMENT_LIMIT = getFreeLimit('documents');

export default function CaptureScreen() {
  const { tab: paramTab } = useLocalSearchParams<{ tab?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [multiPageMode, setMultiPageMode] = useState(false);
  const [multiPageImages, setMultiPageImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'camera' | 'import'>(
    paramTab === 'import' ? 'import' : 'camera'
  );
  const [limitVisible, setLimitVisible] = useState(false);
  const [limitKind, setLimitKind] = useState<'documents'>('documents');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  // Prevent lock from showing when app goes to background while on this screen (e.g. picker or back).
  useEffect(() => {
    authFlags.systemPickerOpen = true;
    return () => {
      authFlags.systemPickerOpen = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'camera' && !permission?.granted) {
      requestPermission();
    }
  }, [activeTab, permission?.granted, requestPermission]);

  const checkSlotLimit = async (): Promise<boolean> => {
    const { isPro } = useAppStore.getState();
    if (isPro) return true;
    const totalFiles = await getTotalFileCount();
    if (totalFiles >= FREE_DOCUMENT_LIMIT) {
      setLimitKind('documents');
      setLimitVisible(true);
      return false;
    }
    return true;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) {
      return;
    }
    if (!(await checkSlotLimit())) {
      return;
    }
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) return;
      if (multiPageMode) {
        setMultiPageImages((prev) => [...prev, photo.uri]);
        return;
      }
      const permanentUri = await saveFileToArchive(photo.uri);
      router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'image' } });
    } catch (error) {
      Alert.alert('Capture Failed', 'Could not capture the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleFinishMultiPage = async () => {
    if (capturing) return;
    if (multiPageImages.length === 0) return;
    if (!(await checkSlotLimit())) return;
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const pdfTempUri = await createPdfFromImages(multiPageImages);
      const pdfName = `scan_${Date.now()}.pdf`;
      const permanentUri = await saveFileToArchive(pdfTempUri, pdfName);
      setMultiPageImages([]);
      setMultiPageMode(false);
      router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'pdf' } });
    } catch {
      Alert.alert('PDF Failed', 'Could not create the PDF. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleImportImage = async () => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      if (result.assets.length === 1) {
        const permanentUri = await saveFileToArchive(result.assets[0].uri);
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'image' } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (const asset of result.assets) {
        const permanentUri = await saveFileToArchive(asset.uri);
        const name = (asset as any)?.fileName || (asset as any)?.filename;
        bulk.push({ fileUri: permanentUri, fileType: 'image', name });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the images. Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportPdf = async () => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: Platform.OS === 'android',
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      if (result.assets.length === 1) {
        const permanentUri = await saveFileToArchive(result.assets[0].uri, `doc_${Date.now()}.pdf`);
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType: 'pdf' } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const inferredName = asset.name || `doc_${Date.now()}_${i}.pdf`;
        const permanentUri = await saveFileToArchive(asset.uri, inferredName);
        bulk.push({ fileUri: permanentUri, fileType: 'pdf', name: inferredName });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the PDF(s). Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportDocuments = async (
    pickerType: string | string[],
    fileType: FileType,
    defaultExt: string
  ) => {
    try {
      authFlags.systemPickerOpen = true;
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerType,
        copyToCacheDirectory: true,
        multiple: Platform.OS === 'android',
      });
      if (result.canceled || !result.assets?.length) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const totalFiles = await getTotalFileCount();
      const { isPro } = useAppStore.getState();
      const slotsLeft = isPro ? result.assets.length : Math.max(0, FREE_DOCUMENT_LIMIT - totalFiles);
      if (!isPro && result.assets.length > slotsLeft) {
        setLimitKind('documents');
        setLimitVisible(true);
        return;
      }
      const getFileName = (uri: string, name?: string, i?: number) => {
        const ext = name?.split('.').pop()?.toLowerCase() || defaultExt;
        return name && /\.(docx?|xlsx?|txt|csv)$/i.test(name) ? name : `doc_${Date.now()}${i !== undefined ? `_${i}` : ''}.${ext}`;
      };
      if (result.assets.length === 1) {
        const asset = result.assets[0];
        const permanentUri = await saveFileToArchive(asset.uri, getFileName(asset.uri, asset.name));
        router.replace({ pathname: '/document/[id]', params: { id: 'new', fileUri: permanentUri, fileType } });
        return;
      }
      const bulk: { fileUri: string; fileType: FileType; name?: string }[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const pickedName = getFileName(asset.uri, asset.name, i);
        const permanentUri = await saveFileToArchive(asset.uri, pickedName);
        bulk.push({ fileUri: permanentUri, fileType, name: pickedName });
      }
      useAppStore.getState().setPendingBulkImports(bulk);
      router.replace('/document/import-review');
    } catch {
      Alert.alert('Import Failed', 'Could not import the file(s). Please try again.');
    } finally {
      authFlags.systemPickerOpen = false;
    }
  };

  const handleImportWord = () =>
    handleImportDocuments(
      [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      'word',
      'docx'
    );

  const handleImportExcel = () =>
    handleImportDocuments(
      [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      'excel',
      'xlsx'
    );

  const handleImportOther = () =>
    handleImportDocuments(
      ['text/plain', 'text/csv', 'application/csv'],
      'document',
      'txt'
    );

  return (
    <>
      <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Document</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'camera' && styles.tabActive]}
          onPress={() => setActiveTab('camera')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="camera-outline"
            size={16}
            color={activeTab === 'camera' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'import' && styles.tabActive]}
          onPress={() => setActiveTab('import')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={16}
            color={activeTab === 'import' ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'import' && styles.tabTextActive]}>Import</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'camera' ? (
        <CameraTab
          permission={permission}
          requestPermission={requestPermission}
          cameraRef={cameraRef}
          facing={facing}
          flash={flash}
          capturing={capturing}
          onCapture={handleCapture}
          onFlipCamera={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          onToggleFlash={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          multiPageMode={multiPageMode}
          pageCount={multiPageImages.length}
          onToggleMultiPage={() => {
            const { isPro } = useAppStore.getState();
            if (!isPro) {
              setPaywallVisible(true);
              return;
            }
            setMultiPageMode((v) => {
              const next = !v;
              if (!next) setMultiPageImages([]);
              return next;
            });
          }}
          onFinishMultiPage={handleFinishMultiPage}
        />
      ) : (
        <ImportTab
          onImportImage={handleImportImage}
          onImportPdf={handleImportPdf}
          onImportWord={handleImportWord}
          onImportExcel={handleImportExcel}
          onImportOther={handleImportOther}
        />
      )}
    </SafeAreaView>
      <LimitReachedDialog
        visible={limitVisible}
        kind={limitKind}
        onClose={() => setLimitVisible(false)}
        onUpgrade={async () => {
          await useAppStore.getState().setIsPro(true);
        }}
        onManage={() => router.replace('/(drawer)')}
      />
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={() => {
          useAppStore.getState().setIsPro(true);
          setPaywallVisible(false);
        }}
        onRestore={() => {
          useAppStore.getState().setIsPro(true);
          setPaywallVisible(false);
        }}
      />
    </>
  );
}

type CameraTabProps = {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  cameraRef: React.RefObject<CameraView | null>;
  facing: 'back' | 'front';
  flash: 'off' | 'on';
  capturing: boolean;
  onCapture: () => void;
  onFlipCamera: () => void;
  onToggleFlash: () => void;
  multiPageMode: boolean;
  pageCount: number;
  onToggleMultiPage: () => void;
  onFinishMultiPage: () => void;
};

function CameraTab({
  permission,
  requestPermission,
  cameraRef,
  facing,
  flash,
  capturing,
  onCapture,
  onFlipCamera,
  onToggleFlash,
  multiPageMode,
  pageCount,
  onToggleMultiPage,
  onFinishMultiPage,
}: CameraTabProps) {
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          Allow camera access to scan and capture documents directly.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <View style={styles.cameraPreview}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash}
        />
        <View pointerEvents="none" style={styles.cameraOverlay}>
          <View style={styles.scanFrame} />
        </View>
      </View>

      <View style={styles.multiRow}>
        <TouchableOpacity
          style={[styles.multiChip, multiPageMode && styles.multiChipActive]}
          onPress={onToggleMultiPage}
          activeOpacity={0.7}
        >
          <Ionicons name="document-outline" size={16} color={multiPageMode ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.multiChipText, multiPageMode && styles.multiChipTextActive]}>
            Multi-page PDF
          </Text>
          {multiPageMode && (
            <View style={styles.multiCount}>
              <Text style={styles.multiCountText}>{pageCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {multiPageMode && (
          <TouchableOpacity
            style={[styles.multiFinishBtn, pageCount === 0 && styles.multiFinishBtnDisabled]}
            onPress={onFinishMultiPage}
            disabled={pageCount === 0 || capturing}
            activeOpacity={0.8}
          >
            <Text style={styles.multiFinishText}>Finish</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.cameraControlBtn} onPress={onToggleFlash} activeOpacity={0.7}>
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={22}
            color={flash === 'on' ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={onCapture}
          activeOpacity={0.8}
          disabled={capturing}
        >
          {capturing ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <View style={styles.captureBtnInner} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cameraControlBtn} onPress={onFlipCamera} activeOpacity={0.7}>
          <Ionicons name="camera-reverse-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cameraHint}>Position the document within the frame</Text>
    </View>
  );
}

type ImportTabProps = {
  onImportImage: () => void;
  onImportPdf: () => void;
  onImportWord: () => void;
  onImportExcel: () => void;
  onImportOther: () => void;
};

function ImportTab({
  onImportImage,
  onImportPdf,
  onImportWord,
  onImportExcel,
  onImportOther,
}: ImportTabProps) {
  return (
    <ScrollView
      style={styles.importScroll}
      contentContainerStyle={styles.importScrollContent}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.importTitle}>Import from Device</Text>
      <Text style={styles.importSubtitle}>
        Select a photo, document, or file from your device storage.
      </Text>

      <TouchableOpacity style={styles.importCard} onPress={onImportImage} activeOpacity={0.7}>
        <View style={styles.importIcon}>
          <Ionicons name="image-outline" size={32} color={Colors.primary} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Photo / Image</Text>
          <Text style={styles.importCardSubtitle}>JPG, PNG, HEIC from your gallery</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportPdf} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconPdf]}>
          <Ionicons name="document-outline" size={32} color={Colors.danger} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>PDF Document</Text>
          <Text style={styles.importCardSubtitle}>Import a PDF file from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportWord} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconWord]}>
          <Ionicons name="document-text-outline" size={32} color="#2b579a" />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Word Document</Text>
          <Text style={styles.importCardSubtitle}>DOC, DOCX from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportExcel} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconExcel]}>
          <Ionicons name="grid-outline" size={32} color="#217346" />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Excel Spreadsheet</Text>
          <Text style={styles.importCardSubtitle}>XLS, XLSX from your device</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.importCard} onPress={onImportOther} activeOpacity={0.7}>
        <View style={[styles.importIcon, styles.importIconOther]}>
          <Ionicons name="document-attach-outline" size={32} color={Colors.textSecondary} />
        </View>
        <View style={styles.importCardText}>
          <Text style={styles.importCardTitle}>Other (Text, CSV)</Text>
          <Text style={styles.importCardSubtitle}>TXT, CSV and other documents</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  tabActive: {
    backgroundColor: 'rgba(16, 163, 127, 0.12)',
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightMedium,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.base,
  },
  permissionTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
    lineHeight: Typography.lineHeightBase,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    marginTop: Spacing.sm,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraPreview: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '85%',
    height: '70%',
    borderWidth: 2,
    borderColor: 'rgba(16, 163, 127, 0.7)',
    borderRadius: Radius.lg,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  multiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  multiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  multiChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(16, 163, 127, 0.14)',
  },
  multiChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  multiChipTextActive: {
    color: Colors.primary,
  },
  multiCount: {
    marginLeft: Spacing.xs,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  multiCountText: {
    color: Colors.white,
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightBold,
  },
  multiFinishBtn: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 6,
  },
  multiFinishBtnDisabled: {
    opacity: 0.5,
  },
  multiFinishText: {
    color: Colors.white,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
  },
  cameraControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.borderLight,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
  cameraHint: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
    paddingBottom: Spacing.base,
    backgroundColor: Colors.background,
  },
  importScroll: {
    flex: 1,
  },
  importScrollContent: {
    padding: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl + 60,
  },
  importTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: Spacing.xs,
  },
  importSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    marginBottom: Spacing.xl,
  },
  importCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.base,
  },
  importIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(16, 163, 127, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconPdf: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  importIconWord: {
    backgroundColor: 'rgba(43, 87, 154, 0.12)',
  },
  importIconExcel: {
    backgroundColor: 'rgba(33, 115, 70, 0.12)',
  },
  importIconOther: {
    backgroundColor: Colors.surfaceHighlight,
  },
  importCardText: {
    flex: 1,
  },
  importCardTitle: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    marginBottom: 2,
  },
  importCardSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
});
