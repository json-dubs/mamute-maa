import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Text, uiColors } from "@mamute/ui";
import { useAuth } from "../lib/auth";

export default function IndexScreen() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: uiColors.background,
          justifyContent: "center",
          alignItems: "center",
          gap: 12
        }}
      >
        <ActivityIndicator color={uiColors.accent} />
        <Text>Loading instructor session...</Text>
      </View>
    );
  }

  if (!session || !isAdmin) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/classes" />;
}
