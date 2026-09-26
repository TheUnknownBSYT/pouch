import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme, useSettings } from '@/contexts/SettingsContext';
import { radii, spacing, typography, useThemeColors } from '@/constants/ui';
import { PressableScale } from '@/components/pressable-scale';

export default function SettingsScreen() {
  const theme = useThemeColors(useColorScheme() === 'dark');
  const { settings, updateSettings, storageError } = useSettings();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const section = (title: string) => <Text style={[typography.label, { color: theme.textMuted }]}>{title}</Text>;
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true); setError(null);
    try { await signOut(); } catch { setError('Could not sign out. Try again.'); } finally { setSigningOut(false); }
  }
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <Text style={[typography.display, { color: theme.text }]}>Make it yours.</Text>
      <Text style={[typography.bodySmall, { color: theme.textMuted }]}>Preferences are saved on this device.</Text>
      {section('Appearance')}
      <View style={styles.options}>
        {(['system', 'light', 'dark'] as const).map(value => (
          <PressableScale key={value} accessibilityRole="radio" accessibilityState={{ checked: settings.appearance === value }} onPress={() => updateSettings({ appearance: value })} style={[styles.option, { backgroundColor: settings.appearance === value ? theme.accentMuted : theme.surface, borderColor: settings.appearance === value ? theme.accent : theme.border }]}>
            <Text style={{ color: settings.appearance === value ? theme.accent : theme.text }}>{value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}</Text>
          </PressableScale>
        ))}
      </View>
      <Text style={[typography.bodySmall, { color: theme.textMuted }]}>System follows your device’s appearance.</Text>
      {section('Capture')}
      <View style={[styles.row, { borderColor: theme.border }]}>
        <View style={styles.copy}><Text style={[typography.body, { color: theme.text }]}>Haptic feedback</Text><Text style={[typography.bodySmall, { color: theme.textMuted }]}>A small tap after saving on supported devices.</Text></View>
        <Switch accessibilityLabel="Haptic feedback" value={settings.haptics} onValueChange={haptics => updateSettings({ haptics })} trackColor={{ true: theme.accent }} />
      </View>
      {section('Inbox order')}
      {(['newest', 'oldest', 'priority'] as const).map(value => (
        <PressableScale key={value} accessibilityRole="radio" accessibilityState={{ checked: settings.sort === value }} onPress={() => updateSettings({ sort: value })} style={[styles.row, { borderColor: theme.border }]}>
          <Text style={[typography.body, { color: theme.text }]}>{value === 'newest' ? 'Newest first' : value === 'oldest' ? 'Oldest first' : 'Priority & due date'}</Text>
          <Text style={{ color: theme.accent }}>{settings.sort === value ? '✓' : ''}</Text>
        </PressableScale>
      ))}
      {section('Account & data')}
      <Text selectable style={[typography.body, { color: theme.text }]}>{user?.email}</Text>
      <Text style={[typography.bodySmall, { color: theme.textMuted }]}>You sign in with an email link. Your captures sync to your account.</Text>
      <PressableScale accessibilityRole="button" onPress={() => router.push('/accounts')} style={[styles.row, { borderColor: theme.border }]}><Text style={[typography.body, { color: theme.accent }]}>Accounts & monthly CSV export</Text><Text style={{ color: theme.accent }}>→</Text></PressableScale>
      <PressableScale accessibilityRole="button" disabled={signingOut} onPress={() => void handleSignOut()} style={styles.row}><Text style={[typography.body, { color: theme.danger }]}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></PressableScale>
      {error || storageError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error ?? storageError}</Text> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.xl, gap: spacing.lg },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { flex: 1, minWidth: 80, minHeight: 48, borderRadius: radii.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, minHeight: 48, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: spacing.xs },
});
