import { useColorScheme } from '@/contexts/SettingsContext';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/constants/ui';

export function PouchBrand({ size = 40, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const isDark = useColorScheme() === 'dark';
  const theme = useThemeColors(isDark);
  return (
    <View accessibilityLabel="Pouch" style={styles.lockup}>
      <Image source={isDark ? require('../../assets/brand/pouch-mark-reverse.svg') : require('../../assets/brand/pouch-mark.svg')} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
      {wordmark ? <Text style={[styles.wordmark, { color: theme.text }]}>pouch</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontSize: 30, fontWeight: '700', letterSpacing: -1.2 },
});
