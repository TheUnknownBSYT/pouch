import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, SettingsCard } from '@/components/settings-ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { spacing, typography, useThemeColors } from '@/constants/ui';
import { supabase } from '@/lib/supabase';

const number = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER ?? '';
const configured = /^\d{7,15}$/.test(number);
type Connection = { connected: boolean; suffix?: string };
type Pairing = { token: string; expires_at: string };

export default function WhatsAppScreen() {
  const theme = useThemeColors(useColorScheme() === 'dark');
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [expired, setExpired] = useState(false);
  const active = useRef(true);
  const working = useRef(false);
  const refresh = useCallback(async () => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const { data, error: failure } = await supabase.rpc('get_my_whatsapp').abortSignal(controller.signal);
      if (failure) throw failure;
      if (!active.current) return;
      setConnection(data);
      setError(null);
      if (data?.connected) setPairing(null);
    } catch {
      if (active.current) setError('Couldn’t check your connection. Try again in a moment.');
    } finally { clearTimeout(timeout); }
  }, []);

  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(refresh);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { active.current = false; listener.remove(); };
  }, [refresh]);
  useEffect(() => {
    if (!pairing) return;
    const poll = setInterval(() => {
      if (Date.now() >= new Date(pairing.expires_at).getTime()) { setExpired(true); clearInterval(poll); }
      else if (AppState.currentState === 'active') void refresh();
    }, 4000);
    return () => clearInterval(poll);
  }, [pairing, refresh]);

  const connect = async () => {
    if (!configured || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      let current = pairing;
      if (!current || new Date(current.expires_at).getTime() <= Date.now()) {
        const { data, error: failure } = await supabase.rpc('begin_whatsapp_pairing', { p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
        if (failure) throw new Error(failure.message);
        current = data as Pairing;
        setPairing(current); setExpired(false);
      }
      // Opens a draft. The person explicitly presses Send in WhatsApp.
      await Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(`POUCH CONNECT ${current.token}`)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Couldn’t open WhatsApp. Please try again.');
    } finally { setBusy(false); working.current = false; }
  };
  const disconnect = async () => {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const { error: failure } = await supabase.rpc('disconnect_my_whatsapp');
      if (failure) throw failure;
      setPairing(null); setConnection({ connected: false }); setDisconnecting(false);
    } catch { setError('Couldn’t disconnect. Please try again.'); }
    finally { setBusy(false); working.current = false; }
  };
  const body = [typography.body, { color: theme.textMuted, lineHeight: 24 }];

  return <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xl }]}>
    <View style={styles.hero}>
      <View style={[styles.icon, { backgroundColor: theme.accentMuted }]}><Ionicons name="logo-whatsapp" size={32} color={theme.accent} /></View>
      <Text style={[typography.display, { color: theme.text, textAlign: 'center' }]}>Same habit. Less clutter.</Text>
      <Text style={[body, { textAlign: 'center' }]}>{configured ? 'Text the Pouch WhatsApp contact. Find it sorted in your inbox.' : 'Bring the notes and links you text yourself into Pouch.'}</Text>
    </View>
    {error ? <Text accessibilityLiveRegion="polite" style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}
    {configured ? <SettingsCard title={connection?.connected ? 'You’re connected' : 'Connect once. Then just text.'}>
      {connection?.connected ? <>
        <Text accessibilityLiveRegion="polite" style={body}>WhatsApp ending in {connection.suffix} is linked. New text and links sent to Pouch will arrive automatically.</Text>
        <Text style={body}>Check your Pouch inbox to confirm a capture was saved. WhatsApp’s delivered indicator only confirms delivery to the business contact.</Text>
        <ActionButton label="Open Pouch in WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${number}`).catch(() => setError('Couldn’t open WhatsApp.'))} />
        <ActionButton label="Disconnect WhatsApp" secondary onPress={() => setDisconnecting(true)} />
      </> : <>
        <Text style={body}>1. Open the Pouch chat below.</Text>
        <Text style={body}>2. Send the connection message as written.</Text>
        <Text style={body}>3. Come back here to confirm. Then save that chat as “Pouch”.</Text>
        <Text style={body}>Connecting lets Pouch process and store new texts and links you send to this contact. Your other chats stay private. You can disconnect anytime.</Text>
        <>
          <ActionButton label={pairing && !expired ? 'Open connection message again' : 'Connect with WhatsApp'} busy={busy} disabled={!connection} onPress={() => void connect()} />
          <ActionButton label="Check connection" secondary onPress={() => void refresh()} />
          {pairing ? <Text style={[typography.bodySmall, { color: theme.textMuted }]}>{expired ? 'This connection message has expired. Create a new one above.' : 'Waiting for your connection message. The private code expires in 10 minutes; don’t forward it to anyone.'}</Text> : null}
        </>
      </>}
    </SettingsCard> : null}
    <SettingsCard title="Still texting yourself?">
      <Text style={body}>Keep your “Message yourself” chat. To save something from it, select the text or link, open your phone’s Share menu, and choose Pouch. If Share isn’t offered, copy it and paste it into Pouch.</Text>
      <Text style={body}>Pouch can’t automatically read your personal chats. Only messages you share, paste, or send to the connected Pouch contact are added.</Text>
    </SettingsCard>
    {!configured ? <SettingsCard title="Texting Pouch directly">
      <Text style={body}>Direct WhatsApp capture isn’t available in this build yet. For now, share or paste the messages you want to keep.</Text>
    </SettingsCard> : null}
    <SettingsCard title="A few things to know">
      <Text style={body}>Text and links are supported. Photos, voice notes, files, and old chat history aren’t imported.</Text>
      <Text style={body}>Messages sent to the Pouch contact are processed by WhatsApp’s Business Platform and stored in your Pouch account. Disconnect anytime; captures already saved stay in your inbox.</Text>
      <Text style={body}>WhatsApp capture is part of free Pouch.</Text>
    </SettingsCard>
    <ConfirmDialog visible={disconnecting} title="Disconnect WhatsApp?" message="New messages to the Pouch contact will stop being saved. Existing captures will stay in your inbox." confirmLabel="Disconnect" loading={busy} onCancel={() => setDisconnecting(false)} onConfirm={() => void disconnect()} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.lg, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  icon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
