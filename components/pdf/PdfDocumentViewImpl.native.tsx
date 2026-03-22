import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Colors, Spacing, Typography } from '@/theme';

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
      }>;
    } catch {
      return null;
    }
  }, []);

  const sourceUri = normalizeFileUri(uri);

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
        source={{ uri: sourceUri, cache: true }}
        style={styles.pdf}
        trustAllCerts={false}
        enablePaging
        horizontal={false}
        fitPolicy={0}
        onLoadComplete={(numberOfPages) => {
          setLoadError(null);
          setPages(numberOfPages);
          setCurrentPage(1);
        }}
        onPageChanged={(page, numberOfPages) => {
          setCurrentPage(page);
          setPages(numberOfPages);
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
});

