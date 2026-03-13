import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth";

function TabBarIcon(
  props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }
) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const { session, isAdmin, loading } = useAuth();

  if (!loading && (!session || !isAdmin)) {
    return <Redirect href="/login" />;
  }

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
        name="checkin"
        options={{
          title: "Check-In",
          tabBarIcon: ({ color }) => <TabBarIcon name="check-square-o" color={color} />
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
        name="news"
        options={{
          title: "Mamute News",
          tabBarIcon: ({ color }) => <TabBarIcon name="newspaper-o" color={color} />
        }}
      />
      <Tabs.Screen
        name="badges"
        options={{
          title: "Badges",
          tabBarIcon: ({ color }) => <TabBarIcon name="trophy" color={color} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />
        }}
      />
    </Tabs>
  );
}
