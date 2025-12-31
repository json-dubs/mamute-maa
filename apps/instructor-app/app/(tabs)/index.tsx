import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Badge, Card, Row, Screen, Text } from "@mamute/ui";
import { fetchSchedules } from "@mamute/api";
import { ClassSchedule } from "@mamute/types";
import { formatTimeRange } from "@mamute/utils";

export default function TodayScreen() {
  const [classes, setClasses] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSchedules();
      setClasses(data);
    } catch (error) {
      console.warn("load classes failed", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const today = useMemo(
    () => classes.filter((c) => c.startAt.slice(0, 10) === new Date().toISOString().slice(0, 10)),
    [classes]
  );

  return (
    <Screen title="Today">
      <FlatList
        data={today}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Row>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Badge label={item.discipline.toUpperCase()} />
            </Row>
            <Text>{formatTimeRange(item.startAt, item.endAt)}</Text>
            <Text style={{ color: "#94a3b8" }}>
              Status: {item.status === "cancelled" ? "Cancelled" : "Scheduled"}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text>No classes scheduled today.</Text>
          </Card>
        }
      />
    </Screen>
  );
}
