import { getSupabaseClient } from "./client";
import {
  Attendance,
  AttendanceRequest,
  Membership,
  MembershipStatus
} from "@mamute/types";

export interface AttendanceResponse {
  attendance: Attendance;
  membership: Membership | null;
}

export async function recordAttendance(
  payload: AttendanceRequest
): Promise<AttendanceResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("recordAttendance", {
    body: payload
  });

  if (error) throw error;
  const { attendance, membership } = data as any;
  const normalized: Attendance = {
    ...attendance,
    scannedAt: attendance?.scanned_at ?? attendance?.scannedAt,
    profileId: attendance?.profile_id ?? attendance?.profileId,
    classId: attendance?.class_id ?? attendance?.classId
  };
  return { attendance: normalized, membership };
}

export async function fetchRecentAttendance(profileId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("profile_id", profileId)
    .order("scanned_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (
    data?.map((row: any) => ({
      ...row,
      scannedAt: row.scanned_at ?? row.scannedAt,
      profileId: row.profile_id ?? row.profileId,
      classId: row.class_id ?? row.classId
    })) ?? []
  );
}

export async function fetchMembershipStatus(
  profileId: string
): Promise<MembershipStatus> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("status")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as MembershipStatus) ?? "good";
}
