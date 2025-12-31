import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Badge, Card, Row, Screen, Text } from "@mamute/ui";
import { fetchMembershipStatus, fetchProfile, fetchSchedules } from "@mamute/api";
import { ClassSchedule, MembershipStatus } from "@mamute/types";
import { classifyStatus, formatTimeRange } from "@mamute/utils";

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [membership, setMembership] = useState<MembershipStatus>("good");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await fetchProfile();
      const status = profile ? await fetchMembershipStatus(profile.id) : "good";
      setMembership(status);
      const classes = await fetchSchedules();
      setSchedules(classes);
    } catch (err) {
      console.warn("Failed to load schedule", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusView = classifyStatus(membership);

  return (
    <Screen title="Schedule">
      <Card>
        <Row>
          <Text>Membership</Text>
          <Badge tone={statusView.tone} label={statusView.label} />
        </Row>
      </Card>

      <FlatList
        data={schedules}
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
            <Text style={{ color: "#94a3b8" }}>Instructor: {item.instructorId}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <Card>
            <Text>No classes yet. Pull to refresh.</Text>
          </Card>
        }
      />
    </Screen>
  );
}
