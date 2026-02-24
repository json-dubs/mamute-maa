import { getSupabaseClient } from "./client";
import { getSupabaseConfig } from "@mamute/config";
import {
  LinkStudentAccessRequest,
  LinkStudentAccessResponse,
  LinkedStudentSummary,
  RegisterMobileUserRequest,
  RegisterMobileUserResponse,
  VerifyMobileEmailRequest,
  VerifyMobileEmailResponse,
  VerifyMobileStudentNumbersRequest,
  VerifyMobileStudentNumbersResponse,
  VerifyGuardianLinkRequest,
  VerifyGuardianLinkResponse,
  VerifyStudentLinkRequest,
  VerifyStudentLinkResponse
} from "@mamute/types";

function resolveFunctionError(error: any, fallback: string): Error {
  const status = error?.context?.status;
  const body = error?.context?.body;
  let bodyMessage: string | undefined;

  if (body && typeof body === "object") {
    bodyMessage =
      (typeof body.error === "string" && body.error) ||
      (typeof body.message === "string" && body.message) ||
      undefined;
  } else if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      bodyMessage =
        (typeof parsed?.error === "string" && parsed.error) ||
        (typeof parsed?.message === "string" && parsed.message) ||
        undefined;
    } catch {
      bodyMessage = body;
    }
  }

  const rawMessage =
    typeof error?.message === "string" ? error.message : undefined;
  const isGeneric = rawMessage === "Edge Function returned a non-2xx status code";
  const message = bodyMessage || (!isGeneric ? rawMessage : undefined) || fallback;
  return new Error(status ? `${message} (status ${status})` : message);
}

function getFunctionGatewayHeaders() {
  const { anonKey } = getSupabaseConfig();
  if (!anonKey) return undefined;
  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey
  };
}

export async function linkStudentAccess(
  payload: LinkStudentAccessRequest
): Promise<LinkStudentAccessResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("linkStudentAccess", {
    body: payload
  });

  if (error) throw resolveFunctionError(error, "Failed to link student access.");
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
  payload: RegisterMobileUserRequest,
  accessToken?: string
): Promise<RegisterMobileUserResponse> {
  const supabase = getSupabaseClient();
  const token =
    accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
  const gatewayHeaders = getFunctionGatewayHeaders();
  const { data, error } = await supabase.functions.invoke("registerMobileUser", {
    body: {
      ...payload,
      ...(token ? { accessToken: token } : {})
    },
    ...(gatewayHeaders
      ? {
          headers: gatewayHeaders
        }
      : {})
  });

  if (error) throw resolveFunctionError(error, "Failed to link mobile app.");
  return data as RegisterMobileUserResponse;
}

export async function verifyMobileEmail(
  payload: VerifyMobileEmailRequest
): Promise<VerifyMobileEmailResponse> {
  const supabase = getSupabaseClient();
  const gatewayHeaders = getFunctionGatewayHeaders();
  const { data, error } = await supabase.functions.invoke("verifyMobileEmail", {
    body: payload,
    ...(gatewayHeaders
      ? {
          headers: gatewayHeaders
        }
      : {})
  });
  if (error) throw resolveFunctionError(error, "Failed to verify mobile email.");
  return data as VerifyMobileEmailResponse;
}

export async function verifyMobileStudentNumbers(
  payload: VerifyMobileStudentNumbersRequest
): Promise<VerifyMobileStudentNumbersResponse> {
  const supabase = getSupabaseClient();
  const gatewayHeaders = getFunctionGatewayHeaders();
  const { data, error } = await supabase.functions.invoke("verifyMobileStudents", {
    body: payload,
    ...(gatewayHeaders
      ? {
          headers: gatewayHeaders
        }
      : {})
  });
  if (error) throw resolveFunctionError(error, "Failed to verify student numbers.");
  return data as VerifyMobileStudentNumbersResponse;
}

export async function verifyStudentLink(
  payload: VerifyStudentLinkRequest
): Promise<VerifyStudentLinkResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("verifyStudentLink", {
    body: payload
  });
  if (error) throw resolveFunctionError(error, "Failed to verify student link.");
  return data as VerifyStudentLinkResponse;
}

export async function verifyGuardianLink(
  payload: VerifyGuardianLinkRequest
): Promise<VerifyGuardianLinkResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("verifyGuardianLink", {
    body: payload
  });
  if (error) throw resolveFunctionError(error, "Failed to verify guardian link.");
  return data as VerifyGuardianLinkResponse;
}
