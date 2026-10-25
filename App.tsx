import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider } from "expo-sqlite";

import RootNavigator from "@/navigation/RootNavigator";
import PreviewBanner from "@/components/PreviewBanner";
import { migrateDbIfNeeded } from "@/db/schema";
import { DATABASE_NAME } from "@/preview";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <SafeAreaProvider>
          <PreviewBanner />
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
