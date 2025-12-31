import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";

function TabBarIcon(
  props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }
) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#f59e0b",
        headerShown: true,
        tabBarStyle: { backgroundColor: "#0b1220" },
        tabBarActiveBackgroundColor: "#111827",
        tabBarInactiveTintColor: "#94a3b8"
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: "Announcements",
          tabBarIcon: ({ color }) => <TabBarIcon name="bullhorn" color={color} />
        }}
      />
    </Tabs>
  );
}
