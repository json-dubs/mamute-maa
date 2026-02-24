import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface LinkRequest {
  studentNumber?: number;
  studentFirstName?: string;
  studentLastName?: string;
  students?: {
    studentNumber: number;
    studentFirstName: string;
    studentLastName: string;
  }[];
  guardianFirstName?: string;
  guardianLastName?: string;
}

interface StudentRow {
  id: string;
  student_number: number;
  first_name: string | null;
  last_name: string | null;
  membership_standing: "active" | "inactive" | "overdue";
  barcode_value: string | null;
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
  const guardianEmail = user.email?.trim().toLowerCase() ?? "";
  if (!guardianEmail) {
    return Response.json({ error: "MISSING_USER_EMAIL" }, { status: 400 });
  }

  const payload = (await req.json()) as LinkRequest;
  const targets = normalizeTargets(payload);
  if (!targets.length) {
    return Response.json({ error: "MISSING_STUDENTS" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const numbers = targets.map((student) => student.studentNumber);
  const { data: students, error: studentError } = await supabase
    .from("students")
    .select(
      "id, student_number, first_name, last_name, membership_standing, barcode_value"
    )
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
    if (
      !match ||
      !namesMatch(
        match.first_name,
        match.last_name,
        target.studentFirstName,
        target.studentLastName
      )
    ) {
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

    const guardianPayload: Record<string, string> = {
      student_id: match.id,
      guardian_email: guardianEmail
    };
    const guardianFirstName = payload.guardianFirstName?.trim();
    const guardianLastName = payload.guardianLastName?.trim();
    if (guardianFirstName) {
      guardianPayload.guardian_first_name = guardianFirstName;
    }
    if (guardianLastName) {
      guardianPayload.guardian_last_name = guardianLastName;
    }
    const { error: guardianError } = await supabase
      .from("student_guardians")
      .upsert(guardianPayload, { onConflict: "student_id,guardian_email" });
    if (guardianError) {
      return Response.json({ error: guardianError.message }, { status: 400 });
    }

    linked.push({
      studentId: match.id,
      studentNumber: match.student_number,
      firstName: match.first_name,
      lastName: match.last_name,
      membershipStanding: match.membership_standing,
      barcodeValue: match.barcode_value
    });
  }

  if (missing.length) {
    return Response.json({ error: "STUDENTS_NOT_FOUND", missing, linked }, { status: 404 });
  }

  return Response.json({ linked });
});

function normalizeTargets(payload: LinkRequest) {
  if (payload.students?.length) return payload.students;
  if (
    !payload.studentNumber ||
    !payload.studentFirstName ||
    !payload.studentLastName
  ) {
    return [];
  }
  return [
    {
      studentNumber: payload.studentNumber,
      studentFirstName: payload.studentFirstName,
      studentLastName: payload.studentLastName
    }
  ];
}

function namesMatch(
  expectedFirst: string | null,
  expectedLast: string | null,
  providedFirst: string,
  providedLast: string
) {
  const normalizedExpected =
    `${expectedFirst ?? ""} ${expectedLast ?? ""}`.trim().toLowerCase();
  const normalizedProvided =
    `${providedFirst ?? ""} ${providedLast ?? ""}`.trim().toLowerCase();
  return normalizedExpected === normalizedProvided;
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
