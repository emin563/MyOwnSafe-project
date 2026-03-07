import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CustomDrawerContent } from '@/components/layout/CustomDrawerContent';
import { Colors } from '@/theme';

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
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
