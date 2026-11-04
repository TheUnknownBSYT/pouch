import { ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { getTypeColor, radii, spacing, typography, useThemeColors } from '@/constants/ui';
import { itemTypeLabel } from '@/lib/classifyItem';
import type { ItemType } from '@/types/item';

export type InboxFilter = 'all' | ItemType;

const FILTERS: InboxFilter[] = ['all', 'link', 'task', 'expense', 'contact', 'quote', 'note'];

interface FilterBarProps {
  active: InboxFilter;
  counts: Record<InboxFilter, number>;
  onChange: (filter: InboxFilter) => void;
}

export function FilterBar({ active, counts, onChange }: FilterBarProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.container}
      showsHorizontalScrollIndicator={false}>
      {[...FILTERS, ...(counts.unsorted > 0 ? ['unsorted' as const] : [])].map((filter) => {
        const selected = active === filter;
        const label = filter === 'all' ? 'All' : itemTypeLabel(filter);
        const count = counts[filter];
        const accent = filter === 'all' ? theme.accent : getTypeColor(filter);

        return (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter}
            onPress={() => onChange(filter)}
            scaleTo={0.95}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.accentMuted : 'transparent',
              },
            ]}>
            <Text style={[styles.chipText, { color: selected ? accent : theme.textMuted }]}>
              {label}
              {count > 0 ? ` · ${count}` : ''}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  chipText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
});
