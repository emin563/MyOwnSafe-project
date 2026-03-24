import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Colors, Spacing, Typography } from '@/theme';
import { recordPerformanceMetric } from '@/services/performanceMetrics';
import { getLastPdfPage, setLastPdfPage } from '@/services/pdfViewState';

type Props = {
  uri: string;
};

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Pass through file:// URIs; react-native-pdf strips file:// internally. */
function normalizeFileUri(uri: string): string {
  try {
    return decodeURI(uri);
  } catch {
    return uri;
  }
}

/**
 * In-app PDF rendering (native builds). Not available in Expo Go — use a development build.
 */
export function PdfDocumentViewImpl({ uri }: Props) {
  const [pages, setPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [targetPageInput, setTargetPageInput] = useState('1');
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastInitializedUriRef = useRef<string | null>(null);
  const openStartedAtRef = useRef<number>(Date.now());
  const pageSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Pdf = useMemo(() => {
    if (isExpoGo()) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('react-native-pdf').default as React.ComponentType<{
        source: { uri: string; cache?: boolean };
        style: object;
        trustAllCerts?: boolean;
        onLoadComplete?: (numberOfPages: number) => void;
        onPageChanged?: (page: number, numberOfPages: number) => void;
        onError?: (error: Error) => void;
        enablePaging?: boolean;
        horizontal?: boolean;
        fitPolicy?: number;
        page?: number;
      }>;
    } catch {
      return null;
    }
  }, []);

  const sourceUri = normalizeFileUri(uri);
  const source = useMemo(() => ({ uri: sourceUri, cache: true }), [sourceUri]);

  useEffect(() => {
    openStartedAtRef.current = Date.now();
  }, [sourceUri]);

  useEffect(() => {
    return () => {
      if (pageSaveDebounceRef.current) {
        clearTimeout(pageSaveDebounceRef.current);
      }
    };
  }, []);

  if (isExpoGo() || !Pdf) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Preview unavailable</Text>
        <Text style={styles.body}>
          In-app PDF viewing needs a development or production build with native modules. Expo Go does not include the PDF
          viewer.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pdf
        source={source}
        style={styles.pdf}
        trustAllCerts={false}
        enablePaging
        horizontal={false}
        fitPolicy={0}
        page={Math.max(1, currentPage || 1)}
        onLoadComplete={(numberOfPages) => {
          const shouldInitForUri = lastInitializedUriRef.current !== sourceUri;
          if (shouldInitForUri) {
            lastInitializedUriRef.current = sourceUri;
          }
          setLoadError(null);
          setPages(numberOfPages);
          if (shouldInitForUri) {
            void (async () => {
              const saved = await getLastPdfPage(sourceUri);
              const initialPage = Math.min(numberOfPages, Math.max(1, saved ?? 1));
              setCurrentPage(initialPage);
              setTargetPageInput(String(initialPage));
              void recordPerformanceMetric('open_pdf', Date.now() - openStartedAtRef.current);
            })();
          }
        }}
        onPageChanged={(page, numberOfPages) => {
          setCurrentPage(page);
          setPages(numberOfPages);
          setTargetPageInput(String(page));
          if (pageSaveDebounceRef.current) {
            clearTimeout(pageSaveDebounceRef.current);
          }
          pageSaveDebounceRef.current = setTimeout(() => {
            void setLastPdfPage(sourceUri, page);
          }, 350);
        }}
        onError={(error) => {
          setLoadError(error?.message ?? 'Could not load PDF');
        }}
      />
      {loadError ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{loadError}</Text>
        </View>
      ) : null}
      {pages > 1 ? (
        <View style={styles.scrubber}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnText}>-</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.pageInput}
            value={targetPageInput}
            onChangeText={setTargetPageInput}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => {
              const parsed = Number.parseInt(targetPageInput, 10);
              if (Number.isNaN(parsed)) return;
              setCurrentPage(Math.min(pages, Math.max(1, parsed)));
            }}
          />
          <Text style={styles.scrubberLabel}>/ {pages}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentPage((p) => Math.min(pages, p + 1))}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {pages > 0 ? (
        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.pageLabel}>
            Page {currentPage} / {pages}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pdf: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeBase,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: Spacing.md,
    alignSelf: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  pageLabel: {
    color: Colors.text,
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightMedium,
  },
  banner: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 8,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerText: {
    color: Colors.danger,
    fontSize: Typography.fontSizeSm,
    textAlign: 'center',
  },
  scrubber: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    bottom: Spacing.xl + 28,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  scrubberLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSm,
  },
  pageInput: {
    minWidth: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    textAlign: 'center',
    color: Colors.text,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: Typography.fontSizeSm,
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navBtnText: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
  },
});

