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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { saveFileToArchive } from '@/services/StorageService';
import { getTotalFileCount } from '@/db/documents';
import { useAppStore } from '@/store/app-store';
import { PaywallModal } from '@/components/ui';
import { Colors, Spacing, Typography, Radius } from '@/theme';

const FREE_FILE_LIMIT = 3;

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'import'>('camera');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (activeTab === 'camera' && !permission?.granted) {
      requestPermission();
    }
  }, [activeTab, permission?.granted, requestPermission]);

  const checkSlotLimit = async (): Promise<boolean> => {
    const { isPro } = useAppStore.getState();
    if (isPro) return true;
    const totalFiles = await getTotalFileCount();
    if (totalFiles >= FREE_FILE_LIMIT) return false;
    return true;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) {
      return;
    }
    if (!(await checkSlotLimit())) {
      setPaywallVisible(true);
      return;
    }
    setCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) return;
      const permanentUri = await saveFileToArchive(photo.uri);
      router.replace({ pathname: '/document/new', params: { fileUri: permanentUri, fileType: 'image' } });
    } catch (error) {
      Alert.alert('Capture Failed', 'Could not capture the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleImportImage = async () => {
    if (!(await checkSlotLimit())) {
      setPaywallVisible(true);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permanentUri = await saveFileToArchive(result.assets[0].uri);
      router.replace({ pathname: '/document/new', params: { fileUri: permanentUri, fileType: 'image' } });
    } catch {
      Alert.alert('Import Failed', 'Could not import the image. Please try again.');
    }
  };

  const handleImportPdf = async () => {
    if (!(await checkSlotLimit())) {
      setPaywallVisible(true);
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permanentUri = await saveFileToArchive(result.assets[0].uri, `doc_${Date.now()}.pdf`);
      router.replace({ pathname: '/document/new', params: { fileUri: permanentUri, fileType: 'pdf' } });
    } catch {
      Alert.alert('Import Failed', 'Could not import the PDF. Please try again.');
    }
  };

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
        />
      ) : (
        <ImportTab onImportImage={handleImportImage} onImportPdf={handleImportPdf} />
      )}
    </SafeAreaView>
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
  cameraRef: React.RefObject<CameraView>;
  facing: 'back' | 'front';
  flash: 'off' | 'on';
  capturing: boolean;
  onCapture: () => void;
  onFlipCamera: () => void;
  onToggleFlash: () => void;
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
};

function ImportTab({ onImportImage, onImportPdf }: ImportTabProps) {
  return (
    <View style={styles.importContainer}>
      <Text style={styles.importTitle}>Import from Device</Text>
      <Text style={styles.importSubtitle}>
        Select an existing photo or PDF from your device storage.
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
    aspectRatio: 0.75,
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
  importContainer: {
    flex: 1,
    padding: Spacing.base,
    paddingTop: Spacing.xl,
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
