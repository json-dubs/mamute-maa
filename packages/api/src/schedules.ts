import { getSupabaseClient } from "./client";
import { ClassScheduleTemplate } from "@mamute/types";

export async function fetchSchedules(options?: {
  includeCancelled?: boolean;
}): Promise<ClassScheduleTemplate[]> {
  const supabase = getSupabaseClient();
  let queryWithInstructor = supabase
    .from("class_schedules")
    .select(
      "id, class_type, instructor_id, day_of_week, start_time, end_time, timezone, is_active, instructors:instructor_id(first_name, last_name)"
    )
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (!options?.includeCancelled) {
    queryWithInstructor = queryWithInstructor.eq("is_active", true);
  }

  let { data, error } = await queryWithInstructor;
  if (error) {
    let fallbackQuery = supabase
      .from("class_schedules")
      .select(
        "id, class_type, instructor_id, day_of_week, start_time, end_time, timezone, is_active"
      )
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (!options?.includeCancelled) {
      fallbackQuery = fallbackQuery.eq("is_active", true);
    }
    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  const scheduleRows = (data as any[] | null) ?? [];
  const scheduleEntries = scheduleRows.map((row) => ({
    row,
    nextOccurrenceDate: getNextOccurrenceDate({
      dayOfWeek: row.day_of_week ?? row.dayOfWeek,
      startTime: row.start_time ?? row.startTime,
      timezone: row.timezone ?? "America/Toronto"
    })
  }));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  let exceptionRows: any[] = [];
  const scheduleIds = scheduleEntries.map((entry) => entry.row.id).filter(Boolean);
  if (scheduleIds.length) {
    const { data: exceptions } = await supabase
      .from("class_schedule_exceptions")
      .select("schedule_id, occurrence_date")
      .in("schedule_id", scheduleIds)
      .gte("occurrence_date", startDate.toISOString().slice(0, 10))
      .lte("occurrence_date", endDate.toISOString().slice(0, 10));
    exceptionRows = (exceptions as any[] | null) ?? [];
  }

  const cancelledKeys = new Set(
    exceptionRows.map((row) => `${row.schedule_id}:${row.occurrence_date}`)
  );

  const mapped =
    scheduleEntries.map(({ row, nextOccurrenceDate }) => {
      const recurringActive = row.is_active ?? row.isActive;
      const cancelledNextOccurrence = nextOccurrenceDate
        ? cancelledKeys.has(`${row.id}:${nextOccurrenceDate}`)
        : false;
      return {
        ...row,
        classType: row.class_type ?? row.classType,
        instructorId: row.instructor_id ?? row.instructorId,
        dayOfWeek: row.day_of_week ?? row.dayOfWeek,
        startTime: row.start_time ?? row.startTime,
        endTime: row.end_time ?? row.endTime,
        timezone: row.timezone ?? "America/Toronto",
        recurringActive,
        nextOccurrenceDate,
        isActive: Boolean(recurringActive) && !cancelledNextOccurrence,
        instructorFirstName:
          (Array.isArray(row.instructors)
            ? row.instructors[0]?.first_name
            : row.instructors?.first_name) ?? null,
        instructorLastName:
          (Array.isArray(row.instructors)
            ? row.instructors[0]?.last_name
            : row.instructors?.last_name) ?? null
      } satisfies ClassScheduleTemplate;
    }) ?? [];

  return options?.includeCancelled ? mapped : mapped.filter((row) => row.isActive);
}

export async function upsertSchedule(entry: Partial<ClassScheduleTemplate>) {
  const supabase = getSupabaseClient();
  const payload = {
    ...entry,
    class_type: entry.classType,
    instructor_id: entry.instructorId,
    day_of_week: entry.dayOfWeek,
    start_time: entry.startTime,
    end_time: entry.endTime,
    is_active: entry.isActive
  };
  const { data, error } = await supabase
    .from("class_schedules")
    .upsert(payload)
    .select();
  if (error) throw error;
  const row = data?.[0];
  return row
    ? ({
        ...row,
        classType: row.class_type ?? row.classType,
        instructorId: row.instructor_id ?? row.instructorId,
        dayOfWeek: row.day_of_week ?? row.dayOfWeek,
        startTime: row.start_time ?? row.startTime,
        endTime: row.end_time ?? row.endTime,
        isActive: row.is_active ?? row.isActive
      } as ClassScheduleTemplate)
    : undefined;
}

export async function cancelClass(id: string, isActive = false) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("class_schedules")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
  return true;
}

function getNextOccurrenceDate(schedule: {
  dayOfWeek: number;
  startTime: string;
  timezone: string;
}) {
  const timezone = schedule.timezone || "America/Toronto";
  const now = new Date();
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.startTime);
  let dayOffset = schedule.dayOfWeek - nowDay;

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
