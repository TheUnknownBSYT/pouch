import { SettingsProvider, useColorScheme } from '@/contexts/SettingsContext';
import { ShareIntentProvider } from 'expo-share-intent';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import { AuthGate } from '@/components/auth-gate';
import { ShareCapture } from '@/components/share-capture';
import { useThemeColors } from '@/constants/ui';

function RootNavigator() {
  const colorScheme = useColorScheme();
  const theme = useThemeColors(colorScheme === 'dark');
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <AuthGate>
      <ItemsProvider key={user?.id ?? 'signed-out'}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <ShareCapture />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.background },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        </Stack>
      </ItemsProvider>
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
    <ShareIntentProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ShareIntentProvider>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
