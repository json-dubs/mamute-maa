import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useAuth } from "../../lib/auth";

export default function LoginScreen() {
  const { session, isAdmin, loading, authError, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  if (!loading && session && isAdmin) {
    return <Redirect href="/classes" />;
  }

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setFormMessage("Enter your admin email and password.");
      return;
    }
    setSubmitting(true);
    setFormMessage(null);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      setFormMessage(error?.message ?? "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <HeroHeader title="Instructor Login" />
      <Card>
        <Text style={{ fontSize: 20, fontWeight: "800" }}>Admin Account Sign-in</Text>
        <Text style={{ color: uiColors.muted }}>
          Use your admin account credentials. Session remains active until you sign out in Account.
        </Text>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder="admin@mamutemaa.com"
          placeholderTextColor={uiColors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={inputStyle}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={uiColors.muted}
          secureTextEntry
        />
        <Pressable style={buttonStyle} onPress={submit} disabled={submitting || loading}>
          {submitting || loading ? (
            <ActivityIndicator color="#0b1220" />
          ) : (
            <Text style={{ color: "#0b1220", fontWeight: "800" }}>Sign In</Text>
          )}
        </Pressable>
        {formMessage ? <Text style={{ color: "#fca5a5" }}>{formMessage}</Text> : null}
        {authError ? <Text style={{ color: "#fca5a5" }}>{authError}</Text> : null}
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
  borderColor: uiColors.border
};

const buttonStyle = {
  backgroundColor: uiColors.accent,
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center" as const
};
