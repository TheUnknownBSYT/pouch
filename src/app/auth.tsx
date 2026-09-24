import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { useAuth } from '@/contexts/AuthContext';
import { radii, shadows, spacing, typography, useThemeColors } from '@/constants/ui';

export default function AuthScreen() {
  const { lastEmail, sendEmailCode, verifyEmailCode } = useAuth();
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  useEffect(() => {
    if (lastEmail) {
      setEmail(lastEmail);
    }
  }, [lastEmail]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: sendError } = await sendEmailCode(email);
    setSubmitting(false);

    if (sendError) {
      setError(sendError);
      return;
    }

    setStep('code');
    setMessage('Enter the 6-digit code from your email. You stay signed in after this.');
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError('Enter the code from your email');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: verifyError } = await verifyEmailCode(email, code);
    setSubmitting(false);

    if (verifyError) {
      setError(verifyError);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}>
        <View style={styles.hero}>
          <View style={[styles.logo, shadows.raised, { backgroundColor: theme.accent }]}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Pouch</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Capture in 2 seconds. Find in 5. Sign in once — we remember you.
          </Text>
        </View>

        <View style={[styles.card, shadows.card, { backgroundColor: theme.surface }]}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: theme.inputBackground,
                borderColor: emailFocused ? theme.accent : 'transparent',
              },
            ]}>
            <TextInput
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
              onSubmitEditing={() => void handleSendCode()}
              returnKeyType="next"
            />
          </View>

          {step === 'code' ? (
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: codeFocused ? theme.accent : 'transparent',
                },
              ]}>
              <TextInput
                autoComplete="one-time-code"
                keyboardType="number-pad"
                maxLength={8}
                placeholder="6-digit code"
                placeholderTextColor={theme.textFaint}
                style={[styles.input, styles.codeInput, { color: theme.text }]}
                value={code}
                onChangeText={setCode}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onSubmitEditing={() => void handleVerifyCode()}
                returnKeyType="done"
              />
            </View>
          ) : null}

          <PressableScale
            disabled={submitting}
            onPress={() => void (step === 'email' ? handleSendCode() : handleVerifyCode())}
            style={[styles.button, { backgroundColor: theme.accent, opacity: submitting ? 0.85 : 1 }]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{step === 'email' ? 'Send code' : 'Verify & sign in'}</Text>
            )}
          </PressableScale>

          {step === 'code' ? (
            <PressableScale
              disabled={submitting}
              scaleTo={0.96}
              onPress={() => {
                setStep('email');
                setCode('');
                setError(null);
                setMessage(null);
              }}>
              <Text style={[styles.link, { color: theme.accent }]}>Use a different email</Text>
            </PressableScale>
          ) : null}
        </View>

        {message ? <Text style={[styles.message, { color: theme.accent }]}>{message}</Text> : null}
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  logo: {
    alignItems: 'center',
    borderRadius: radii.xl,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  title: {
    ...typography.display,
    fontSize: 32,
  },
  subtitle: {
    ...typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  card: {
    borderRadius: radii.xxl,
    gap: spacing.md,
    padding: spacing.xl,
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
