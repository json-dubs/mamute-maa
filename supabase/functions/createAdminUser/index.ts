import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface CreateAdminRequest {
  email: string;
  fullName: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    return new Response("Missing SUPABASE_URL or keys", { status: 500 });
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

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false }
  });

  const { data: isAdmin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!isAdmin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const payload = (await req.json()) as CreateAdminRequest;
  if (!payload?.email || !payload?.fullName) {
    return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.inviteUserByEmail(payload.email, {
      data: { full_name: payload.fullName }
    });

  if (createError || !created.user) {
    return Response.json(
      { error: createError?.message ?? "CREATE_ADMIN_FAILED" },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase.from("admins").insert({
    user_id: created.user.id,
    full_name: payload.fullName,
    email: payload.email
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 400 });
  }

  return Response.json({ id: created.user.id, email: payload.email });
});
