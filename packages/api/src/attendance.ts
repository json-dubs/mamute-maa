import { getSupabaseClient } from "./client";
import { AttendanceRecord, CheckInRequest, CheckInResponse } from "@mamute/types";

export async function recordAttendance(
  payload: CheckInRequest
): Promise<CheckInResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("recordAttendance", {
    body: payload
  });

  if (error) throw error;
  const response = data as CheckInResponse;
  return normalizeCheckInResponse(response);
}

function normalizeCheckInResponse(response: CheckInResponse): CheckInResponse {
  return {
    ...response,
    schedule: normalizeSchedule(response.schedule),
    results: response.results.map((result) => ({
      ...result,
      attendance: result.attendance ? normalizeAttendance(result.attendance) : null
    }))
  };
}

function normalizeSchedule(schedule: CheckInResponse["schedule"]) {
  return {
    ...schedule,
    classType: (schedule as any).class_type ?? schedule.classType,
    instructorId: (schedule as any).instructor_id ?? schedule.instructorId,
    dayOfWeek: (schedule as any).day_of_week ?? schedule.dayOfWeek,
    startTime: (schedule as any).start_time ?? schedule.startTime,
    endTime: (schedule as any).end_time ?? schedule.endTime
  };
}

function normalizeAttendance(attendance: AttendanceRecord): AttendanceRecord {
  return {
    ...attendance,
    studentId: (attendance as any).student_id ?? attendance.studentId,
    scheduleId: (attendance as any).schedule_id ?? attendance.scheduleId,
    sessionStartAt: (attendance as any).session_start_at ?? attendance.sessionStartAt,
    sessionEndAt: (attendance as any).session_end_at ?? attendance.sessionEndAt,
    scannedAt: (attendance as any).scanned_at ?? attendance.scannedAt,
    deviceId: (attendance as any).device_id ?? attendance.deviceId,
    locationVerified:
      (attendance as any).location_verified ?? attendance.locationVerified
  };
}
