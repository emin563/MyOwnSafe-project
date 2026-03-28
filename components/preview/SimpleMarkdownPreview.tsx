import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/theme';

type Props = {
  markdown: string;
  /** Base text style for body (readable font) */
  bodyStyle?: object;
};

/**
 * Lightweight markdown for offline preview (headings, paragraphs, **bold**, bullets).
 * Not a full CommonMark implementation — keeps bundle small.
 */
export function SimpleMarkdownPreview({ markdown, bodyStyle }: Props) {
  const blocks = markdown.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  return (
    <View style={styles.wrap}>
      {blocks.map((block, bi) => (
        <Block key={bi} text={block} bodyStyle={bodyStyle} />
      ))}
    </View>
  );
}

function Block({ text, bodyStyle }: { text: string; bodyStyle?: object }) {
  const lines = text.split('\n');
  const first = lines[0] ?? '';

  if (first.startsWith('# ')) {
    return renderHeadingBlock(lines, 2, styles.h1, bodyStyle);
  }
  if (first.startsWith('## ')) {
    return renderHeadingBlock(lines, 3, styles.h2, bodyStyle);
  }
  if (first.startsWith('### ')) {
    return renderHeadingBlock(lines, 4, styles.h3, bodyStyle);
  }

  const allBullets = lines.every((l) => l.trim().startsWith('- ') || l.trim() === '');
  if (allBullets && lines.some((l) => l.trim().startsWith('- '))) {
    return (
      <View style={styles.list}>
        {lines.flatMap((line, i) => {
          const t = line.trim();
          if (!t.startsWith('- ')) return [];
          return (
            <Text key={`li-${i}`} style={[styles.li, bodyStyle]}>
              {'\u2022 '}
              <Inline text={t.slice(2)} bodyStyle={styles.li} />
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <Text style={[styles.p, bodyStyle]}>
      <Inline text={text} bodyStyle={styles.p} />
    </Text>
  );
}

function renderHeadingBlock(
  lines: string[],
  prefixLen: number,
  headingStyle: object,
  bodyStyle?: object
) {
  const headText = (lines[0] ?? '').slice(prefixLen);
  const rest = lines.slice(1).join('\n').trim();
  return (
    <View style={styles.headingBlock}>
      <Text style={[headingStyle, bodyStyle]}>
        <Inline text={headText} bodyStyle={headingStyle} />
      </Text>
      {rest ? (
        <Text style={[styles.p, bodyStyle, styles.headingRest]}>
          <Inline text={rest} bodyStyle={styles.p} />
        </Text>
      ) : null}
    </View>
  );
}

function Inline({ text, bodyStyle }: { text: string; bodyStyle: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          const inner = part.slice(2, -2);
          return (
            <Text key={i} style={[bodyStyle, styles.bold]}>
              {inner}
            </Text>
          );
        }
        return (
          <Text key={i} style={bodyStyle}>
            {part}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.md,
  },
  headingBlock: {
    marginBottom: Spacing.xs,
  },
  headingRest: {
    marginTop: Spacing.sm,
  },
  h1: {
    color: Colors.text,
    fontSize: Typography.fontSizeLg,
    fontWeight: Typography.fontWeightSemibold,
    lineHeight: 28,
  },
  h2: {
    color: Colors.text,
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    lineHeight: 24,
  },
  h3: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    fontWeight: Typography.fontWeightSemibold,
    lineHeight: 22,
  },
  p: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
  },
  li: {
    color: Colors.text,
    fontSize: Typography.fontSizeBase,
    lineHeight: Typography.lineHeightBase,
    marginBottom: Spacing.xs,
  },
  list: {
    marginBottom: Spacing.xs,
  },
  bold: {
    fontWeight: Typography.fontWeightSemibold,
  },
});
