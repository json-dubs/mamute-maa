import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { getSupabaseClient } from "@mamute/api";
import { useAuth } from "../../lib/auth";

type AdminRow = {
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
};

export default function AccountScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { session, signOut } = useAuth();
  const [adminProfile, setAdminProfile] = useState<AdminRow | null>(null);
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
      if (error) throw error;
      setAdminProfile((data as AdminRow | null) ?? null);
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
                Name: {[adminProfile.first_name, adminProfile.last_name].join(" ")}
              </Text>
              <Text style={styles.meta}>Email: {adminProfile.email}</Text>
              <Text style={styles.meta}>
                Admin since: {new Date(adminProfile.created_at).toLocaleDateString()}
              </Text>
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
