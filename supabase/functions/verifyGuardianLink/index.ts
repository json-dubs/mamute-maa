import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface VerifyGuardianChild {
  lastName: string;
  studentNumber: number;
}

interface VerifyGuardianLinkRequest {
  guardianEmail: string;
  children: VerifyGuardianChild[];
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

  const payload = (await req.json()) as VerifyGuardianLinkRequest;
  if (!payload?.guardianEmail || !payload?.children?.length) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const students: Array<{
    id: string;
    studentNumber: number;
    fullName: string;
  }> = [];
  let guardianName: string | null = null;

  for (const child of payload.children) {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select(
        "id, student_number, first_name, last_name, guardian_first_name, guardian_last_name, guardian_email"
      )
      .eq("student_number", child.studentNumber)
      .maybeSingle();
    if (studentError) {
      return Response.json({ error: studentError.message }, { status: 400 });
    }
    if (!student) {
      return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
    }
    const lastName = student.last_name ?? "";
    if (!matchesLastName(lastName, child.lastName)) {
      return Response.json({ error: "DETAILS_MISMATCH" }, { status: 403 });
    }
    const primaryMatch = emailsMatch(
      student.guardian_email ?? "",
      payload.guardianEmail
    );
    const extraGuardian = await lookupAdditionalGuardian(
      supabase,
      student.id,
      payload.guardianEmail
    );
    if (!primaryMatch && !extraGuardian) {
      return Response.json({ error: "GUARDIAN_EMAIL_MISMATCH" }, { status: 403 });
    }
    guardianName =
      guardianName ??
      (primaryMatch
        ? buildGuardianName(
            student.guardian_first_name,
            student.guardian_last_name
          )
        : buildGuardianName(
            extraGuardian?.guardian_first_name,
            extraGuardian?.guardian_last_name
          ));
    students.push({
      id: student.id,
      studentNumber: student.student_number,
      fullName: [student.first_name, student.last_name].filter(Boolean).join(" ")
    });
  }

  if (!guardianName) {
    return Response.json({ error: "GUARDIAN_NAME_MISSING" }, { status: 400 });
  }

  return Response.json({ guardianName, students });
});

function matchesLastName(fullName: string, lastName: string) {
  return fullName.trim().toLowerCase() === lastName.trim().toLowerCase();
}

function emailsMatch(expected: string, provided: string) {
  return expected.trim().toLowerCase() === provided.trim().toLowerCase();
}

function buildGuardianName(
  firstName?: string | null,
  lastName?: string | null
) {
  if (firstName || lastName) {
    return `${firstName ?? ""} ${lastName ?? ""}`.trim();
  }
  return null;
}

async function lookupAdditionalGuardian(
  client: any,
  studentId: string,
  email: string
) {
  const { data } = await client
    .from("student_guardians")
    .select("guardian_first_name, guardian_last_name")
    .eq("student_id", studentId)
    .eq("guardian_email", email)
    .maybeSingle();
  return data ?? null;
}
