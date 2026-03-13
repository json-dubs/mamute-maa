import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

export const config = {
  verify_jwt: false
};

interface AttendanceRequest {
  barcode?: string;
  studentNumbers?: number[];
  scheduleId?: string;
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

interface StudentAccessRow {
  user_id: string;
  student_id: string;
}

interface PushTokenRow {
  profile_id: string;
  expo_token: string;
  app_variant: string | null;
}

interface AdminCheckInReminder {
  student: StudentRow;
  schedule: ScheduleRow;
}

interface BadgeNewsRow {
  id: string;
  student_id: string;
  title: string;
  description: string;
  created_at: string;
}

const DEFAULT_TIMEZONE = "America/Toronto";
const MOBILE_LATE_CHECKIN_LIMIT_MINUTES = -30;
const MOBILE_EARLY_CHECKIN_LIMIT_MINUTES = 4 * 60;
const FRONTDESK_LATE_CHECKIN_LIMIT_MINUTES = -30;
const FRONTDESK_EARLY_CHECKIN_LIMIT_MINUTES = 4 * 60;
const CHECKIN_REMINDER_EXPIRY_HOURS = 24;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  try {
    const requestStartedAt = new Date();
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

    let schedule: ScheduleRow | null = null;
    if (payload.source === "mobile") {
      const eligible = await findMobileEligibleSchedules(supabase);
      if (!eligible.length) {
        return Response.json(
          { error: "NO_CLASS_AVAILABLE" },
          { status: 404, headers: corsHeaders }
        );
      }
      if (payload.scheduleId) {
        schedule = eligible.find((item) => item.id === payload.scheduleId) ?? null;
        if (!schedule) {
          return Response.json(
            {
              error: "SCHEDULE_NOT_ELIGIBLE",
              eligibleScheduleIds: eligible.map((item) => item.id)
            },
            { status: 403, headers: corsHeaders }
          );
        }
      } else {
        schedule = eligible[0];
      }
    } else {
      const eligible = await findFrontdeskEligibleSchedules(supabase);
      if (!eligible.length) {
        return Response.json(
          { error: "NO_CLASS_AVAILABLE" },
          { status: 404, headers: corsHeaders }
        );
      }
      if (payload.scheduleId) {
        schedule = eligible.find((item) => item.id === payload.scheduleId) ?? null;
        if (!schedule) {
          return Response.json(
            {
              error: "SCHEDULE_NOT_ELIGIBLE",
              eligibleScheduleIds: eligible.map((item) => item.id)
            },
            { status: 403, headers: corsHeaders }
          );
        }
      } else {
        schedule = eligible[0];
      }
    }

    const results = [];
    const adminReminders: AdminCheckInReminder[] = [];
    const successfulStudentIds = new Set<string>();
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
      successfulStudentIds.add(student.id);

      if (payload.source === "frontdesk") {
        adminReminders.push({ student, schedule });
      }
    }

    if (payload.source === "frontdesk" && adminReminders.length) {
      try {
        await sendAdminCheckInReminders(supabase, adminReminders);
      } catch (reminderError) {
        const message =
          reminderError instanceof Error ? reminderError.message : "Unknown reminder error";
        console.error(`Failed to send admin check-in reminders: ${message}`);
      }
    }

    try {
      await sendAutomaticBadgePushes(
        supabase,
        [...successfulStudentIds],
        requestStartedAt.toISOString()
      );
    } catch (badgePushError) {
      const message =
        badgePushError instanceof Error ? badgePushError.message : "Unknown badge push error";
      console.error(`Failed to send automatic badge pushes: ${message}`);
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

async function findFrontdeskEligibleSchedules(client: any): Promise<ScheduleRow[]> {
  const { data, error } = await client
    .from("class_schedules")
    .select(
      "id, class_type, instructor_id, day_of_week, start_time, end_time, timezone"
    )
    .eq("is_active", true);
  if (error) return [];

  const now = new Date();
  const candidates = (data ?? [])
    .map((row: ScheduleRow) => ({
      row,
      delta: minutesUntilSchedule(row, now)
    }))
    .filter(
      (item) =>
        item.delta >= FRONTDESK_LATE_CHECKIN_LIMIT_MINUTES &&
        item.delta <= FRONTDESK_EARLY_CHECKIN_LIMIT_MINUTES
    )
    .sort((a, b) => a.delta - b.delta);

  return await removeCancelledOccurrences(client, candidates.map((item) => item.row), now);
}

async function findMobileEligibleSchedules(client: any): Promise<ScheduleRow[]> {
  const { data, error } = await client
    .from("class_schedules")
    .select(
      "id, class_type, instructor_id, day_of_week, start_time, end_time, timezone"
    )
    .eq("is_active", true);
  if (error) return [];
  const now = new Date();
  const candidates = (data ?? [])
    .map((row: ScheduleRow) => ({
      row,
      delta: minutesUntilSchedule(row, now)
    }))
    .filter(
      (item) =>
        item.delta >= MOBILE_LATE_CHECKIN_LIMIT_MINUTES &&
        item.delta <= MOBILE_EARLY_CHECKIN_LIMIT_MINUTES
    )
    .sort((a, b) => a.delta - b.delta)
    .map((item) => item.row);

  const notCancelled = await removeCancelledOccurrences(client, candidates, now);
  return notCancelled.slice(0, 3);
}

async function removeCancelledOccurrences(
  client: any,
  schedules: ScheduleRow[],
  now: Date
): Promise<ScheduleRow[]> {
  if (!schedules.length) return [];

  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  const endDate = new Date(now);
  endDate.setUTCDate(endDate.getUTCDate() + 14);

  const { data, error } = await client
    .from("class_schedule_exceptions")
    .select("schedule_id, occurrence_date")
    .in("schedule_id", schedules.map((schedule) => schedule.id))
    .gte("occurrence_date", startDate.toISOString().slice(0, 10))
    .lte("occurrence_date", endDate.toISOString().slice(0, 10));

  if (error) return schedules;

  const cancelledKeys = new Set(
    ((data as Array<{ schedule_id: string; occurrence_date: string }> | null) ?? []).map(
      (row) => `${row.schedule_id}:${row.occurrence_date}`
    )
  );

  return schedules.filter((schedule) => {
    const occurrenceDate = getNextOccurrenceDate(schedule, now);
    return !cancelledKeys.has(`${schedule.id}:${occurrenceDate}`);
  });
}

function minutesUntilSchedule(schedule: ScheduleRow, now: Date) {
  const timezone = safeTimeZone(schedule.timezone || DEFAULT_TIMEZONE);
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.start_time);
  let delta = (schedule.day_of_week - nowDay) * 24 * 60 + (startMinutes - nowMinutes);
  if (delta < MOBILE_LATE_CHECKIN_LIMIT_MINUTES) {
    delta += 7 * 24 * 60;
  }
  return delta;
}

function getNextOccurrenceDate(schedule: ScheduleRow, now: Date) {
  const timezone = safeTimeZone(schedule.timezone || DEFAULT_TIMEZONE);
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
    firstName: student.first_name ?? null,
    lastName: student.last_name ?? null,
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

async function sendAdminCheckInReminders(
  client: any,
  reminders: AdminCheckInReminder[]
) {
  if (!reminders.length) return;

  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + CHECKIN_REMINDER_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const postRows = reminders.map((item) => ({
    title: "Check-In Reminder",
    description: buildCheckInReminderBody(item.schedule),
    visibility: "private",
    post_type: "general",
    student_id: item.student.id,
    expires_at: expiresAt,
    created_by: null
  }));
  const { error: postError } = await client.from("mamute_news").insert(postRows);
  if (postError) {
    console.error(`Failed to insert check-in reminder news posts: ${postError.message}`);
  }

  const studentIds = [...new Set(reminders.map((item) => item.student.id))];
  const { data: links, error: linkError } = await client
    .from("student_access")
    .select("user_id, student_id")
    .in("student_id", studentIds);

  if (linkError) {
    console.error(`Failed to load student links for reminders: ${linkError.message}`);
    return;
  }

  const accessRows = (links ?? []) as StudentAccessRow[];
  if (!accessRows.length) return;

  const reminderByStudentId = new Map(reminders.map((item) => [item.student.id, item]));
  const notificationRows = accessRows
    .map((link) => {
      const reminder = reminderByStudentId.get(link.student_id);
      if (!reminder) return null;
      const title = "Check-In Reminder";
      const body = buildCheckInReminderBody(reminder.schedule);
      return {
        type: "reminder",
        target: {
          profileId: link.user_id,
          studentId: reminder.student.id,
          studentNumber: reminder.student.student_number
        },
        title,
        body,
        scheduled_at: createdAt.toISOString(),
        created_by: null
      };
    })
    .filter(Boolean);

  if (notificationRows.length) {
    const { error: notificationError } = await client
      .from("notifications")
      .insert(notificationRows);
    if (notificationError) {
      console.error(`Failed to insert reminder notifications: ${notificationError.message}`);
    }
  }

  const profileIds = [...new Set(accessRows.map((row) => row.user_id))];
  const { data: tokenRows, error: tokenError } = await client
    .from("push_tokens")
    .select("profile_id, expo_token, app_variant")
    .in("profile_id", profileIds);

  if (tokenError) {
    console.error(`Failed to load push tokens for reminders: ${tokenError.message}`);
    return;
  }

  const allowedVariants = new Set(["standalone", "bare", null, "", "unknown"]);
  const tokens = ((tokenRows ?? []) as PushTokenRow[]).filter((row) =>
    allowedVariants.has(row.app_variant)
  );
  if (!tokens.length) return;

  const tokensByProfile = new Map<string, string[]>();
  for (const row of tokens) {
    const list = tokensByProfile.get(row.profile_id) ?? [];
    list.push(row.expo_token);
    tokensByProfile.set(row.profile_id, list);
  }

  const pushMessages = accessRows.flatMap((link) => {
    const reminder = reminderByStudentId.get(link.student_id);
    const profileTokens = tokensByProfile.get(link.user_id) ?? [];
    if (!reminder || !profileTokens.length) return [];
    return profileTokens.map((token) => ({
      to: token,
      title: "Check-In Reminder",
      body: buildCheckInReminderBody(reminder.schedule)
    }));
  });

  if (!pushMessages.length) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(pushMessages)
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error(
      `Failed to send check-in reminder push notifications: ${response.status} ${response.statusText} ${responseText}`
    );
  }
}

async function sendAutomaticBadgePushes(
  client: any,
  studentIds: string[],
  createdAfterIso: string
) {
  if (!studentIds.length) return;

  const { data: badgeRows, error: badgeError } = await client
    .from("mamute_news")
    .select("id, student_id, title, description, created_at")
    .eq("post_type", "badge")
    .eq("visibility", "private")
    .in("student_id", studentIds)
    .gte("created_at", createdAfterIso)
    .order("created_at", { ascending: true });

  if (badgeError) {
    console.error(`Failed to load automatic badge news rows: ${badgeError.message}`);
    return;
  }

  const badgePosts = (badgeRows ?? []) as BadgeNewsRow[];
  if (!badgePosts.length) return;

  const { data: links, error: linkError } = await client
    .from("student_access")
    .select("user_id, student_id")
    .in("student_id", [...new Set(badgePosts.map((row) => row.student_id))]);
  if (linkError) {
    console.error(`Failed to load student links for badge pushes: ${linkError.message}`);
    return;
  }

  const accessRows = (links ?? []) as StudentAccessRow[];
  if (!accessRows.length) return;

  const profileIds = [...new Set(accessRows.map((row) => row.user_id))];
  const { data: tokenRows, error: tokenError } = await client
    .from("push_tokens")
    .select("profile_id, expo_token, app_variant")
    .in("profile_id", profileIds);

  if (tokenError) {
    console.error(`Failed to load push tokens for badge pushes: ${tokenError.message}`);
    return;
  }

  const allowedVariants = new Set(["standalone", "bare", null, "", "unknown"]);
  const tokenRowsFiltered = ((tokenRows ?? []) as PushTokenRow[]).filter((row) =>
    allowedVariants.has(row.app_variant)
  );
  if (!tokenRowsFiltered.length) return;

  const tokensByProfile = new Map<string, string[]>();
  for (const row of tokenRowsFiltered) {
    const list = tokensByProfile.get(row.profile_id) ?? [];
    list.push(row.expo_token);
    tokensByProfile.set(row.profile_id, list);
  }

  const usersByStudent = new Map<string, string[]>();
  for (const row of accessRows) {
    const list = usersByStudent.get(row.student_id) ?? [];
    list.push(row.user_id);
    usersByStudent.set(row.student_id, list);
  }

  const pushMessages = badgePosts.flatMap((post) => {
    const userIds = usersByStudent.get(post.student_id) ?? [];
    return userIds.flatMap((userId) => {
      const tokens = tokensByProfile.get(userId) ?? [];
      if (!tokens.length) return [];
      return tokens.map((token) => ({
        to: token,
        title: post.title,
        body: truncateNotificationBody(post.description)
      }));
    });
  });
  if (!pushMessages.length) return;

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(pushMessages)
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error(
      `Failed to send automatic badge push notifications: ${response.status} ${response.statusText} ${responseText}`
    );
  }
}

function buildCheckInReminderBody(schedule: ScheduleRow) {
  const classLabel = formatClassType(schedule.class_type);
  const timeLabel = `${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`;
  return `You were checked in for ${classLabel} (${timeLabel}). Please check in with the Mamute app when you arrive to class next time.`;
}

function truncateNotificationBody(value: string, maxLength = 140) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatClassType(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
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
