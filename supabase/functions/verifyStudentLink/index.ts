import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface VerifyStudentLinkRequest {
  lastName: string;
  studentNumber: number;
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

  const payload = (await req.json()) as VerifyStudentLinkRequest;
  if (!payload?.lastName || !payload?.studentNumber) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, student_number, first_name, last_name, email")
    .eq("student_number", payload.studentNumber)
    .maybeSingle();
  if (studentError) {
    return Response.json({ error: studentError.message }, { status: 400 });
  }
  if (!student) {
    return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  }

  const lastName = student.last_name ?? "";
  if (!matchesLastName(lastName, payload.lastName)) {
    return Response.json({ error: "DETAILS_MISMATCH" }, { status: 403 });
  }

  return Response.json({
    student: {
      id: student.id,
      studentNumber: student.student_number,
      firstName: student.first_name ?? null,
      lastName: student.last_name ?? null,
      email: student.email ?? null
    }
  });
});

function matchesLastName(value: string, lastName: string) {
  return value.trim().toLowerCase() === lastName.trim().toLowerCase();
}
