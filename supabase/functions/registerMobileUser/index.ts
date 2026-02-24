import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface RegisterMobileUserRequest {
  email: string;
  studentNumbers: number[];
  accessToken?: string;
}

interface LinkedStudent {
  id: string;
  studentNumber: number;
  firstName: string | null;
  lastName: string | null;
  membershipStanding: "active" | "inactive" | "overdue";
  barcodeValue: string | null;
}

interface ResolvedStudent extends LinkedStudent {
  studentEmailMatch: boolean;
  guardianFirstName: string | null;
  guardianLastName: string | null;
}

export const config = {
  verify_jwt: false
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const payload = (await req.json()) as RegisterMobileUserRequest;

    const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      return new Response("Missing SUPABASE_URL or SERVICE_ROLE_KEY", {
        status: 500
      });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false }
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = payload?.accessToken?.trim() || tokenMatch?.[1]?.trim();
    if (!accessToken) {
      return Response.json({ error: "UNAUTHORIZED", message: "Missing bearer token" }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return Response.json(
        { error: "UNAUTHORIZED", message: authError?.message ?? "Invalid auth session" },
        { status: 401 }
      );
    }

    const email = payload?.email?.trim().toLowerCase() ?? "";
    const studentNumbers = normalizeStudentNumbers(payload?.studentNumbers ?? []);

    if (!email || !studentNumbers.length) {
      return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const resolved = await resolveStudentsByEmail(supabase, email);
    if (!resolved.length) {
      return Response.json({ error: "EMAIL_NOT_FOUND" }, { status: 404 });
    }

    const byNumber = new Map(resolved.map((student) => [student.studentNumber, student]));
    const selected = studentNumbers
      .map((studentNumber) => byNumber.get(studentNumber))
      .filter(Boolean) as ResolvedStudent[];

    if (selected.length !== studentNumbers.length) {
      return Response.json({ error: "STUDENT_MISMATCH" }, { status: 403 });
    }

    const role = selected.length === 1 && selected[0].studentEmailMatch ? "student" : "parent";
    const profileName = resolveProfileName(role, selected);

    const userId = authData.user.id;

    if (typeof (supabase.auth.admin as any).updateUserById === "function") {
      const { error: updateError } = await (supabase.auth.admin as any).updateUserById(
        userId,
        {
          user_metadata: {
            first_name: profileName.firstName,
            last_name: profileName.lastName,
            linked_email: email
          }
        }
      );
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 400 });
      }
    }

    const accessRows = selected.map((student) => ({
      user_id: userId,
      student_id: student.id,
      role
    }));
    const { error: linkError } = await supabase
      .from("student_access")
      .upsert(accessRows, { onConflict: "user_id,student_id" });
    if (linkError) {
      return Response.json({ error: linkError.message }, { status: 400 });
    }

    return Response.json({
      ok: true,
      role,
      linked: selected.map((student) => ({
        studentId: student.id,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        membershipStanding: student.membershipStanding,
        barcodeValue: student.barcodeValue
      }))
    });
  } catch (error: any) {
    const message =
      typeof error?.message === "string" ? error.message : "UNHANDLED_ERROR";
    return Response.json({ error: "UNHANDLED_ERROR", message }, { status: 500 });
  }
});

function normalizeStudentNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

async function resolveStudentsByEmail(client: any, email: string): Promise<ResolvedStudent[]> {
  const merged = new Map<string, ResolvedStudent>();

  const { data: directRows } = await client
    .from("students")
    .select(
      "id, student_number, first_name, last_name, email, membership_standing, barcode_value"
    )
    .ilike("email", email);

  for (const row of directRows ?? []) {
    merged.set(row.id, {
      id: row.id,
      studentNumber: row.student_number,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
      membershipStanding: row.membership_standing,
      barcodeValue: row.barcode_value ?? null,
      studentEmailMatch: (row.email ?? "").toLowerCase() === email,
      guardianFirstName: null,
      guardianLastName: null
    });
  }

  const { data: extraGuardianRows } = await client
    .from("student_guardians")
    .select(
      "guardian_first_name, guardian_last_name, students:student_id(id, student_number, first_name, last_name, email, membership_standing, barcode_value)"
    )
    .ilike("guardian_email", email);

  for (const row of extraGuardianRows ?? []) {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    if (!student) continue;
    const existing = merged.get(student.id);
    merged.set(student.id, {
      id: student.id,
      studentNumber: student.student_number,
      firstName: student.first_name ?? null,
      lastName: student.last_name ?? null,
      membershipStanding: student.membership_standing,
      barcodeValue: student.barcode_value ?? null,
      studentEmailMatch: existing?.studentEmailMatch ?? false,
      guardianFirstName: row.guardian_first_name ?? existing?.guardianFirstName ?? null,
      guardianLastName: row.guardian_last_name ?? existing?.guardianLastName ?? null
    });
  }

  return [...merged.values()];
}

function resolveProfileName(role: "student" | "parent", students: ResolvedStudent[]) {
  if (role === "student") {
    return {
      firstName: students[0].firstName ?? "Student",
      lastName: students[0].lastName ?? "User"
    };
  }

  const withGuardianName = students.find(
    (student) => student.guardianFirstName || student.guardianLastName
  );
  return {
    firstName: withGuardianName?.guardianFirstName ?? "Guardian",
    lastName: withGuardianName?.guardianLastName ?? "User"
  };
}
