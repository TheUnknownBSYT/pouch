import { useColorScheme } from '@/contexts/SettingsContext';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PouchBrand } from '@/components/brand';
import { PressableScale } from '@/components/pressable-scale';
import { useAuth } from '@/contexts/AuthContext';
import { radii, spacing, typography, useThemeColors } from '@/constants/ui';

export default function AuthScreen() {
  const { lastEmail, sendSignInLink, authError } = useAuth();
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  const [emailInput, setEmail] = useState<string | null>(null);
  const email = emailInput ?? lastEmail ?? '';
  const sendLock = useRef(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  const handleSendLink = async () => {
    if (sendLock.current || cooldown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }

    sendLock.current = true;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { error: sendError } = await sendSignInLink(email);

      if (sendError) {
        setError(sendError);
        return;
      }

      setStep('sent');
      setCooldown(60);
      setMessage('Open the link in your email to sign in. No code to enter.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send link. Try again.');
    } finally {
      sendLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PouchBrand />
        <View style={styles.hero}>
          <Text style={[styles.title, { color: theme.text }]}>{step === 'email' ? 'In. And on\nwith your day.' : 'Check your inbox.'}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {step === 'email' ? 'Links, notes, tasks. Drop them here.\nFind them when you need them.' : `We sent a sign-in link to ${email}.`}
          </Text>
        </View>

        <View style={styles.card}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: theme.inputBackground,
                borderColor: emailFocused ? theme.accent : 'transparent',
              },
            ]}>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={step === 'email' && !submitting}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text }]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onSubmitEditing={() => void handleSendLink()}
              returnKeyType="next"
            />
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting || cooldown > 0, busy: submitting }}
            disabled={submitting || cooldown > 0}
            onPress={() => void handleSendLink()}
            style={[styles.button, { backgroundColor: theme.accent, opacity: submitting || cooldown > 0 ? 0.6 : 1 }]}>
            {submitting ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.onAccent }]}>{cooldown > 0 ? `Resend in ${cooldown}s` : step === 'email' ? 'Send sign-in link' : 'Resend sign-in link'}</Text>
            )}
          </PressableScale>

          {step === 'sent' ? (
            <PressableScale
              disabled={submitting}
              scaleTo={0.96}
              onPress={() => {
                setStep('email');
                setError(null);
                setMessage(null);
              }}>
              <Text style={[styles.link, { color: theme.accent }]}>Use a different email</Text>
            </PressableScale>
          ) : null}
        </View>

        {step === 'email' ? <Text style={[styles.helper, { color: theme.textMuted }]}>We’ll email you a sign-in link.{'\n'}No password to remember.</Text> : null}
        {message ? <Text style={[styles.message, { color: theme.accent }]}>{message}</Text> : null}
        {error || authError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error ?? authError}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  scroll: { padding: spacing.xl, gap: 20, flexGrow: 1 },
  helper: { fontSize: 13, lineHeight: 20 },
  hero: {
    marginTop: 64,
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 36,
    lineHeight: 46,
    letterSpacing: -1.2,
  },
  subtitle: {
    ...typography.body,
    lineHeight: 24,
    textAlign: 'left',
  },
  card: {
    borderRadius: radii.xxl,
    gap: spacing.md,
  },
  inputWrap: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  input: {
    fontSize: 17,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg - 2,
  },
  codeInput: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.lg,
    paddingVertical: spacing.lg - 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  message: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  error: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
});
