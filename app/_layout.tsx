import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDb } from '@/db/schema';
import { useAppStore } from '@/store/app-store';

export default function RootLayout() {
  const { setDbReady, loadCategories, loadPrompts } = useAppStore();

  useEffect(() => {
    async function bootstrap() {
      await initDb();
      setDbReady(true);
      await loadCategories();
      await loadPrompts(null);
    }
    bootstrap();
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen
          name="prompt/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}
