import { useState } from "react";
import { Alert, Pressable, TextInput } from "react-native";
import { Card, Screen, Text } from "@mamute/ui";
import { sendAnnouncement } from "@mamute/api";

export default function AnnouncementsScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title || !body) return;
    setSending(true);
    try {
      await sendAnnouncement({ title, body });
      Alert.alert("Sent", "Notification queued for students/parents.");
      setTitle("");
      setBody("");
    } catch (error) {
      Alert.alert("Error", "Could not send announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Announcements">
      <Card style={{ gap: 12 }}>
        <Text>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Schedule change"
          style={inputStyle}
          placeholderTextColor="#64748b"
        />
        <Text>Message</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Tonight's class starts at 7pm."
          style={[inputStyle, { height: 100 }]}
          placeholderTextColor="#64748b"
          multiline
        />
        <Pressable
          onPress={send}
          disabled={sending}
          style={{
            backgroundColor: sending ? "#1f2937" : "#f59e0b",
            padding: 12,
            borderRadius: 10,
            alignItems: "center"
          }}
        >
          <Text style={{ color: "#0b1220", fontWeight: "700" }}>
            {sending ? "Sending..." : "Send Announcement"}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#1f2937"
};
