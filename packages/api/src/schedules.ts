import { getSupabaseClient } from "./client";
import { ClassScheduleTemplate } from "@mamute/types";

export async function fetchSchedules(): Promise<ClassScheduleTemplate[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return (
    data?.map((row: any) => ({
      ...row,
      classType: row.class_type ?? row.classType,
      instructorId: row.instructor_id ?? row.instructorId,
      dayOfWeek: row.day_of_week ?? row.dayOfWeek,
      startTime: row.start_time ?? row.startTime,
      endTime: row.end_time ?? row.endTime,
      isActive: row.is_active ?? row.isActive
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
