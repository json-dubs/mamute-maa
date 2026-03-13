import { getSupabaseClient } from "./client";
import { NotificationPayload, PushToken } from "@mamute/types";

export async function registerPushToken(token: PushToken) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("push_tokens").upsert(
    {
      profile_id: token.profileId,
      expo_token: token.token,
      platform: token.platform,
      app_variant: token.appVariant ?? null,
      updated_at: token.updatedAt
    },
    { onConflict: "expo_token" }
  );
  if (error) throw error;
  return true;
}

export async function fetchNotifications(profileId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("target->>profileId", profileId)
    .order("scheduled_at", { ascending: false })
    .limit(25);

  if (error) throw error;
  return data as NotificationPayload[];
}

export async function sendAnnouncement(payload: {
  title: string;
  body: string;
  target?: { profileId?: string; studentId?: string; classId?: string; role?: string };
}) {
  const supabase = getSupabaseClient();
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `notif-${Date.now()}`;
  const { data, error } = await supabase.functions.invoke("sendNotification", {
    body: {
      id,
      title: payload.title,
      body: payload.body,
      target: payload.target ?? { role: "student" }
    }
  });
  if (error) throw error;
  return data;
}
