import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { fetchSchedules, recordAttendance } from "@mamute/api";
import { CheckInResponse, ClassScheduleTemplate } from "@mamute/types";

export default function CheckInScreen() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<ClassScheduleTemplate[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [studentNumberInput, setStudentNumberInput] = useState("");
  const [checkInResponse, setCheckInResponse] = useState<CheckInResponse | null>(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchSchedules({ includeCancelled: false });
      setSchedules(data);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  useRealtimeRefresh({
    name: "instructor-checkin",
    tables: ["class_schedules", "class_schedule_exceptions"],
    onRefresh: loadSchedules
  });

  const eligibleSchedules = useMemo(() => {
    const now = new Date();
    return schedules
      .filter((schedule) => schedule.isActive)
      .map((schedule) => ({
        schedule,
        deltaMinutes: minutesUntilSchedule(schedule, now)
      }))
      .filter((entry) => entry.deltaMinutes >= -30 && entry.deltaMinutes <= 4 * 60)
      .sort((a, b) => a.deltaMinutes - b.deltaMinutes)
      .map((entry) => entry.schedule);
  }, [schedules]);

  useEffect(() => {
    if (!eligibleSchedules.length) {
      setSelectedScheduleId("");
      return;
    }

    if (!selectedScheduleId || !eligibleSchedules.some((item) => item.id === selectedScheduleId)) {
      setSelectedScheduleId(eligibleSchedules[0].id);
    }
  }, [eligibleSchedules, selectedScheduleId]);

  const submitCheckIn = async () => {
    const studentNumbers = parseStudentNumbers(studentNumberInput);
    if (!studentNumbers.length) {
      setMessage("Enter at least one valid student number.");
      return;
    }
    if (!selectedScheduleId) {
      setMessage("Select a class for check-in.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await recordAttendance({
        studentNumbers,
        scheduleId: selectedScheduleId,
        source: "frontdesk",
        deviceId: "instructor-mobile"
      });
      setCheckInResponse(response);
      setStudentNumberInput("");
      setMessage("Check-in recorded.");
    } catch (error: any) {
      setCheckInResponse(null);
      setMessage(error?.message ?? "Check-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <HeroHeader title="Student Check-In" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Front Desk Check-In</Text>
            <Pressable onPress={() => void loadSchedules()}>
              <Text style={styles.refreshText}>{loading ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
          </View>
          <Text style={styles.mutedText}>
            Select a class in the next 4 hours and enter student number(s) to sign them in.
          </Text>

          <Text style={styles.fieldLabel}>Class</Text>
          <View style={styles.pillWrap}>
            {eligibleSchedules.length ? (
              eligibleSchedules.map((schedule) => {
                const selected = schedule.id === selectedScheduleId;
                return (
                  <Pressable
                    key={schedule.id}
                    style={[styles.pill, selected ? styles.pillActive : null]}
                    onPress={() => setSelectedScheduleId(schedule.id)}
                  >
                    <Text style={selected ? styles.pillTextActive : styles.pillText}>
                      {formatScheduleOption(schedule)}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.mutedText}>No classes available in the current check-in window.</Text>
            )}
          </View>

          <Text style={styles.fieldLabel}>Student Number(s)</Text>
          <TextInput
            style={styles.input}
            value={studentNumberInput}
            onChangeText={setStudentNumberInput}
            placeholder="e.g. 1547 or 1547, 1548"
            placeholderTextColor={uiColors.muted}
            keyboardType="number-pad"
            editable={!submitting}
          />

          <Pressable
            style={[styles.button, (!eligibleSchedules.length || submitting) ? styles.buttonDisabled : null]}
            onPress={() => void submitCheckIn()}
            disabled={!eligibleSchedules.length || submitting}
          >
            <Text style={styles.buttonText}>{submitting ? "Checking In..." : "Check In Student(s)"}</Text>
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </Card>

        {checkInResponse ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Latest Result</Text>
            <Text style={styles.mutedText}>
              {formatClassType(checkInResponse.schedule.classType)} ·{" "}
              {checkInResponse.schedule.startTime} - {checkInResponse.schedule.endTime}
            </Text>
            {checkInResponse.results.map((result) => (
              <View key={`${result.student.studentNumber}-${result.attendance?.id ?? "none"}`} style={styles.resultRow}>
                <Text style={styles.resultName}>
                  {formatStudentName(result.student.firstName, result.student.lastName)} #{result.student.studentNumber}
                </Text>
                <Text
                  style={result.blocked ? styles.resultStatusBlocked : styles.resultStatusOk}
                >
                  {result.blocked ? result.reason ?? "Blocked" : "Checked in"}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function parseStudentNumbers(value: string) {
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((num) => Number.isFinite(num));
}

function formatScheduleOption(schedule: ClassScheduleTemplate) {
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][schedule.dayOfWeek] ?? "Day";
  return `${day} ${schedule.startTime.slice(0, 5)} ${formatClassType(schedule.classType)}`;
}

function formatClassType(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatStudentName(firstName?: string | null, lastName?: string | null) {
  const joined = [firstName, lastName].filter(Boolean).join(" ");
  return joined || "Student";
}

function minutesUntilSchedule(schedule: ClassScheduleTemplate, now: Date) {
  const timezone = safeTimeZone(schedule.timezone || "America/Toronto");
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.startTime);
  let delta = (schedule.dayOfWeek - nowDay) * 24 * 60 + (startMinutes - nowMinutes);
  if (delta < -30) {
    delta += 7 * 24 * 60;
  }
  return delta;
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
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);
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

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  refreshText: {
    color: uiColors.accent,
    fontWeight: "700"
  },
  mutedText: {
    color: uiColors.muted
  },
  fieldLabel: {
    fontWeight: "700",
    marginTop: 8
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  pillActive: {
    borderColor: uiColors.accent,
    backgroundColor: uiColors.accent
  },
  pillText: {
    color: uiColors.text
  },
  pillTextActive: {
    color: "#0b1220",
    fontWeight: "700"
  },
  input: {
    backgroundColor: uiColors.surfaceAlt,
    color: uiColors.text,
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 10,
    padding: 12
  },
  button: {
    backgroundColor: uiColors.accent,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#0b1220",
    fontWeight: "800"
  },
  message: {
    color: "#fca5a5"
  },
  resultRow: {
    borderTopWidth: 1,
    borderTopColor: uiColors.border,
    paddingTop: 8
  },
  resultName: {
    fontWeight: "700"
  },
  resultStatusOk: {
    fontSize: 12,
    color: "#86efac"
  },
  resultStatusBlocked: {
    fontSize: 12,
    color: "#fca5a5"
  }
});
