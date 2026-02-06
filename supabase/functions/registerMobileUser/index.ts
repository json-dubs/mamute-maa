import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface RegisterMobileUserRequest {
  role: "student" | "guardian";
  fullName: string;
  email: string;
  studentNumbers: number[];
  password: string;
}

interface StudentRow {
  id: string;
  student_number: number;
  full_name: string;
  email: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
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

  const payload = (await req.json()) as RegisterMobileUserRequest;
  if (
    !payload?.role ||
    !payload?.fullName ||
    !payload?.email ||
    !payload?.studentNumbers?.length ||
    !payload?.password
  ) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data: existing, error: existingError } =
    await supabase.auth.admin.getUserByEmail(payload.email);
  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 400 });
  }
  const emailExists = Boolean(existing?.user);
  if (emailExists) {
    return Response.json({ error: "ACCOUNT_EXISTS" }, { status: 409 });
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true
    });
  if (createError || !created.user) {
    return Response.json(
      { error: createError?.message ?? "CREATE_USER_FAILED" },
      { status: 400 }
    );
  }

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, student_number")
    .in("student_number", payload.studentNumbers);
  if (studentError) {
    return Response.json({ error: studentError.message }, { status: 400 });
  }
  if (!students?.length) {
    return Response.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  }

  const role = payload.role === "guardian" ? "parent" : "student";
  const accessRows = students.map((student: any) => ({
    user_id: created.user.id,
    student_id: student.id,
    role
  }));
  const { error: linkError } = await supabase.from("student_access").insert(accessRows);
  if (linkError) {
    return Response.json({ error: linkError.message }, { status: 400 });
  }

  if (payload.role === "guardian") {
    const { error: parentError } = await supabase.from("parents").upsert(
      {
        user_id: created.user.id,
        full_name: payload.fullName,
        first_name: payload.fullName.split(" ").slice(0, -1).join(" "),
        last_name: payload.fullName.split(" ").slice(-1).join(" "),
        email: payload.email
      },
      { onConflict: "user_id" }
    );
    if (parentError) {
      return Response.json({ error: parentError.message }, { status: 400 });
    }
  }

  return Response.json({ ok: true });
});
