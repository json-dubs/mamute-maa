import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Card, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../components/HeroHeader";
import { getSupabaseClient } from "@mamute/api";

export default function ResetPasswordScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const params = useLocalSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const accessToken = String(params.access_token ?? "");
    const refreshToken = String(params.refresh_token ?? "");
    if (!accessToken || !refreshToken) {
      return;
    }
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .catch(() => {
        setMessage("Reset link is invalid or expired. Please request a new one.");
      });
  }, [params.access_token, params.refresh_token, supabase]);

  const submit = async () => {
    if (!password || password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert("Password updated", "You can now sign in.");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage(error?.message ?? "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <HeroHeader title="Reset Password" />
      <Card>
        <Text>Enter a new password to finish resetting your account.</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          placeholderTextColor={uiColors.muted}
          secureTextEntry
          style={inputStyle}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor={uiColors.muted}
          secureTextEntry
          style={inputStyle}
        />
        <Pressable onPress={submit} style={buttonStyle} disabled={loading}>
          <Text style={buttonTextStyle}>
            {loading ? "Updating..." : "Update password"}
          </Text>
        </Pressable>
        {message ? <Text style={{ color: "#fca5a5" }}>{message}</Text> : null}
      </Card>
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: uiColors.surfaceAlt,
  color: uiColors.text,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: uiColors.border,
  marginTop: 10
};

const buttonStyle = {
  backgroundColor: uiColors.accent,
  padding: 12,
  borderRadius: 10,
  alignItems: "center",
  marginTop: 12
};

const buttonTextStyle = {
  color: "#0b1220",
  fontWeight: "700"
};
