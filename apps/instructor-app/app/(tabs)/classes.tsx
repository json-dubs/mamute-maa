import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl } from "react-native";
import { Badge, Card, Row, Screen, Text } from "@mamute/ui";
import { cancelClass, fetchSchedules } from "@mamute/api";
import { ClassSchedule } from "@mamute/types";
import { formatTimeRange } from "@mamute/utils";

export default function ClassesScreen() {
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSchedules();
      setClasses(data);
    } catch (error) {
      console.warn("classes load failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancel = async (id: string) => {
    try {
      await cancelClass(id, "cancelled");
      Alert.alert("Class cancelled", "Students will be notified.");
      load();
    } catch (error) {
      Alert.alert("Error", "Could not cancel class");
    }
  };

  return (
    <Screen title="Classes">
      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10, gap: 8 }}>
            <Row>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Badge label={item.status.toUpperCase()} />
            </Row>
            <Text>{formatTimeRange(item.startAt, item.endAt)}</Text>
            <Row>
              <Badge label={item.discipline.toUpperCase()} />
              {item.status !== "cancelled" ? (
                <Pressable
                  onPress={() => cancel(item.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: "#7f1d1d",
                    borderRadius: 8
                  }}
                >
                  <Text style={{ color: "#fecdd3" }}>Cancel</Text>
                </Pressable>
              ) : null}
            </Row>
          </Card>
        )}
      />
    </Screen>
  );
}
