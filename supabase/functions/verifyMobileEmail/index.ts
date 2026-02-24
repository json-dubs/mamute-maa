import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

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

  const payload = (await req.json()) as { email?: string };
  const email = payload?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return Response.json({ error: "MISSING_EMAIL" }, { status: 400 });
  }

  const students = await resolveStudentsByEmail(supabase, email);
  if (!students.length) {
    return Response.json({ error: "EMAIL_NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    found: true,
    students
  });
});

async function resolveStudentsByEmail(client: any, email: string) {
  const merged = new Map<
    string,
    { id: string; studentNumber: number; firstName: string | null; lastName: string | null }
  >();

  const { data: directRows } = await client
    .from("students")
    .select("id, student_number, first_name, last_name")
    .ilike("email", email);

  for (const row of directRows ?? []) {
    merged.set(row.id, {
      id: row.id,
      studentNumber: row.student_number,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null
    });
  }

  const { data: extraGuardianRows } = await client
    .from("student_guardians")
    .select("students:student_id(id, student_number, first_name, last_name)")
    .ilike("guardian_email", email);

  for (const row of extraGuardianRows ?? []) {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    if (!student) continue;
    merged.set(student.id, {
      id: student.id,
      studentNumber: student.student_number,
      firstName: student.first_name ?? null,
      lastName: student.last_name ?? null
    });
  }

  return [...merged.values()];
}
