import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { display: "none" }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "검색",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="search-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "라이브러리",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="albums-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="pins"
        options={{
          title: "핀",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="pin-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "인물",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="star-outline" size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="person-outline" size={size} />
        }}
      />
    </Tabs>
  );
}
