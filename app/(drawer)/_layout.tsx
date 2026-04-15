import { useCallback } from 'react';
import { Drawer } from 'expo-router/drawer';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CustomDrawerContent } from '@/components/layout/CustomDrawerContent';
import { Colors } from '@/theme';

export default function DrawerLayout() {
  const renderDrawerContent = useCallback(
    (props: DrawerContentComponentProps) => <CustomDrawerContent {...props} />,
    []
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={renderDrawerContent}
        screenOptions={{
          headerShown: false,
          drawerStyle: {
            backgroundColor: Colors.surface,
            width: 300,
          },
          drawerType: 'front',
          overlayColor: Colors.overlay,
        }}
      >
        <Drawer.Screen
          name="index"
          options={{ drawerLabel: 'Home', headerShown: false }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
