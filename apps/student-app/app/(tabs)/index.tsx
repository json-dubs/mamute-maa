import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import {
  fetchLinkedStudents,
  fetchSchedules,
  getSupabaseClient,
  recordAttendance
} from "@mamute/api";
import { ClassScheduleTemplate, LinkedStudentSummary } from "@mamute/types";
import { gymMeta } from "@mamute/config";

interface UpcomingClass extends ClassScheduleTemplate {
  deltaMinutes: number;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const shortWeekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export default function CheckInScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [students, setStudents] = useState<LinkedStudentSummary[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCheckIn, setActiveCheckIn] = useState<string | null>(null);

  const studentNumbers = useMemo(
    () => students.map((student) => student.studentNumber),
    [students]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [linkedResult, schedulesResult] = await Promise.allSettled([
        fetchLinkedStudents(),
        fetchSchedules({ includeCancelled: false })
      ]);

      if (linkedResult.status === "fulfilled") {
        setStudents(linkedResult.value);
      } else {
        setStudents([]);
      }

      if (schedulesResult.status === "fulfilled") {
        setUpcomingClasses(getUpcomingClasses(schedulesResult.value));
      } else {
        setUpcomingClasses([]);
      }
    } catch (error) {
      console.warn("check-in load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionUserId(next?.user.id ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!sessionUserId) {
      setStudents([]);
      return;
    }
    load();
  }, [sessionUserId, load]);

  useFocusEffect(
    useCallback(() => {
      if (sessionUserId) {
        load();
      }
    }, [sessionUserId, load])
  );

  const handleCheckIn = async (classItem: UpcomingClass) => {
    if (!canCheckInNow(classItem.deltaMinutes)) {
      Alert.alert("Check-in unavailable", "Check-in opens 30 minutes before class start.");
      return;
    }
    if (!studentNumbers.length) {
      Alert.alert("No students linked", "Link at least one student account first.");
      return;
    }

    setActiveCheckIn(classItem.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "Enable location to check in for class.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const distance = haversineMeters(
        position.coords.latitude,
        position.coords.longitude,
        gymMeta.location.latitude,
        gymMeta.location.longitude
      );
      if (distance > gymMeta.checkinRadiusMeters) {
        Alert.alert(
          "Too far from gym",
          `You must be within ${gymMeta.checkinRadiusMeters}m to check in.`
        );
        return;
      }

      const response = await recordAttendance({
        studentNumbers,
        source: "mobile",
        locationVerified: true
      });
      const blocked = response.results.filter((result) => result.blocked);
      const checkedIn = response.results.filter((result) => !result.blocked);
      Alert.alert(
        "Check-in complete",
        `${checkedIn.length} checked in, ${blocked.length} blocked.`
      );
      load();
    } catch (error: any) {
      const message =
        typeof error?.message === "string" ? error.message : "Unable to check in.";
      Alert.alert("Check-in failed", message);
    } finally {
      setActiveCheckIn(null);
    }
  };

  return (
    <Screen>
      <HeroHeader title="Check-In" />
      <Card>
        <Row>
          <Text style={{ fontWeight: "700" }}>Linked Students</Text>
          <Text style={{ color: uiColors.muted }}>{students.length}</Text>
        </Row>
        {students.length ? (
          students.map((student) => {
            const name = [student.firstName, student.lastName].filter(Boolean).join(" ");
            return (
              <Text key={student.studentId} style={{ color: uiColors.muted }}>
                {name || "Student"} #{student.studentNumber}
              </Text>
            );
          })
        ) : (
          <Text style={{ color: uiColors.muted }}>
            No linked students found. Link from the Account tab.
          </Text>
        )}
      </Card>

      <Card>
        <Row>
          <Text style={{ fontWeight: "700" }}>Next 3 Classes</Text>
          <Pressable onPress={load}>
            <Text style={{ color: uiColors.accent }}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
        </Row>
        {upcomingClasses.length ? (
          upcomingClasses.map((classItem) => {
            const instructor = [classItem.instructorFirstName, classItem.instructorLastName]
              .filter(Boolean)
              .join(" ");
            const canCheckIn = canCheckInNow(classItem.deltaMinutes);
            return (
              <Card key={classItem.id} style={{ marginTop: 8 }}>
                <Row>
                  <Text style={{ fontWeight: "700" }}>{formatClassType(classItem.classType)}</Text>
                  <Badge
                    tone={canCheckIn ? "success" : "warning"}
                    label={canCheckIn ? "Check-in Open" : "Not Open"}
                  />
                </Row>
                <Text style={{ color: uiColors.muted }}>
                  {dayLabels[classItem.dayOfWeek]} {formatClockTime(classItem.startTime)} -{" "}
                  {formatClockTime(classItem.endTime)}
                </Text>
                <Text style={{ color: uiColors.muted }}>
                  {instructor ? `Instructor: ${instructor}` : "Instructor: TBD"}
                </Text>
                <Text style={{ color: uiColors.muted }}>{formatClassTiming(classItem.deltaMinutes)}</Text>
                <Pressable
                  disabled={!canCheckIn || !!activeCheckIn}
                  onPress={() => handleCheckIn(classItem)}
                  style={[buttonStyle, !canCheckIn || !!activeCheckIn ? buttonDisabledStyle : null]}
                >
                  <Text style={buttonTextStyle}>
                    {activeCheckIn === classItem.id ? "Checking In..." : "Check In"}
                  </Text>
                </Pressable>
              </Card>
            );
          })
        ) : (
          <Text style={{ color: uiColors.muted }}>No upcoming active classes found.</Text>
        )}
      </Card>
    </Screen>
  );
}

function getUpcomingClasses(schedules: ClassScheduleTemplate[]) {
  const activeSchedules = schedules.filter((schedule) => schedule.isActive);
  const upcoming = activeSchedules
    .map((schedule) => {
      const timezone = schedule.timezone || "America/Toronto";
      const nowContext = getNowInTimezone(timezone);
      const startMinutes = timeToMinutes(schedule.startTime);
      let deltaMinutes =
        (schedule.dayOfWeek - nowContext.dayOfWeek) * 24 * 60 +
        (startMinutes - nowContext.minutesOfDay);
      if (deltaMinutes < -30) {
        deltaMinutes += 7 * 24 * 60;
      }
      return {
        ...schedule,
        deltaMinutes
      } as UpcomingClass;
    })
    .sort((a, b) => a.deltaMinutes - b.deltaMinutes);

  return upcoming.slice(0, 3);
}

function getNowInTimezone(timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return {
    dayOfWeek: shortWeekdayMap[weekday] ?? 0,
    minutesOfDay: hour * 60 + minute
  };
}

function canCheckInNow(deltaMinutes: number) {
  return deltaMinutes >= -30 && deltaMinutes <= 30;
}

function formatClassTiming(deltaMinutes: number) {
  if (deltaMinutes < 0) {
    return `Started ${Math.abs(deltaMinutes)} min ago`;
  }
  if (deltaMinutes === 0) {
    return "Starting now";
  }
  if (deltaMinutes < 60) {
    return `Starts in ${deltaMinutes} min`;
  }
  if (deltaMinutes < 24 * 60) {
    const hours = Math.floor(deltaMinutes / 60);
    const minutes = deltaMinutes % 60;
    return `Starts in ${hours}h ${minutes}m`;
  }
  const days = Math.floor(deltaMinutes / (24 * 60));
  return `Starts in ${days} day${days === 1 ? "" : "s"}`;
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

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((chunk) => Number.parseInt(chunk, 10));
  const safeHour = Number.isFinite(hour) ? hour : 0;
  const safeMinute = Number.isFinite(minute) ? minute : 0;
  return safeHour * 60 + safeMinute;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

const buttonStyle = {
  marginTop: 8,
  backgroundColor: uiColors.accent,
  padding: 10,
  borderRadius: 10,
  alignItems: "center"
};

const buttonDisabledStyle = {
  backgroundColor: "#7f1d1d",
  opacity: 0.55
};

const buttonTextStyle = {
  color: "#0b1220",
  fontWeight: "700"
};
