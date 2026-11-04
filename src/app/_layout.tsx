import { ShareIntentProvider } from 'expo-share-intent';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import { SpaceProvider } from '@/contexts/SpaceContext';
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
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.background },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
          <Stack.Screen name="space" options={{ title: 'Your space' }} />
          <Stack.Screen name="whatsapp" options={{ title: 'WhatsApp to Pouch' }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
        </Stack>
        <ShareCapture />
      </ItemsProvider>
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <ShareIntentProvider options={{
      disabled: Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
      resetOnBackground: false,
    }}>
      <AuthProvider>
        <PersonalizedNavigator />
      </AuthProvider>
    </ShareIntentProvider>
  );
}

function PersonalizedNavigator() {
  const { user } = useAuth();
  return <SpaceProvider key={user?.id ?? 'guest'}><RootNavigator /></SpaceProvider>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
