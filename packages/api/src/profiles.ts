import { getSupabaseClient } from "./client";
import { Membership, Profile } from "@mamute/types";

export async function fetchProfile(): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function fetchMembership(
  profileId: string
): Promise<Membership | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return (data as Membership | null) ?? null;
}
