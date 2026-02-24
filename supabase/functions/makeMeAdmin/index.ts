import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface MakeMeAdminRequest {
  firstName?: string;
  lastName?: string;
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
  const fallback = splitName(
    (authData.user.user_metadata?.first_name as string | undefined) ??
      authData.user.email ??
      "Admin"
  );
  const firstName = payload.firstName?.trim() || fallback.firstName || "Admin";
  const lastName = payload.lastName?.trim() || fallback.lastName || "User";

  const { error: insertError } = await supabase.from("admins").insert({
    user_id: authData.user.id,
    first_name: firstName,
    last_name: lastName,
    email: authData.user.email ?? ""
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 400 });
  }

  return Response.json({ ok: true });
});

function splitName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" ")
  };
}
