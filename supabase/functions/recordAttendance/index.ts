import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

export const config = {
  verify_jwt: false
};

interface AttendanceRequest {
  barcode?: string;
  studentNumbers?: number[];
  deviceId?: string;
  source: "frontdesk" | "mobile";
  locationVerified?: boolean;
}

interface StudentRow {
  id: string;
  student_number: number;
  first_name: string | null;
  last_name: string | null;
  membership_standing: "active" | "inactive" | "overdue";
}

interface ScheduleRow {
  id: string;
  class_type: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
}

const DEFAULT_TIMEZONE = "America/Toronto";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const supabase = createServiceClient();
    const payload = (await req.json()) as AttendanceRequest;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userId = payload.source === "mobile" ? await resolveUserId(authHeader) : null;
    if (payload.source === "mobile" && !userId) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: corsHeaders });
    }

    if (payload.source === "mobile" && payload.locationVerified !== true) {
      return Response.json(
        { error: "LOCATION_REQUIRED" },
        { status: 403, headers: corsHeaders }
      );
    }

    const settings = await fetchGymSettings(supabase);
    const timezone = safeTimeZone(settings?.timezone ?? DEFAULT_TIMEZONE);
    const barcodePrefix = settings?.barcode_prefix ?? "MMAA-";

    const studentNumbers = normalizeStudentNumbers(payload, barcodePrefix);
    if (!studentNumbers.length) {
      return Response.json(
        { error: "MISSING_STUDENT_NUMBERS" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, student_number, first_name, last_name, membership_standing")
      .in("student_number", studentNumbers);

    if (studentsError) {
      return Response.json(
        { error: studentsError.message },
        { status: 400, headers: corsHeaders }
      );
    }

    const foundNumbers = new Set((students ?? []).map((row) => row.student_number));
    const missing = studentNumbers.filter((num) => !foundNumbers.has(num));
    if (missing.length) {
      return Response.json(
        { error: "STUDENTS_NOT_FOUND", missing },
        { status: 404, headers: corsHeaders }
      );
    }

    if (payload.source === "mobile") {
      const hasAccess = await verifyStudentAccess(
        supabase,
        userId as string,
        (students ?? []).map((row) => row.id)
      );
      if (!hasAccess) {
        return Response.json(
          { error: "ACCESS_DENIED" },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const schedule = await findNextSchedule(supabase, timezone);
    if (!schedule) {
      return Response.json(
        { error: "NO_CLASS_AVAILABLE" },
        { status: 404, headers: corsHeaders }
      );
    }

    const results = [];
    for (const student of students as StudentRow[]) {
      const blocked = student.membership_standing !== "active";
      if (payload.source === "mobile" && blocked) {
        results.push({
          student: normalizeStudent(student),
          blocked,
          reason: "MEMBERSHIP_NOT_ACTIVE"
        });
        continue;
      }

      const { data: attendance, error: attendanceError } = await supabase
        .from("attendance")
        .insert({
          student_id: student.id,
          schedule_id: schedule.id,
          session_start_at: null,
          session_end_at: null,
          device_id: payload.deviceId,
          source: payload.source,
          location_verified: payload.locationVerified ?? false
        })
        .select()
        .maybeSingle();

      if (attendanceError) {
        results.push({
          student: normalizeStudent(student),
          blocked: true,
          reason: attendanceError.message
        });
        continue;
      }

      results.push({
        student: normalizeStudent(student),
        blocked,
        attendance: normalizeAttendance(attendance)
      });
    }

    return Response.json(
      {
        schedule: normalizeSchedule(schedule),
        results
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    return Response.json(
      {
        error: "SERVER_ERROR",
        message: error?.message ?? "Unexpected error"
      },
      { status: 500, headers: corsHeaders }
    );
  }
});

function normalizeStudentNumbers(payload: AttendanceRequest, prefix: string) {
  if (payload.studentNumbers?.length) return payload.studentNumbers;
  if (!payload.barcode) return [];
  const trimmed = payload.barcode.trim();
  const normalized = trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length)
    : trimmed;
  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? [value] : [];
}

async function fetchGymSettings(client: any) {
  const { data } = await client
    .from("gym_settings")
    .select("timezone, barcode_prefix")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

async function verifyStudentAccess(
  client: any,
  userId: string,
  studentIds: string[]
) {
  const { data, error } = await client
    .from("student_access")
    .select("student_id")
    .eq("user_id", userId)
    .in("student_id", studentIds);
  if (error) return false;
  return (data ?? []).length === studentIds.length;
}

async function findNextSchedule(client: any, timezone: string): Promise<ScheduleRow | null> {
  const now = new Date();
  const dayOfWeek = getDayOfWeek(now, timezone);
  const { data, error } = await client
    .from("class_schedules")
    .select(
      "id, class_type, instructor_id, day_of_week, start_time, end_time, timezone"
    )
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);
  if (error) return null;

  const nowMinutes = getMinutesOfDay(now, timezone);
  const windowStart = nowMinutes - 30;
  const windowEnd = nowMinutes + 30;
  const eligible = (data ?? []).filter((row: ScheduleRow) => {
    const startMinutes = timeToMinutes(row.start_time);
    return startMinutes >= windowStart && startMinutes <= windowEnd;
  });
  eligible.sort((a: ScheduleRow, b: ScheduleRow) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );
  return eligible[0] ?? null;
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
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((chunk) => Number.parseInt(chunk, 10));
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function normalizeStudent(student: StudentRow) {
  return {
    id: student.id,
    studentNumber: student.student_number,
    fullName: [student.first_name, student.last_name].filter(Boolean).join(" "),
    membershipStanding: student.membership_standing
  };
}

function safeTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function normalizeSchedule(schedule: ScheduleRow) {
  return {
    id: schedule.id,
    classType: schedule.class_type,
    instructorId: schedule.instructor_id,
    dayOfWeek: schedule.day_of_week,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    timezone: schedule.timezone
  };
}

function normalizeAttendance(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId,
    scheduleId: row.schedule_id ?? row.scheduleId,
    sessionStartAt: row.session_start_at ?? row.sessionStartAt,
    sessionEndAt: row.session_end_at ?? row.sessionEndAt,
    scannedAt: row.scanned_at ?? row.scannedAt,
    deviceId: row.device_id ?? row.deviceId,
    source: row.source,
    locationVerified: row.location_verified ?? row.locationVerified
  };
}

async function resolveUserId(authHeader: string) {
  if (!authHeader) return null;
  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const anonKey =
    Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });
  const { data, error } = await authClient.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

function createServiceClient() {
  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false } });
}
