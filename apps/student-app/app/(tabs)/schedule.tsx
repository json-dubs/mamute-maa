import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { fetchLinkedStudents, fetchSchedules } from "@mamute/api";
import { ClassScheduleTemplate, LinkedStudentSummary } from "@mamute/types";
import { classifyStanding, formatTemplateTimeRange } from "@mamute/utils";

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ClassScheduleTemplate[]>([]);
  const [students, setStudents] = useState<LinkedStudentSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const linked = await fetchLinkedStudents();
      setStudents(linked);
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

  return (
    <Screen>
      <HeroHeader title="Schedule" />
      {students.length ? (
        <Card>
          <Text>Memberships</Text>
          {students.map((student) => {
            const statusView = classifyStanding(student.membershipStanding);
            const displayName = [student.firstName, student.lastName]
              .filter(Boolean)
              .join(" ");
            return (
              <Row key={student.studentId}>
                <Text>{displayName || "Student"}</Text>
                <Badge tone={statusView.tone} label={statusView.label} />
              </Row>
            );
          })}
        </Card>
      ) : (
        <Card>
          <Text>Link a student profile to see membership standing.</Text>
        </Card>
      )}

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#f59e0b" />
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <Row>
              <Text style={{ fontWeight: "700" }}>{item.classType}</Text>
              <Badge label={item.isActive ? "ACTIVE" : "INACTIVE"} />
            </Row>
            <Text>{formatTemplateTimeRange(item)}</Text>
            <Text style={{ color: uiColors.muted }}>
              Instructor: {item.instructorId ?? "TBD"}
            </Text>
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
