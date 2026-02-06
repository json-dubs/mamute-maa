import { getSupabaseClient } from "./client";
import {
  LinkStudentAccessRequest,
  LinkStudentAccessResponse,
  LinkedStudentSummary,
  RegisterMobileUserRequest,
  RegisterMobileUserResponse,
  VerifyGuardianLinkRequest,
  VerifyGuardianLinkResponse,
  VerifyStudentLinkRequest,
  VerifyStudentLinkResponse
} from "@mamute/types";

export async function linkStudentAccess(
  payload: LinkStudentAccessRequest
): Promise<LinkStudentAccessResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("linkStudentAccess", {
    body: payload
  });

  if (error) throw error;
  return data as LinkStudentAccessResponse;
}

export async function fetchLinkedStudents(): Promise<LinkedStudentSummary[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("student_access")
    .select("student_id, role, students:student_id(id, student_number, first_name, last_name, membership_standing, barcode_value)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (
    data?.map((row: any) => ({
      studentId: row.students?.id ?? row.student_id,
      studentNumber: row.students?.student_number,
      firstName: row.students?.first_name,
      lastName: row.students?.last_name,
      membershipStanding: row.students?.membership_standing,
      barcodeValue: row.students?.barcode_value ?? null
    })) ?? []
  );
}

export async function registerMobileUser(
  payload: RegisterMobileUserRequest
): Promise<RegisterMobileUserResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("registerMobileUser", {
    body: payload
  });

  if (error) throw error;
  return data as RegisterMobileUserResponse;
}

export async function verifyStudentLink(
  payload: VerifyStudentLinkRequest
): Promise<VerifyStudentLinkResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("verifyStudentLink", {
    body: payload
  });
  if (error) throw error;
  return data as VerifyStudentLinkResponse;
}

export async function verifyGuardianLink(
  payload: VerifyGuardianLinkRequest
): Promise<VerifyGuardianLinkResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("verifyGuardianLink", {
    body: payload
  });
  if (error) throw error;
  return data as VerifyGuardianLinkResponse;
}
