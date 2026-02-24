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
  return (
    data?.map((row: any) => ({
      ...row,
      classType: row.class_type ?? row.classType,
      instructorId: row.instructor_id ?? row.instructorId,
      dayOfWeek: row.day_of_week ?? row.dayOfWeek,
      startTime: row.start_time ?? row.startTime,
      endTime: row.end_time ?? row.endTime,
      isActive: row.is_active ?? row.isActive,
      instructorFirstName:
        (Array.isArray(row.instructors) ? row.instructors[0]?.first_name : row.instructors?.first_name) ??
        null,
      instructorLastName:
        (Array.isArray(row.instructors) ? row.instructors[0]?.last_name : row.instructors?.last_name) ??
        null
    })) ?? []
  );
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
