import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import UserSelectScreen from "@/screens/UserSelectScreen";
import HomeScreen from "@/screens/HomeScreen";
import ExerciseListScreen from "@/screens/ExerciseListScreen";
import RecordScreen from "@/screens/RecordScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ExerciseEditScreen from "@/screens/ExerciseEditScreen";
import FolderEditScreen from "@/screens/FolderEditScreen";

// 画面遷移図(仕様書)に対応するスタック定義
export type RootStackParamList = {
  UserSelect: undefined;
  Home: { userId: string };
  ExerciseList: { folderId: string };
  Record: { exerciseId: string };
  History: { exerciseId: string };
  Settings: undefined;
  ExerciseEdit: { exerciseId?: string };
  FolderEdit: { folderId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="UserSelect" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UserSelect" component={UserSelectScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ExerciseList" component={ExerciseListScreen} />
      <Stack.Screen name="Record" component={RecordScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ExerciseEdit" component={ExerciseEditScreen} presentation="modal" />
      <Stack.Screen name="FolderEdit" component={FolderEditScreen} presentation="modal" />
    </Stack.Navigator>
  );
}
