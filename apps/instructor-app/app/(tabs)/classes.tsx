import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { getSupabaseClient } from "@mamute/api";

type InstructorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ScheduleRow = {
  id: string;
  class_type: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
};

type ExceptionRow = {
  id: string;
  schedule_id: string;
  occurrence_date: string;
};

const dayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
];

export default function ClassesScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [classType, setClassType] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("18:00");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [instructorId, setInstructorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [instructorRes, scheduleRes] = await Promise.all([
        supabase
          .from("instructors")
          .select("id, first_name, last_name")
          .order("first_name", { ascending: true }),
        supabase
          .from("class_schedules")
          .select("id, class_type, instructor_id, day_of_week, start_time, end_time, timezone, is_active")
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true })
      ]);

      if (instructorRes.error) throw instructorRes.error;
      if (scheduleRes.error) throw scheduleRes.error;

      setInstructors((instructorRes.data as InstructorRow[]) ?? []);
      const scheduleRows = (scheduleRes.data as ScheduleRow[]) ?? [];
      setSchedules(scheduleRows);

      const scheduleIds = scheduleRows.map((row) => row.id);
      if (scheduleIds.length) {
        const today = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 14);
        const { data: exceptionData, error: exceptionError } = await supabase
          .from("class_schedule_exceptions")
          .select("id, schedule_id, occurrence_date")
          .in("schedule_id", scheduleIds)
          .gte("occurrence_date", today.toISOString().slice(0, 10))
          .lte("occurrence_date", to.toISOString().slice(0, 10));
        if (exceptionError) throw exceptionError;
        setExceptions((exceptionData as ExceptionRow[]) ?? []);
      } else {
        setExceptions([]);
      }
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    name: "instructor-classes",
    tables: ["class_schedules", "class_schedule_exceptions", "instructors"],
    onRefresh: load
  });

  const cancelMap = useMemo(() => {
    const map = new Map<string, ExceptionRow>();
    for (const schedule of schedules) {
      const nextDate = getNextOccurrenceDate(schedule);
      const match = exceptions.find(
        (exception) =>
          exception.schedule_id === schedule.id && exception.occurrence_date === nextDate
      );
      if (match) {
        map.set(schedule.id, match);
      }
    }
    return map;
  }, [exceptions, schedules]);

  const resetForm = () => {
    setEditingId(null);
    setClassType("");
    setDayOfWeek(1);
    setStartTime("17:00");
    setEndTime("18:00");
    setTimezone("America/Toronto");
    setInstructorId(null);
  };

  const startEdit = (schedule: ScheduleRow) => {
    setEditingId(schedule.id);
    setClassType(schedule.class_type);
    setDayOfWeek(schedule.day_of_week);
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setTimezone(schedule.timezone || "America/Toronto");
    setInstructorId(schedule.instructor_id);
  };

  const submit = async () => {
    if (!classType.trim()) {
      setMessage("Class name is required.");
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setMessage("Use HH:MM format for start/end times.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        class_type: classType.trim(),
        instructor_id: instructorId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        timezone
      };

      const { error } = editingId
        ? await supabase.from("class_schedules").update(payload).eq("id", editingId)
        : await supabase.from("class_schedules").insert({ ...payload, is_active: true });
      if (error) throw error;

      resetForm();
      await load();
      setMessage(editingId ? "Class updated." : "Class added.");
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to save class.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (schedule: ScheduleRow) => {
    Alert.alert(
      "Delete class?",
      `Delete ${formatClassType(schedule.class_type)} on ${dayOptions[schedule.day_of_week]?.label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void runDeleteSchedule(schedule);
          }
        }
      ]
    );
  };

  const runDeleteSchedule = async (schedule: ScheduleRow) => {
    try {
      const { error } = await supabase.from("class_schedules").delete().eq("id", schedule.id);
      if (error) throw error;
      await load();
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to delete class.");
    }
  };

  const toggleRecurringActive = async (schedule: ScheduleRow) => {
    try {
      const { error } = await supabase
        .from("class_schedules")
        .update({ is_active: !schedule.is_active })
        .eq("id", schedule.id);
      if (error) throw error;
      await load();
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to update class status.");
    }
  };

  const toggleNextCancellation = async (schedule: ScheduleRow) => {
    const existing = cancelMap.get(schedule.id);
    try {
      if (existing) {
        const { error } = await supabase
          .from("class_schedule_exceptions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const occurrenceDate = getNextOccurrenceDate(schedule);
        const { error } = await supabase.from("class_schedule_exceptions").insert({
          schedule_id: schedule.id,
          occurrence_date: occurrenceDate
        });
        if (error) throw error;
      }
      await load();
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to update next occurrence status.");
    }
  };

  return (
    <Screen>
      <HeroHeader title="Class Scheduling" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Card>
          <Row>
            <Text style={{ fontWeight: "800", fontSize: 18 }}>
              {editingId ? "Edit Class" : "Add Class"}
            </Text>
            <Pressable onPress={() => void load()}>
              <Text style={{ color: uiColors.accent }}>{loading ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
          </Row>

          <TextInput
            style={inputStyle}
            value={classType}
            onChangeText={setClassType}
            placeholder="Class name (e.g. Muay Thai)"
            placeholderTextColor={uiColors.muted}
          />

          <Text style={{ fontWeight: "700" }}>Day</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {dayOptions.map((day) => (
              <Pressable
                key={day.value}
                style={[pillStyle, dayOfWeek === day.value ? pillActiveStyle : null]}
                onPress={() => setDayOfWeek(day.value)}
              >
                <Text style={dayOfWeek === day.value ? pillTextActiveStyle : pillTextStyle}>
                  {day.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>Start</Text>
              <TextInput
                style={inputStyle}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="17:00"
                placeholderTextColor={uiColors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>End</Text>
              <TextInput
                style={inputStyle}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="18:00"
                placeholderTextColor={uiColors.muted}
              />
            </View>
          </View>

          <TextInput
            style={inputStyle}
            value={timezone}
            onChangeText={setTimezone}
            placeholder="Timezone (e.g. America/Toronto)"
            placeholderTextColor={uiColors.muted}
          />

          <Text style={{ fontWeight: "700" }}>Instructor</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              style={[pillStyle, instructorId === null ? pillActiveStyle : null]}
              onPress={() => setInstructorId(null)}
            >
              <Text style={instructorId === null ? pillTextActiveStyle : pillTextStyle}>
                Unassigned
              </Text>
            </Pressable>
            {instructors.map((instructor) => {
              const selected = instructorId === instructor.id;
              const name = [instructor.first_name, instructor.last_name]
                .filter(Boolean)
                .join(" ");
              return (
                <Pressable
                  key={instructor.id}
                  style={[pillStyle, selected ? pillActiveStyle : null]}
                  onPress={() => setInstructorId(instructor.id)}
                >
                  <Text style={selected ? pillTextActiveStyle : pillTextStyle}>
                    {name || "Instructor"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={buttonStyle} onPress={submit} disabled={saving}>
            <Text style={buttonTextStyle}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add Class"}</Text>
          </Pressable>
          {editingId ? (
            <Pressable style={[buttonStyle, secondaryButtonStyle]} onPress={resetForm}>
              <Text style={secondaryButtonTextStyle}>Cancel Edit</Text>
            </Pressable>
          ) : null}
          {message ? <Text style={{ color: "#fca5a5" }}>{message}</Text> : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>Scheduled Classes</Text>
          {schedules.length ? (
            schedules.map((schedule) => {
              const instructor = instructors.find((item) => item.id === schedule.instructor_id);
              const instructorName = instructor
                ? [instructor.first_name, instructor.last_name].filter(Boolean).join(" ")
                : "Unassigned";
              const isNextCancelled = cancelMap.has(schedule.id);
              const nextDate = getNextOccurrenceDate(schedule);
              return (
                <Card key={schedule.id} style={{ marginTop: 8, backgroundColor: uiColors.surfaceAlt }}>
                  <Row>
                    <Text style={{ fontWeight: "700" }}>{formatClassType(schedule.class_type)}</Text>
                    <Text style={{ color: schedule.is_active ? "#86efac" : "#fca5a5", fontWeight: "700" }}>
                      {schedule.is_active ? "Active" : "Inactive"}
                    </Text>
                  </Row>
                  <Text style={{ color: uiColors.muted }}>
                    {dayOptions[schedule.day_of_week]?.label} {schedule.start_time.slice(0, 5)} -{" "}
                    {schedule.end_time.slice(0, 5)} ({schedule.timezone})
                  </Text>
                  <Text style={{ color: uiColors.muted }}>Instructor: {instructorName}</Text>
                  <Text style={{ color: isNextCancelled ? "#fca5a5" : "#86efac" }}>
                    Next occurrence {nextDate}: {isNextCancelled ? "Cancelled" : "Active"}
                  </Text>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Pressable style={[smallButtonStyle, secondaryButtonStyle]} onPress={() => startEdit(schedule)}>
                      <Text style={secondaryButtonTextStyle}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[smallButtonStyle, secondaryButtonStyle]}
                      onPress={() => void toggleRecurringActive(schedule)}
                    >
                      <Text style={secondaryButtonTextStyle}>
                        {schedule.is_active ? "Set Inactive" : "Set Active"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[smallButtonStyle, secondaryButtonStyle]}
                      onPress={() => void toggleNextCancellation(schedule)}
                    >
                      <Text style={secondaryButtonTextStyle}>
                        {isNextCancelled ? "Restore Next" : "Cancel Next"}
                      </Text>
                    </Pressable>
                    <Pressable style={[smallButtonStyle, deleteButtonStyle]} onPress={() => void deleteSchedule(schedule)}>
                      <Text style={buttonTextStyle}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })
          ) : (
            <Text style={{ color: uiColors.muted }}>No classes scheduled.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function formatClassType(classType: string) {
  return classType
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getNextOccurrenceDate(schedule: ScheduleRow) {
  const timezone = safeTimeZone(schedule.timezone || "America/Toronto");
  const now = new Date();
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.start_time);
  let dayOffset = schedule.day_of_week - nowDay;

  if (dayOffset < 0 || (dayOffset === 0 && startMinutes < nowMinutes)) {
    dayOffset += 7;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10);
  const month =
    Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "1", 10) - 1;
  const day = Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "1", 10);

  const baseDate = new Date(Date.UTC(year, month, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
  return baseDate.toISOString().slice(0, 10);
}

function getDayOfWeek(date: Date, timezone: string) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[label] ?? 0;
}

function getMinutesOfDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(
    parts.find((part) => part.type === "minute")?.value ?? "0",
    10
  );
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function safeTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "America/Toronto";
  }
}

const inputStyle = {
  backgroundColor: uiColors.surfaceAlt,
  color: uiColors.text,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: uiColors.border
};

const pillStyle = {
  borderRadius: 999,
  borderWidth: 1,
  borderColor: uiColors.border,
  backgroundColor: uiColors.surfaceAlt,
  paddingVertical: 7,
  paddingHorizontal: 10
};

const pillActiveStyle = {
  borderColor: uiColors.accent,
  backgroundColor: uiColors.accent
};

const pillTextStyle = {
  color: uiColors.text
};

const pillTextActiveStyle = {
  color: "#0b1220",
  fontWeight: "700" as const
};

const buttonStyle = {
  backgroundColor: uiColors.accent,
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center" as const
};

const smallButtonStyle = {
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 10,
  alignItems: "center" as const
};

const secondaryButtonStyle = {
  backgroundColor: uiColors.surface,
  borderWidth: 1,
  borderColor: uiColors.border
};

const secondaryButtonTextStyle = {
  color: uiColors.text,
  fontWeight: "700" as const
};

const deleteButtonStyle = {
  backgroundColor: "#dc2626"
};

const buttonTextStyle = {
  color: "#0b1220",
  fontWeight: "800" as const
};
