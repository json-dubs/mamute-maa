import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface MakeMeAdminRequest {
  fullName?: string;
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

  const { count, error: countError } = await supabase
    .from("admins")
    .select("user_id", { count: "exact", head: true });
  if (countError) {
    return Response.json({ error: countError.message }, { status: 400 });
  }

  if ((count ?? 0) > 0) {
    return Response.json({ error: "SETUP_COMPLETE" }, { status: 403 });
  }

  const payload = (await req.json()) as MakeMeAdminRequest;
  const fullName =
    payload.fullName?.trim() ||
    authData.user.user_metadata?.full_name ||
    authData.user.email ||
    "Admin";

  const { error: insertError } = await supabase.from("admins").insert({
    user_id: authData.user.id,
    full_name: fullName,
    email: authData.user.email ?? ""
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 400 });
  }

  return Response.json({ ok: true });
});
