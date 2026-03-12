import { getSupabaseClient } from "./client";
import { AttendanceRecord, CheckInRequest, CheckInResponse } from "@mamute/types";

export async function recordAttendance(
  payload: CheckInRequest
): Promise<CheckInResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("recordAttendance", {
    body: payload
  });

  if (error) {
    throw await buildAttendanceError(error);
  }
  const response = data as CheckInResponse;
  return normalizeCheckInResponse(response);
}

async function buildAttendanceError(error: unknown) {
  if (!error || typeof error !== "object") {
    return new Error("Check-in failed.");
  }

  const response = "context" in error ? (error as { context?: unknown }).context : null;
  if (response instanceof Response) {
    try {
      const raw = await response.clone().text();
      if (!raw) {
        return new Error(`${response.status} ${response.statusText}`.trim());
      }

      try {
        const parsed = JSON.parse(raw) as {
          error?: string;
          message?: string;
          reason?: string;
          eligibleScheduleIds?: string[];
        };

        const code = parsed.error ?? parsed.reason ?? parsed.message;
        if (!code) {
          return new Error(raw);
        }

        if (code === "UNAUTHORIZED") {
          return new Error("Session expired. Re-link your account and try again.");
        }
        if (code === "ACCESS_DENIED") {
          return new Error(
            "Access denied for one or more selected students. Confirm they are linked to this device."
          );
        }
        if (code === "SCHEDULE_NOT_ELIGIBLE") {
          return new Error("Selected class is no longer eligible for check-in.");
        }
        if (code === "NO_CLASS_AVAILABLE") {
          return new Error("No class is currently eligible for mobile check-in.");
        }
        if (code === "LOCATION_REQUIRED") {
          return new Error("Location verification is required for mobile check-in.");
        }
        if (code === "MISSING_STUDENT_NUMBERS") {
          return new Error("No valid student numbers were provided for check-in.");
        }
        if (code === "STUDENTS_NOT_FOUND") {
          return new Error("One or more selected student numbers were not found.");
        }

        return new Error(code);
      } catch {
        return new Error(raw);
      }
    } catch {
      return new Error(
        "Check-in failed and the error response could not be parsed."
      );
    }
  }

  if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
    return new Error((error as { message: string }).message);
  }

  return new Error("Check-in failed.");
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
