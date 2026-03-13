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
  StudentBadgeSummary,
  VerifyGuardianLinkRequest,
  VerifyGuardianLinkResponse,
  VerifyStudentLinkRequest,
  VerifyStudentLinkResponse
} from "@mamute/types";

const BADGES_BUCKET = "mamute-badges";
type StudentGuardianRow = {
  guardian_first_name?: string | null;
  guardian_last_name?: string | null;
};

type BadgeDetailRow = {
  id?: string;
  title?: string;
  description?: string | null;
  image_path?: string | null;
  image_name?: string | null;
  image_mime_type?: string | null;
  milestone_count?: number | null;
  created_at?: string;
};

type StudentBadgeRow = {
  id: string;
  visibility?: string | null;
  assigned_source?: string | null;
  assigned_at?: string | null;
  badges?: BadgeDetailRow | null;
};

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
  let data: any[] | null = null;
  let error: any = null;

  const primary = await supabase
    .from("student_access")
    .select(
      "student_id, role, students:student_id(id, student_number, first_name, last_name, membership_type, membership_standing, barcode_value, student_guardians(guardian_first_name, guardian_last_name), student_badges(id, visibility, assigned_source, assigned_at, badges:badge_id(id, title, description, image_path, image_name, image_mime_type, milestone_count, created_at)))"
    )
    .order("created_at", { ascending: true });
  data = (primary.data as any[] | null) ?? null;
  error = primary.error;

  if (error) {
    const fallback = await supabase
      .from("student_access")
      .select(
        "student_id, role, students:student_id(id, student_number, first_name, last_name, membership_type, membership_standing, barcode_value)"
      )
      .order("created_at", { ascending: true });
    data = (fallback.data as any[] | null) ?? null;
    error = fallback.error;
  }

  if (error) throw error;
  return (
    data?.map((row: any) => {
      const guardians = Array.isArray(row.students?.student_guardians)
        ? (row.students.student_guardians as StudentGuardianRow[])
        : [];
      const guardianNames = [
        ...new Set(
          guardians
            .map((guardian) =>
              [guardian.guardian_first_name, guardian.guardian_last_name]
                .filter(Boolean)
                .join(" ")
                .trim()
            )
            .filter((name): name is string => Boolean(name))
        )
      ];
      const badgeRows = Array.isArray(row.students?.student_badges)
        ? (row.students.student_badges as StudentBadgeRow[])
        : [];
      const badges = badgeRows
        .map((badgeRow): StudentBadgeSummary | null => {
          const badge = badgeRow.badges ?? null;
          if (!badge?.id) return null;
          const imagePath = badge.image_path ?? null;
          const imageUrl = imagePath
            ? supabase.storage.from(BADGES_BUCKET).getPublicUrl(imagePath).data.publicUrl
            : null;
          return {
            id: badgeRow.id,
            badgeId: badge.id,
            title: badge.title ?? "Badge",
            description: badge.description ?? null,
            milestoneCount:
              typeof badge.milestone_count === "number" ? badge.milestone_count : null,
            imagePath,
            imageName: badge.image_name ?? null,
            imageMimeType: badge.image_mime_type ?? null,
            imageUrl,
            visibility:
              badgeRow.visibility === "private" ? "private" : "public",
            assignedSource:
              badgeRow.assigned_source === "auto" ? "auto" : "manual",
            assignedAt: badgeRow.assigned_at ?? badge.created_at ?? new Date(0).toISOString()
          };
        })
        .filter((badge): badge is StudentBadgeSummary => badge !== null)
        .sort(
          (a: StudentBadgeSummary, b: StudentBadgeSummary) =>
            new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
        );
      return {
        studentId: row.students?.id ?? row.student_id,
        studentNumber: row.students?.student_number,
        firstName: row.students?.first_name,
        lastName: row.students?.last_name,
        guardianNames,
        badges,
        membershipType: row.students?.membership_type,
        membershipStanding: row.students?.membership_standing,
        barcodeValue: row.students?.barcode_value ?? null
      };
    }) ?? []
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
