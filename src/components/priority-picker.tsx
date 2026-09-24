import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { getPriorityColor, radii, spacing, typography, useThemeColors } from '@/constants/ui';
import type { TaskPriority } from '@/types/item';
import { PRIORITY_LABELS } from '@/types/item';

interface PriorityPickerProps {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  return (
    <View style={styles.row}>
      {PRIORITIES.map((priority) => {
        const selected = value === priority;
        const color = getPriorityColor(priority);
        return (
          <PressableScale
            key={priority}
            scaleTo={0.96}
            onPress={() => onChange(priority)}
            style={[
              styles.chip,
              { backgroundColor: selected ? color : theme.inputBackground },
            ]}>
            <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.text }]}>
              {PRIORITY_LABELS[priority]}
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
    gap: spacing.sm,
  },
  chip: {
    alignItems: 'center',
    borderRadius: radii.full,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chipText: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
});
