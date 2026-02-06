import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { fetchLinkedStudents, getSupabaseClient } from "@mamute/api";

function TabBarIcon(
  props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }
) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/account");
        return;
      }
      try {
        const linked = await fetchLinkedStudents();
        if (!linked.length) {
          router.replace("/account");
        }
      } catch {
        router.replace("/account");
      }
    };
    check();
  }, [router]);

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
          title: "Barcode",
          tabBarIcon: ({ color }) => <TabBarIcon name="barcode" color={color} />
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />
        }}
      />
    </Tabs>
  );
}
