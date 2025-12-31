import { useEffect, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Badge, Card, Screen, Text } from "@mamute/ui";
import { fetchNotifications, fetchProfile } from "@mamute/api";
import { NotificationPayload } from "@mamute/types";

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const profile = await fetchProfile();
      if (!profile) return;
      const notifications = await fetchNotifications(profile.id);
      setItems(notifications);
    } catch (error) {
      console.warn("notifications failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen title="Alerts">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Badge label={item.type.toUpperCase()} />
            <Text style={{ fontWeight: "700" }}>{item.title}</Text>
            <Text>{item.body}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text>No alerts yet.</Text>
          </Card>
        }
      />
    </Screen>
  );
}
