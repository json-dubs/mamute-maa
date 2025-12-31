import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

interface AttendanceRequest {
  barcode: string;
  deviceId?: string;
  source: "mobile" | "web";
}

const BARCODE_PREFIX = "MMAA-";

async function getProfileFromBarcode(client: any, barcode: string) {
  const normalized = barcode.startsWith(BARCODE_PREFIX)
    ? barcode.slice(BARCODE_PREFIX.length)
    : barcode;
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createServiceClient();
  const payload = (await req.json()) as AttendanceRequest;
  const profile = await getProfileFromBarcode(supabase, payload.barcode);
  if (!profile) {
    return Response.json({ error: "PROFILE_NOT_FOUND" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const isBlocked = membership?.status === "suspended";
  const { data: attendance, error } = await supabase
    .from("attendance")
    .insert({
      profile_id: profile.id,
      class_id: null,
      device_id: payload.deviceId,
      source: payload.source
    })
    .select()
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({
    attendance,
    membership,
    blocked: isBlocked
  });
});

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false } });
}
