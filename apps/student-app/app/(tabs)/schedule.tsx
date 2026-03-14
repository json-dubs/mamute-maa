import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { fetchSchedules } from "@mamute/api";
import { ClassScheduleTemplate } from "@mamute/types";

type ViewMode = "day" | "week";
type InstructorBioModalState = {
  name: string;
  about: string | null;
  imageUrl: string | null;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ClassScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [selectedInstructorBio, setSelectedInstructorBio] = useState<InstructorBioModalState | null>(
    null
  );

  const groupedByDay = useMemo(() => {
    const base = new Map<number, ClassScheduleTemplate[]>(
      dayLabels.map((_label, index) => [index, []])
    );
    for (const schedule of schedules) {
      const day = base.get(schedule.dayOfWeek) ?? [];
      day.push(schedule);
      day.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
      base.set(schedule.dayOfWeek, day);
    }
    return base;
  }, [schedules]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const classes = await fetchSchedules({ includeCancelled: true });
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

  useRealtimeRefresh({
    name: "schedule",
    tables: ["class_schedules", "class_schedule_exceptions", "instructors"],
    onRefresh: load
  });

  const openInstructorBio = (schedule: ClassScheduleTemplate) => {
    const name = [schedule.instructorFirstName, schedule.instructorLastName]
      .filter(Boolean)
      .join(" ");
    if (!name) return;

    setSelectedInstructorBio({
      name,
      about: schedule.instructorAbout ?? null,
      imageUrl: schedule.instructorImageUrl ?? null
    });
  };

  return (
    <Screen>
      <HeroHeader title="Schedule" />
      <Card>
        <Row>
          <Text style={{ fontWeight: "700" }}>Calendar View</Text>
          <Pressable onPress={load}>
            <Text style={{ color: uiColors.accent }}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
        </Row>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setViewMode("day")}
            style={[toggleStyle, viewMode === "day" ? toggleActiveStyle : null]}
          >
            <Text style={toggleTextStyle}>Day</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("week")}
            style={[toggleStyle, viewMode === "week" ? toggleActiveStyle : null]}
          >
            <Text style={toggleTextStyle}>Week</Text>
          </Pressable>
        </View>
      </Card>

      {viewMode === "day" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 12 }}>
              {dayLabels.map((label, dayIndex) => (
                <Pressable
                  key={label}
                  onPress={() => setSelectedDay(dayIndex)}
                  style={[dayPillStyle, selectedDay === dayIndex ? dayPillActiveStyle : null]}
                >
                  <Text style={dayPillTextStyle}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView>
            <Card>
              <Text style={{ fontWeight: "700" }}>{dayLabels[selectedDay]} Classes</Text>
              {(groupedByDay.get(selectedDay) ?? []).length ? (
                (groupedByDay.get(selectedDay) ?? []).map((schedule) => (
                  <ScheduleBlock
                    key={schedule.id}
                    schedule={schedule}
                    onPressInstructor={openInstructorBio}
                  />
                ))
              ) : (
                <Text style={{ color: uiColors.muted }}>No classes scheduled.</Text>
              )}
            </Card>
          </ScrollView>
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 10, paddingBottom: 8 }}>
            {dayLabels.map((label, dayIndex) => (
              <Card key={label} style={{ width: 220, alignSelf: "flex-start" }}>
                <Text style={{ fontWeight: "700" }}>{label}</Text>
                {(groupedByDay.get(dayIndex) ?? []).length ? (
                  (groupedByDay.get(dayIndex) ?? []).map((schedule) => (
                    <ScheduleBlock
                      key={schedule.id}
                      schedule={schedule}
                      compact
                      onPressInstructor={openInstructorBio}
                    />
                  ))
                ) : (
                  <Text style={{ color: uiColors.muted }}>No classes</Text>
                )}
              </Card>
            ))}
          </View>
        </ScrollView>
      )}
      <Modal
        visible={Boolean(selectedInstructorBio)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedInstructorBio(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.68)",
            padding: 20,
            justifyContent: "center"
          }}
          onPress={() => setSelectedInstructorBio(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: uiColors.border,
              backgroundColor: uiColors.surface,
              padding: 16,
              gap: 10
            }}
          >
            <Row>
              <Text style={{ fontWeight: "800", fontSize: 18, flex: 1 }}>
                {selectedInstructorBio?.name ?? "Instructor"}
              </Text>
              <Pressable onPress={() => setSelectedInstructorBio(null)}>
                <Text style={{ color: uiColors.accent, fontWeight: "700" }}>Close</Text>
              </Pressable>
            </Row>
            {selectedInstructorBio?.imageUrl ? (
              <View
                style={{
                  width: "100%",
                  height: 240,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: uiColors.border,
                  backgroundColor: "#0b0b0b",
                  overflow: "hidden",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 8
                }}
              >
                <Image
                  source={{ uri: selectedInstructorBio.imageUrl }}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 10,
                    backgroundColor: "transparent"
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            <Text style={{ color: uiColors.text, lineHeight: 22 }}>
              {selectedInstructorBio?.about?.trim()
                ? selectedInstructorBio.about
                : "Instructor bio coming soon."}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function ScheduleBlock({
  schedule,
  compact,
  onPressInstructor
}: {
  schedule: ClassScheduleTemplate;
  compact?: boolean;
  onPressInstructor: (schedule: ClassScheduleTemplate) => void;
}) {
  const instructor = [schedule.instructorFirstName, schedule.instructorLastName]
    .filter(Boolean)
    .join(" ");
  const classStatus = schedule.isActive ? "Active" : "Cancelled";
  const isCancelled = !schedule.isActive;
  const canOpenInstructorBio = Boolean(instructor);

  return (
    <Card
      style={[
        {
          marginTop: 8,
          borderColor: isCancelled ? "#dc2626" : uiColors.border,
          backgroundColor: isCancelled ? "#321216" : uiColors.surfaceAlt,
          borderLeftWidth: isCancelled ? 5 : 1
        },
        compact ? { padding: 10 } : null
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8
        }}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            fontWeight: "700",
            color: isCancelled ? "#fee2e2" : uiColors.text,
            textDecorationLine: isCancelled ? "line-through" : "none"
          }}
        >
          {formatClassType(schedule.classType)}
        </Text>
        <View style={{ flexShrink: 0, alignSelf: "flex-start" }}>
          <Badge tone={schedule.isActive ? "success" : "danger"} label={classStatus} />
        </View>
      </View>
      <Text style={{ color: uiColors.muted }}>
        {formatClockTime(schedule.startTime)} - {formatClockTime(schedule.endTime)}
      </Text>
      {canOpenInstructorBio ? (
        <Pressable
          onPress={() => onPressInstructor(schedule)}
          hitSlop={8}
          style={{
            marginTop: 2,
            alignSelf: "flex-start",
            borderBottomWidth: 1,
            borderBottomColor: uiColors.accent
          }}
        >
          <Text style={{ color: uiColors.accent, fontWeight: "700" }}>
            Instructor: {instructor} (Tap for bio)
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: uiColors.muted }}>Instructor: TBD</Text>
      )}
      {isCancelled ? (
        <Text style={{ color: "#fca5a5", fontWeight: "700" }}>
          Cancelled by admin. Please check Mamute News for updates.
        </Text>
      ) : null}
    </Card>
  );
}

function formatClassType(classType: string) {
  return classType
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatClockTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  const safeHour = Number.isFinite(hour) ? hour : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  const period = safeHour >= 12 ? "PM" : "AM";
  const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
  return `${hour12}:${safeMinute.toString().padStart(2, "0")} ${period}`;
}

function toMinutes(timeValue: string) {
  const [hourRaw, minuteRaw] = timeValue.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

const toggleStyle = {
  backgroundColor: uiColors.surfaceAlt,
  borderWidth: 1,
  borderColor: uiColors.border,
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 14
};

const toggleActiveStyle = {
  borderColor: uiColors.accent
};

const toggleTextStyle = {
  color: uiColors.text,
  fontWeight: "700"
};

const dayPillStyle = {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: uiColors.border,
  backgroundColor: uiColors.surfaceAlt
};

const dayPillActiveStyle = {
  borderColor: uiColors.accent
};

const dayPillTextStyle = {
  color: uiColors.text,
  fontWeight: "700"
};
