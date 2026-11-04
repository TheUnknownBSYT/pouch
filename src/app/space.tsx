import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, SettingsCard } from '@/components/settings-ui';
import { PressableScale } from '@/components/pressable-scale';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useItems } from '@/contexts/ItemsContext';
import { type Palette, useSpace } from '@/contexts/SpaceContext';
import { radii, spacing, typography, useThemeColors } from '@/constants/ui';

const palettes: { id: Palette; name: string; color: string }[] = [
  { id: 'violet', name: 'Original', color: '#286447' },
  { id: 'ocean', name: 'Ocean', color: '#1569B8' },
  { id: 'forest', name: 'Forest', color: '#14785A' },
  { id: 'sunset', name: 'Sunset', color: '#B94D26' },
];
const installUrl = process.env.EXPO_PUBLIC_INSTALL_URL;

export default function SpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors(useColorScheme() === 'dark');
  const { user, signOut } = useAuth();
  const { pendingIds } = useItems();
  const { space, loading, error, refresh, update, claimInvite } = useSpace();
  const [name, setName] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSignOut, setShowSignOut] = useState(false);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const run = async (action: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await action(); if (success) setNotice(success); }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Couldn’t finish. Please try again.'); }
    finally { setBusy(false); }
  };
  const body = [typography.bodySmall, { color: theme.textMuted, lineHeight: 21 }];
  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.inputBackground }];
  const saveAppearance = (palette: Palette, compact: boolean) => {
    if (!space) return;
    void run(() => update(space.display_name, palette, compact));
  };

  return <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}>
      <View style={[styles.avatar, { backgroundColor: theme.accentMuted }]}>
        <Text style={[typography.display, { color: theme.accent }]}>{(space?.display_name || 'P').slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text style={[typography.title, { color: theme.text }]}>{space?.display_name ? `${space.display_name}’s Pouch` : 'A space that’s yours'}</Text>
      <Text style={body}>{space?.premium ? 'Pouch Plus · Lifetime' : 'Private by default. Sharing is always your choice.'}</Text>
    </View>
    {notice ? <Text accessibilityLiveRegion="polite" style={[body, { color: theme.accent }]}>{notice}</Text> : null}
    {error ? <SettingsCard title="Your inbox comes first"><Text style={body}>{error}</Text><ActionButton label="Try again" secondary onPress={() => void refresh()} /></SettingsCard> : null}

    <SettingsCard title="Less switching, more saving">
      <Text style={body}>Send text and links from WhatsApp straight to your Pouch.</Text>
      <ActionButton label="Connect WhatsApp" secondary onPress={() => router.push('/whatsapp')} />
    </SettingsCard>

    <SettingsCard title="Your profile, at your pace">
      <Text style={body}>A name for your own space. It doesn’t make your inbox public.</Text>
      <TextInput accessibilityLabel="Your display name" maxLength={40} placeholder="What should we call you?" placeholderTextColor={theme.textFaint} value={name ?? space?.display_name ?? ''} onChangeText={setName} style={inputStyle} />
      <ActionButton label="Save name" disabled={!space || loading} busy={busy} secondary onPress={() => space && void run(() => update(name ?? space.display_name, space.palette, space.compact), 'Name saved.')} />
    </SettingsCard>

    <SettingsCard title={space?.premium ? 'Make yourself at home' : 'Pouch Plus · A little more you'}>
      <Text style={body}>Personal colors and a compact inbox. Capturing, sorting, search, tasks, expenses, export, and WhatsApp capture stay free.</Text>
      <View style={styles.paletteRow}>
        {palettes.map((palette) => {
          const locked = palette.id !== 'violet' && !space?.premium;
          return <PressableScale key={palette.id} accessibilityRole="button" accessibilityLabel={`${palette.name}${locked ? ', requires Plus' : ''}`} accessibilityState={{ selected: space?.palette === palette.id, disabled: locked || busy || !space }}
            disabled={locked || busy || !space} onPress={() => saveAppearance(palette.id, space?.compact ?? false)} style={styles.palette}>
            <View style={[styles.swatch, { backgroundColor: palette.color, borderColor: space?.palette === palette.id ? theme.text : 'transparent' }]}>
              <Ionicons name={locked ? 'lock-closed' : space?.palette === palette.id ? 'checkmark' : 'ellipse-outline'} color="#FFFFFF" size={18} />
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{palette.name}</Text>
          </PressableScale>;
        })}
      </View>
      <View style={styles.row}><Text style={[body, { flex: 1 }]}>Compact inbox</Text><Switch accessibilityLabel="Compact inbox" disabled={!space?.premium || busy} value={Boolean(space?.premium && space.compact)} onValueChange={(value) => { if (space) saveAppearance(space.palette, value); }} trackColor={{ true: theme.accent }} /></View>
      {!space?.premium ? <Text style={body}>Earn lifetime Plus with three friends below. Paid upgrades aren’t available yet.</Text> : null}
    </SettingsCard>

    <SettingsCard title={space?.premium ? 'Good things are worth sharing' : 'Bring 3 friends. Keep Plus forever.'}>
      <Text style={body}>Each friend installs Pouch, verifies their email, adds your code within 14 days, and saves their first capture in the mobile app. Three qualifying friends unlock lifetime Plus for you.</Text>
      <View style={styles.progressRow}>
        {[1, 2, 3].map((step) => <View key={step} style={[styles.progress, { backgroundColor: (space?.qualified_invites ?? 0) >= step ? theme.accent : theme.inputBackground }]} />)}
      </View>
      <Text style={[typography.bodySmall, { color: theme.text }]}>{Math.min(space?.qualified_invites ?? 0, 3)} of 3 friends{space?.pending_invites ? ` · ${space.pending_invites} waiting for a first capture` : ''}</Text>
      {space ? <Text selectable style={[styles.code, { color: theme.accent }]}>{space.invite_code}</Text> : null}
      <ActionButton label="Share an invite" disabled={!space || !installUrl || !/^https:\/\//.test(installUrl)} secondary onPress={() => void run(async () => {
        if (!space || !installUrl) return;
        await Share.share({ message: `I’m using Pouch to save the things I used to text myself. Try it: ${installUrl}\n\nMy invite code: ${space.invite_code}\nAdd it in Your space within 14 days of joining. Your captures stay private.` });
      })} />
      {!installUrl ? <Text style={body}>Invite sharing opens when Pouch’s download link is available. Testers can use the code above.</Text> : null}
      <Text style={body}>No contacts upload, public feed, or reminders to invite people.</Text>
      {space && !space.claimed_invite ? <>
        <TextInput accessibilityLabel="Friend’s invite code" placeholder="Have a friend’s code?" placeholderTextColor={theme.textFaint} autoCapitalize="characters" autoCorrect={false} maxLength={12} value={code} onChangeText={setCode} style={inputStyle} />
        <ActionButton label="Use invite code" secondary busy={busy} disabled={!/^[A-Fa-f0-9]{12}$/.test(code.trim())} onPress={() => void run(() => claimInvite(code), 'Invite added. Your friend gets credit after your first mobile capture.')} />
      </> : space?.claimed_invite ? <Text style={body}>Your friend’s invite is linked.</Text> : null}
    </SettingsCard>

    <SettingsCard title="Your account">
      <Text style={body}>{user?.email}</Text>
      <ActionButton label="Accounts & expense export" secondary onPress={() => router.push('/accounts')} />
      <ActionButton label="Sign out" secondary onPress={() => setShowSignOut(true)} />
    </SettingsCard>
    <ConfirmDialog visible={showSignOut} title="Sign out of Pouch?" message={pendingIds.size ? `${pendingIds.size} captures are saved only on this device. They’ll sync when you sign back into this account. Don’t uninstall Pouch before they sync.` : 'Your saved items will be here when you sign back in.'} confirmLabel="Sign out" loading={busy} onCancel={() => setShowSignOut(false)} onConfirm={() => void run(signOut)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.lg, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: { height: 64, width: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  input: { borderRadius: radii.md, padding: spacing.lg, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  paletteRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginVertical: spacing.sm },
  palette: { alignItems: 'center', gap: spacing.sm },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: spacing.sm },
  progress: { height: 6, borderRadius: 3, flex: 1 },
  code: { fontSize: 22, fontWeight: '700', letterSpacing: 3, textAlign: 'center', paddingVertical: spacing.sm },
});
