import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { fetchSchedules } from "@mamute/api";
import { ClassScheduleTemplate } from "@mamute/types";

type ViewMode = "day" | "week";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<ClassScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

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
                  <ScheduleBlock key={schedule.id} schedule={schedule} />
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
                    <ScheduleBlock key={schedule.id} schedule={schedule} compact />
                  ))
                ) : (
                  <Text style={{ color: uiColors.muted }}>No classes</Text>
                )}
              </Card>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function ScheduleBlock({
  schedule,
  compact
}: {
  schedule: ClassScheduleTemplate;
  compact?: boolean;
}) {
  const instructor = [schedule.instructorFirstName, schedule.instructorLastName]
    .filter(Boolean)
    .join(" ");
  const classStatus = schedule.isActive ? "Active" : "Cancelled";

  return (
    <Card
      style={[
        {
          marginTop: 8,
          borderColor: schedule.isActive ? uiColors.border : "#7f1d1d",
          backgroundColor: schedule.isActive ? uiColors.surfaceAlt : "#2c0f13"
        },
        compact ? { padding: 10 } : null
      ]}
    >
      <Row>
        <Text style={{ fontWeight: "700" }}>{formatClassType(schedule.classType)}</Text>
        <Badge tone={schedule.isActive ? "success" : "danger"} label={classStatus} />
      </Row>
      <Text style={{ color: uiColors.muted }}>
        {formatClockTime(schedule.startTime)} - {formatClockTime(schedule.endTime)}
      </Text>
      <Text style={{ color: uiColors.muted }}>
        {instructor ? `Instructor: ${instructor}` : "Instructor: TBD"}
      </Text>
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
