import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { getSupabaseClient } from "@mamute/api";
import { useAuth } from "../../lib/auth";

type AdminProfile = {
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string | null;
};

type AdminRowModern = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string | null;
};

type AdminRowLegacy = {
  full_name: string | null;
  email: string | null;
  created_at: string | null;
};

export default function AccountScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { session, signOut } = useAuth();
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) {
      setAdminProfile(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("first_name, last_name, email, created_at")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
        const isMissingFirstName =
          typeof error.message === "string" &&
          error.message.toLowerCase().includes("admins.first_name");
        if (!isMissingFirstName) throw error;

        const fallback = await supabase
          .from("admins")
          .select("full_name, email, created_at")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        const legacy = (fallback.data as AdminRowLegacy | null) ?? null;
        const parsed = parseLegacyFullName(legacy?.full_name ?? null);
        setAdminProfile({
          firstName:
            parsed.firstName ??
            String(session.user.user_metadata?.first_name ?? session.user.user_metadata?.display_name ?? "")
              .trim(),
          lastName:
            parsed.lastName ??
            String(session.user.user_metadata?.last_name ?? "").trim(),
          email: legacy?.email ?? session.user.email ?? "",
          createdAt: legacy?.created_at ?? null
        });
        return;
      }

      const modern = (data as AdminRowModern | null) ?? null;
      if (!modern) {
        setAdminProfile({
          firstName: String(
            session.user.user_metadata?.first_name ?? session.user.user_metadata?.display_name ?? ""
          ).trim(),
          lastName: String(session.user.user_metadata?.last_name ?? "").trim(),
          email: session.user.email ?? "",
          createdAt: null
        });
        return;
      }

      setAdminProfile({
        firstName:
          (modern.first_name ?? "").trim() ||
          String(session.user.user_metadata?.first_name ?? session.user.user_metadata?.display_name ?? "")
            .trim(),
        lastName:
          (modern.last_name ?? "").trim() ||
          String(session.user.user_metadata?.last_name ?? "").trim(),
        email: modern.email ?? session.user.email ?? "",
        createdAt: modern.created_at ?? null
      });
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to sign out.");
    }
  };

  return (
    <Screen>
      <HeroHeader title="Account" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Card style={styles.accountCard}>
          <Text style={styles.title}>Instructor Admin Session</Text>
          <Text style={styles.subtitle}>
            Login persists when the app closes. You are logged out only from the button below.
          </Text>
          <Text style={styles.meta}>User ID: {session?.user.id ?? "Unknown"}</Text>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.title}>Profile</Text>
          {loading ? <Text style={styles.meta}>Loading profile...</Text> : null}
          {!loading && adminProfile ? (
            <>
              <Text style={styles.meta}>
                Name: {[adminProfile.firstName, adminProfile.lastName].filter(Boolean).join(" ") || "Admin"}
              </Text>
              <Text style={styles.meta}>Email: {adminProfile.email || session?.user.email || "Not available"}</Text>
              {adminProfile.createdAt ? (
                <Text style={styles.meta}>
                  Admin since: {new Date(adminProfile.createdAt).toLocaleDateString()}
                </Text>
              ) : null}
            </>
          ) : null}
          {!loading && !adminProfile ? (
            <Text style={styles.meta}>No admin profile details found.</Text>
          ) : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
          {message ? <Text style={styles.error}>{message}</Text> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    borderColor: "#3f0d14",
    backgroundColor: "#21090d"
  },
  title: {
    fontSize: 18,
    fontWeight: "800"
  },
  subtitle: {
    color: "#fda4af",
    fontWeight: "600"
  },
  meta: {
    color: uiColors.muted
  },
  signOutButton: {
    borderRadius: 10,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    alignItems: "center"
  },
  signOutText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  error: {
    color: "#fca5a5"
  }
});

function parseLegacyFullName(fullName: string | null) {
  if (!fullName) {
    return { firstName: null as string | null, lastName: null as string | null };
  }
  const normalized = fullName.trim();
  if (!normalized) {
    return { firstName: null as string | null, lastName: null as string | null };
  }
  const [first, ...rest] = normalized.split(/\s+/);
  return {
    firstName: first ?? null,
    lastName: rest.length ? rest.join(" ") : null
  };
}
