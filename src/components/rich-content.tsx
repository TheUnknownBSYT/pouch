import { useColorScheme } from '@/contexts/SettingsContext';
/**
 * RichContent — renders item text with only URL portions styled as tappable links.
 *
 * Example: "youtube https://youtube.com/watch?v=abc"
 *   → "youtube " in normal color, URL in blue and pressable.
 */
import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { useThemeColors } from '@/constants/ui';
import { openLink, splitContentByUrls } from '@/lib/urls';

interface RichContentProps {
  content: string;
  /** Outer text style (applies to the whole block). */
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Extra style when the whole row is also pressable (e.g. strikethrough for done tasks). */
  muted?: boolean;
}

export function RichContent({ content, style, numberOfLines, muted }: RichContentProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const segments = useMemo(() => splitContentByUrls(content), [content]);

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[style, muted ? styles.muted : null, { color: theme.text }]}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={`t-${index}`}>{segment.value}</Text>;
        }

        return (
          <Text
            key={`l-${index}`}
            style={[styles.link, { color: theme.accent }]}
            accessibilityRole="link"
            onPress={(event) => { event.stopPropagation(); void openLink(segment.url); }}
            suppressHighlighting={false}>
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
}

/** Same as RichContent but for detail view — slightly larger, no line limit. */
export function RichContentDetail({ content, style }: RichContentProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const segments = useMemo(() => splitContentByUrls(content), [content]);

  return (
    <Text style={[styles.detail, style, { color: theme.text }]}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <Text key={`t-${index}`}>{segment.value}</Text>;
        }

        return (
          <Text
            key={`l-${index}`}
            style={[styles.link, styles.detailLink, { color: theme.accent }]}
            accessibilityRole="link"
            onPress={(event) => { event.stopPropagation(); void openLink(segment.url); }}>
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  detail: {
    fontSize: 18,
    lineHeight: 28,
  },
  detailLink: {
    fontSize: 18,
  },
  muted: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
});
