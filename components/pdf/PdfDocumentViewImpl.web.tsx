import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  uri: string;
};

/** Web: local archive PDFs are not rendered in-app in this build. */
export function PdfDocumentViewImpl(_props: Props) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Preview unavailable</Text>
      <Text style={styles.body}>Open this document in the Vault mobile app to view PDFs from your archive.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
