import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getSupabaseClient, registerPushToken } from "@mamute/api";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from "expo-constants";
import { useFonts } from 'expo-font';
import * as Notifications from "expo-notifications";
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from "react-native";
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const syncPushToken = useCallback(async () => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (finalStatus !== "granted") {
        const permission = await Notifications.requestPermissionsAsync();
        finalStatus = permission.status;
      }
      if (finalStatus !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
      const appVariant =
        typeof Constants.executionEnvironment === "string"
          ? Constants.executionEnvironment
          : "unknown";

      await registerPushToken({
        profileId: userId,
        token: tokenResponse.data,
        platform,
        appVariant,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn("push token registration failed", error);
    }
  }, [supabase]);

  useEffect(() => {
    void syncPushToken();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void syncPushToken();
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase, syncPushToken]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
