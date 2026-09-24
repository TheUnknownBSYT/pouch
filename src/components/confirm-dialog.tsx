import { useEffect } from 'react';
import { Modal, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { radii, shadows, spacing, typography, useThemeColors } from '@/constants/ui';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DialogCard({ children }: { children: React.ReactNode }) {
  // Occasional, one-off UI (a confirmation) — standard entrance animation is
  // warranted. Starts from scale(0.95), never scale(0): nothing in the real
  // world pops into existence from nothing.
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 220, easing: EASE_OUT });
    opacity.value = withTiming(1, { duration: 180, easing: EASE_OUT });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <DialogCard>
          <View
            style={[
              styles.card,
              shadows.raised,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
            <View style={styles.actions}>
              <PressableScale
                disabled={loading}
                onPress={onCancel}
                style={[styles.button, { backgroundColor: theme.inputBackground }]}>
                <Text style={[styles.buttonText, { color: theme.text }]}>{cancelLabel}</Text>
              </PressableScale>
              <PressableScale
                disabled={loading}
                onPress={onConfirm}
                style={[
                  styles.button,
                  { backgroundColor: destructive ? theme.danger : theme.accent },
                ]}>
                <Text style={[styles.buttonText, styles.confirmText]}>{confirmLabel}</Text>
              </PressableScale>
            </View>
          </View>
        </DialogCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,12,0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    width: '100%',
  },
  title: {
    ...typography.title,
  },
  message: {
    ...typography.body,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    paddingVertical: spacing.md,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmText: {
    color: '#FFFFFF',
  },
});
