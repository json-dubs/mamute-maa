import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { Text, uiColors } from "@mamute/ui";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          backgroundColor: uiColors.background
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "700" }}>This screen does not exist.</Text>
        <Link href="/classes" style={{ marginTop: 16 }}>
          <Text style={{ color: uiColors.accent }}>Go to Classes</Text>
        </Link>
      </View>
    </>
  );
}
