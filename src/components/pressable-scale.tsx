/**
 * PressableScale — the one piece of "feel" every tappable element in the app shares.
 *
 * scale(0.97) on press-in, released with a slightly slower ease-out on press-out.
 * Runs on the UI thread via Reanimated so it stays smooth even while the JS
 * thread is busy (e.g. saving an item). This is the mobile equivalent of the
 * `:active { transform: scale(0.97) }` rule for buttons on the web — apply it
 * once, everywhere, and every tap in the app reads as "this is listening to me."
 *
 * Install: npx expo install react-native-reanimated react-native-worklets
 * (babel-preset-expo wires up the worklets plugin automatically — no config needed)
 */
import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  /** How far to scale down on press. Keep this subtle — 0.95 to 0.98. */
  scaleTo?: number;
  disabled?: boolean;
}

export const PressableScale = forwardRef<View, PressableScaleProps>(
  ({ scaleTo = 0.97, style, onPressIn, onPressOut, disabled, ...props }, ref) => {
    const scale = useSharedValue(1);
    const reduceMotion = useReducedMotion();

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        style={[style, animatedStyle]}
        onPressIn={(event) => {
          scale.value = withTiming(reduceMotion ? 1 : scaleTo, { duration: 120, easing: EASE_OUT });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, { duration: 160, easing: EASE_OUT });
          onPressOut?.(event);
        }}
        {...props}
      />
    );
  },
);

PressableScale.displayName = 'PressableScale';
