import { getSupabaseClient } from "./client";
import { ClassSchedule, Enrollment } from "@mamute/types";

export async function fetchSchedules(): Promise<ClassSchedule[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (
    data?.map((row: any) => ({
      ...row,
      startAt: row.start_at ?? row.startAt,
      endAt: row.end_at ?? row.endAt,
      instructorId: row.instructor_id ?? row.instructorId
    })) ?? []
  );
}

export async function fetchEnrollments(
  profileId: string
): Promise<Enrollment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("profile_id", profileId);

  if (error) throw error;
  return (
    data?.map((row: any) => ({
      ...row,
      profileId: row.profile_id ?? row.profileId,
      classId: row.class_id ?? row.classId
    })) ?? []
  );
}

export async function upsertSchedule(entry: Partial<ClassSchedule>) {
  const supabase = getSupabaseClient();
  const payload = {
    ...entry,
    start_at: entry.startAt,
    end_at: entry.endAt,
    instructor_id: entry.instructorId
  };
  const { data, error } = await supabase.from("classes").upsert(payload).select();
  if (error) throw error;
  const row = data?.[0];
  return row
    ? ({
        ...row,
        startAt: row.start_at ?? row.startAt,
        endAt: row.end_at ?? row.endAt,
        instructorId: row.instructor_id ?? row.instructorId
      } as ClassSchedule)
    : undefined;
}

export async function cancelClass(id: string, status = "cancelled") {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("classes")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  return true;
}
