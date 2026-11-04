import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, useThemeColors } from '@/constants/ui';
import { useShareIntentCapture } from '@/hooks/useShareIntentCapture';

export function ShareCapture() {
  const { status, message, waitingForSignIn, retry, dismiss } = useShareIntentCapture();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors(useColorScheme() === 'dark');
  if (status === 'idle' && !message && !waitingForSignIn) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { top: insets.top + spacing.sm, backgroundColor: theme.surface, borderColor: theme.border }]}>
      {status === 'saving' ? <ActivityIndicator color={theme.accent} /> : null}
      <Text style={[styles.message, { color: message ? theme.danger : theme.text }]}>
        {waitingForSignIn
          ? 'Sign in to save your share. It’s waiting here.'
          : message ?? (status === 'saved' ? 'Saved to Pouch · syncs when connected' : 'Saving to Pouch…')}
      </Text>
      {status === 'error' && !waitingForSignIn ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void retry()}>
          <Text style={{ color: theme.accent, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      ) : null}
      {status !== 'saving' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss share" hitSlop={8} onPress={dismiss}>
          <Text style={{ color: theme.textMuted }}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 20,
  },
  message: { flex: 1, fontSize: 14 },
});
