import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface LinkRequest {
  studentNumber?: number;
  studentName?: string;
  students?: { studentNumber: number; studentName: string }[];
  parentName?: string;
}

interface StudentRow {
  id: string;
  student_number: number;
  full_name: string;
  membership_standing: "active" | "inactive" | "overdue";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return new Response("Missing SUPABASE_URL or ANON_KEY", { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = authData.user;
  const payload = (await req.json()) as LinkRequest;
  const targets = normalizeTargets(payload);
  if (!targets.length) {
    return Response.json({ error: "MISSING_STUDENTS" }, { status: 400 });
  }

  const supabase = createServiceClient();
  await upsertParentProfile(supabase, user.id, payload.parentName, user.email);

  const numbers = targets.map((student) => student.studentNumber);
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, student_number, full_name, membership_standing")
    .in("student_number", numbers);
  if (studentError) {
    return Response.json({ error: studentError.message }, { status: 400 });
  }

  const matches = new Map(
    (students ?? []).map((row: StudentRow) => [row.student_number, row])
  );
  const linked = [];
  const missing = [];

  for (const target of targets) {
    const match = matches.get(target.studentNumber);
    if (!match || !namesMatch(match.full_name, target.studentName)) {
      missing.push(target);
      continue;
    }

    const { error: linkError } = await supabase.from("student_access").upsert(
      {
        user_id: user.id,
        student_id: match.id,
        role: "parent"
      },
      { onConflict: "user_id,student_id" }
    );
    if (linkError) {
      return Response.json({ error: linkError.message }, { status: 400 });
    }

    linked.push({
      studentId: match.id,
      studentNumber: match.student_number,
      fullName: match.full_name,
      membershipStanding: match.membership_standing
    });
  }

  if (missing.length) {
    return Response.json({ error: "STUDENTS_NOT_FOUND", missing, linked }, { status: 404 });
  }

  return Response.json({ linked });
});

function normalizeTargets(payload: LinkRequest) {
  if (payload.students?.length) return payload.students;
  if (!payload.studentNumber || !payload.studentName) return [];
  return [{ studentNumber: payload.studentNumber, studentName: payload.studentName }];
}

function namesMatch(expected: string, provided: string) {
  return expected.trim().toLowerCase() === provided.trim().toLowerCase();
}

async function upsertParentProfile(
  client: any,
  userId: string,
  parentName?: string,
  email?: string | null
) {
  const resolvedName = parentName?.trim() || "Parent";
  const resolvedEmail = email ?? "";
  const { error } = await client.from("parents").upsert(
    {
      user_id: userId,
      full_name: resolvedName,
      email: resolvedEmail
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

function createServiceClient() {
  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false } });
}
