import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { radii, spacing, typography, useThemeColors } from '@/constants/ui';

export function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useThemeColors(useColorScheme() === 'dark');
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <Text style={[typography.title, { color: theme.text }]}>{title}</Text>
    {children}
  </View>;
}

export function ActionButton({ label, onPress, disabled, busy, secondary }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean;
}) {
  const theme = useThemeColors(useColorScheme() === 'dark');
  return <PressableScale accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
    style={[styles.button, { backgroundColor: secondary ? theme.inputBackground : theme.accent, opacity: disabled || busy ? 0.5 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? theme.accent : '#FFFFFF'} /> : <Text style={{ fontWeight: '700', color: secondary ? theme.text : '#FFFFFF' }}>{label}</Text>}
  </PressableScale>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl, gap: spacing.md },
  button: { borderRadius: radii.md, padding: spacing.lg, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
