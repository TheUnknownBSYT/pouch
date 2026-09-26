import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { radii, spacing, useThemeColors } from '@/constants/ui';
import { itemTypeLabel } from '@/lib/classifyItem';
import type { ItemType } from '@/types/item';

interface TypePickerProps {
  value: ItemType;
  onChange: (type: ItemType) => void;
}

const TYPES: ItemType[] = ['note', 'link', 'task', 'expense', 'contact', 'quote'];

export function TypePicker({ value, onChange }: TypePickerProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  return (
    <View style={styles.row}>
      {TYPES.map((type) => {
        const selected = value === type;
        return (
          <PressableScale
            key={type}
            scaleTo={0.95}
            onPress={() => onChange(type)}
            style={[
              styles.chip,
              { backgroundColor: selected ? theme.accent : theme.inputBackground },
            ]}>
            <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.text }]}>
              {itemTypeLabel(type)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
