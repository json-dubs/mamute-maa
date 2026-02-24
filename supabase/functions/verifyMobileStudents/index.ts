import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface VerifyRequest {
  email: string;
  studentNumbers: number[];
}

interface ResolvedStudent {
  id: string;
  studentNumber: number;
  firstName: string | null;
  lastName: string | null;
  studentEmailMatch: boolean;
  guardianFirstName: string | null;
  guardianLastName: string | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    return new Response("Missing SUPABASE_URL or SERVICE_ROLE_KEY", { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false }
  });

  const payload = (await req.json()) as VerifyRequest;
  const email = payload?.email?.trim().toLowerCase() ?? "";
  const studentNumbers = [...new Set((payload?.studentNumbers ?? []).filter(Number.isFinite))];

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
  const guardianWithName = selected.find(
    (student) => student.guardianFirstName || student.guardianLastName
  );

  return Response.json({
    ok: true,
    role,
    guardianFirstName: guardianWithName?.guardianFirstName ?? null,
    guardianLastName: guardianWithName?.guardianLastName ?? null,
    students: selected.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName
    }))
  });
});

async function resolveStudentsByEmail(client: any, email: string): Promise<ResolvedStudent[]> {
  const merged = new Map<string, ResolvedStudent>();

  const { data: directRows } = await client
    .from("students")
    .select("id, student_number, first_name, last_name, email")
    .ilike("email", email);

  for (const row of directRows ?? []) {
    merged.set(row.id, {
      id: row.id,
      studentNumber: row.student_number,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
      studentEmailMatch: (row.email ?? "").toLowerCase() === email,
      guardianFirstName: null,
      guardianLastName: null
    });
  }

  const { data: extraGuardianRows } = await client
    .from("student_guardians")
    .select(
      "guardian_first_name, guardian_last_name, students:student_id(id, student_number, first_name, last_name, email)"
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
      studentEmailMatch: existing?.studentEmailMatch ?? false,
      guardianFirstName: row.guardian_first_name ?? existing?.guardianFirstName ?? null,
      guardianLastName: row.guardian_last_name ?? existing?.guardianLastName ?? null
    });
  }

  return [...merged.values()];
}
