import { useColorScheme } from '@/contexts/SettingsContext';
import { Text, View } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { useThemeColors, spacing } from '@/constants/ui';
import { useShareIntentCapture } from '@/hooks/useShareIntentCapture';

export function ShareCapture() {
  const { error, saving, retry, dismiss } = useShareIntentCapture();
  const theme = useThemeColors(useColorScheme() === 'dark');
  if (!error) return null;
  return (
    <View style={{ backgroundColor: theme.surface, padding: spacing.lg, gap: spacing.sm }}>
      <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.xl }}>
        <PressableScale disabled={saving} onPress={() => void retry()} accessibilityRole="button">
          <Text style={{ color: theme.accent }}>{saving ? 'Saving…' : 'Retry save'}</Text>
        </PressableScale>
        <PressableScale disabled={saving} onPress={dismiss} accessibilityRole="button">
          <Text style={{ color: theme.textMuted }}>Dismiss</Text>
        </PressableScale>
      </View>
    </View>
  );
}
