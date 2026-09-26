import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { radii, shadows, spacing, useThemeColors } from '@/constants/ui';

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !selected) {
      return;
    }
    onChange(selected);
  };

  return (
    <View style={[styles.container, shadows.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        <TextInput
          value={toDateInputValue(value)}
          onChangeText={(text) => {
            const next = new Date(`${text}T12:00:00`);
            if (!Number.isNaN(next.getTime())) {
              onChange(next);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textFaint}
          style={[
            styles.webInput,
            {
              backgroundColor: theme.inputBackground,
              borderColor: focused ? theme.accent : 'transparent',
              color: theme.text,
            },
          ]}
        />
      ) : (
        <>
          <PressableScale scaleTo={0.98} onPress={() => setOpen(true)}>
            <Text style={[styles.value, { color: theme.text }]}>{formatDate(value)}</Text>
          </PressableScale>
          {open ? (
            <DateTimePicker
              mode="date"
              value={value}
              onChange={handleChange}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md + 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  webInput: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
