// app/_layout.tsx
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#ffa600ac",
          },
          headerTintColor: "#fff", // white text
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        {/* Login */}
        <Stack.Screen name="auth" options={{ headerShown: false }} />

        {/* Home */}
        <Stack.Screen name="home" options={{ title: "Home", headerLeft: () => null }} />

        {/* Contacts Chat */}
        <Stack.Screen name="[userID]" />

        {/* Group Chat */}
        <Stack.Screen name="groupchat" />

        {/* Group Info */}
        <Stack.Screen
          name="groupinfo"
          options={{
            title: "Group Info",
            headerBackTitle: "Back",
          }}
        />

        {/* Not Found */}
        <Stack.Screen name="+not-found" />
      </Stack>
    </GestureHandlerRootView>
  );
}
