import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface PushJob {
  id: string;
  title: string;
  body: string;
  target: { profileId?: string; classId?: string; role?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createServiceClient();
  const payload = (await req.json()) as PushJob;

  const tokens = await fetchTokens(supabase, payload.target);
  await fanOutExpo(tokens, payload);

  await supabase
    .from("notifications")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", payload.id);

  return Response.json({ delivered: tokens.length });
});

async function fetchTokens(client: any, target: PushJob["target"]) {
  let query = client.from("push_tokens").select("expo_token");
  if (target.profileId) query = query.eq("profile_id", target.profileId);
  return (await query).data ?? [];
}

async function fanOutExpo(tokens: any[], payload: PushJob) {
  if (!tokens.length) return;
  const chunks = tokens.map((row) => ({
    to: row.expo_token,
    title: payload.title,
    body: payload.body
  }));
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chunks)
  });
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
