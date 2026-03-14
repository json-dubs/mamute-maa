import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { getSupabaseClient } from "@mamute/api";
import { useAuth } from "../../lib/auth";
import * as ImagePicker from "expo-image-picker";

type NewsPostRow = {
  id: string;
  title: string;
  description: string;
  post_type: "general" | "birthday" | "badge" | "payment";
  visibility: "public" | "private";
  attachment_path: string | null;
  expires_at: string | null;
  created_at: string;
};

export default function NewsScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "warning" | "success">("error");
  const [posts, setPosts] = useState<NewsPostRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    name: string;
    mimeType: string | null;
    base64: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setMessageTone("error");
    try {
      const { data, error } = await supabase
        .from("mamute_news")
        .select(
          "id, title, description, post_type, visibility, attachment_path, expires_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setPosts((data as NewsPostRow[]) ?? []);
    } catch (error: any) {
      setMessageTone("error");
      setMessage(error?.message ?? "Failed to load news.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    name: "instructor-news",
    tables: ["mamute_news"],
    onRefresh: load
  });

  const submit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setMessageTone("error");
      setMessage("Title and description are required.");
      return;
    }
    if (!session) {
      setMessageTone("error");
      setMessage("You must be signed in.");
      return;
    }

    const expiryIso = expiresAt ? expiresAt.toISOString() : null;

    setSaving(true);
    setMessage(null);
    setMessageTone("error");
    let statusMessage = "Post created.";
    let statusTone: "error" | "warning" | "success" = "success";
    let uploadedAttachmentPath: string | null = null;
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      let attachmentMimeType: string | null = null;

      if (selectedImage) {
        const extension = getImageExtension(selectedImage.name, selectedImage.mimeType);
        const filename = `${createMessageId()}${extension ? `.${extension}` : ""}`;
        const path = `posts/${new Date().toISOString().slice(0, 10)}/${filename}`;
        const uploadBody = base64ToArrayBuffer(selectedImage.base64);
        const { error: uploadError } = await supabase.storage
          .from("mamute-news")
          .upload(path, uploadBody, {
            upsert: false,
            contentType: selectedImage.mimeType ?? undefined
          });
        if (uploadError) throw uploadError;
        uploadedAttachmentPath = path;
        attachmentPath = path;
        attachmentName = selectedImage.name;
        attachmentMimeType = selectedImage.mimeType;
      }

      const { error } = await supabase.from("mamute_news").insert({
        title: trimmedTitle,
        description: trimmedDescription,
        post_type: "general",
        visibility: "public",
        student_id: null,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_mime_type: attachmentMimeType,
        expires_at: expiryIso,
        created_by: session.user.id
      });
      if (error) throw error;

      try {
        const { error: pushError } = await supabase.functions.invoke("sendNotification", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            id: createMessageId(),
            title: trimmedTitle,
            body: truncateNotificationBody(trimmedDescription),
            target: {}
          }
        });
        if (pushError) throw pushError;
      } catch (pushError: any) {
        statusTone = "warning";
        statusMessage = `Post created, but push notification failed: ${getErrorMessage(pushError)}`;
      }

      setTitle("");
      setDescription("");
      setExpiresAt(null);
      setSelectedImage(null);
      await load();
      setMessageTone(statusTone);
      setMessage(statusMessage);
    } catch (error: any) {
      if (uploadedAttachmentPath) {
        await supabase.storage.from("mamute-news").remove([uploadedAttachmentPath]);
      }
      setMessageTone("error");
      setMessage(error?.message ?? "Failed to create news post.");
    } finally {
      setSaving(false);
    }
  };

  const selectImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessageTone("error");
      setMessage("Media permission is required to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: false,
      quality: 0.9,
      base64: true
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setMessageTone("error");
      setMessage("Could not read image data from device.");
      return;
    }
    setSelectedImage({
      uri: asset.uri,
      name: asset.fileName ?? `image-${Date.now()}`,
      mimeType: asset.mimeType ?? null,
      base64: asset.base64
    });
  };

  const askDelete = (post: NewsPostRow) => {
    Alert.alert("Delete post?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void remove(post);
        }
      }
    ]);
  };

  const remove = async (post: NewsPostRow) => {
    setMessage(null);
    setMessageTone("error");
    try {
      if (post.attachment_path) {
        await supabase.storage.from("mamute-news").remove([post.attachment_path]);
      }
      const { error } = await supabase.from("mamute_news").delete().eq("id", post.id);
      if (error) throw error;
      await load();
    } catch (error: any) {
      setMessageTone("error");
      setMessage(error?.message ?? "Failed to delete post.");
    }
  };

  return (
    <Screen>
      <HeroHeader title="Mamute News" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Card>
          <Row>
            <Text style={styles.sectionTitle}>Create Announcement</Text>
            <Pressable onPress={() => void load()}>
              <Text style={styles.refreshText}>{loading ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
          </Row>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Post title"
            placeholderTextColor={uiColors.muted}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Post description"
            placeholderTextColor={uiColors.muted}
          />
          <View style={styles.expirySection}>
            <Text style={styles.expiryLabel}>Expiry (optional)</Text>
            <View style={styles.expiryRow}>
              <Pressable
                style={[styles.secondaryButton, !expiresAt ? styles.expirySelected : null]}
                onPress={() => setExpiresAt(null)}
              >
                <Text style={styles.secondaryButtonText}>No expiry</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setExpiresAt(buildExpiryFromNow(24))}
              >
                <Text style={styles.secondaryButtonText}>+24h</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setExpiresAt(buildExpiryFromNow(48))}
              >
                <Text style={styles.secondaryButtonText}>+48h</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setExpiresAt(buildExpiryFromNow(24 * 7))}
              >
                <Text style={styles.secondaryButtonText}>+7d</Text>
              </Pressable>
            </View>
            {expiresAt ? (
              <>
                <Text style={styles.metaText}>Selected: {expiresAt.toLocaleString()}</Text>
                <View style={styles.expiryRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setExpiresAt(shiftDate(expiresAt, -1))}
                  >
                    <Text style={styles.secondaryButtonText}>-1h</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setExpiresAt(shiftDate(expiresAt, 1))}
                  >
                    <Text style={styles.secondaryButtonText}>+1h</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setExpiresAt(shiftDate(expiresAt, -24))}
                  >
                    <Text style={styles.secondaryButtonText}>-1d</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setExpiresAt(shiftDate(expiresAt, 24))}
                  >
                    <Text style={styles.secondaryButtonText}>+1d</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.metaText}>No expiry selected.</Text>
            )}
          </View>
          <View style={styles.attachmentRow}>
            <Pressable style={styles.secondaryButton} onPress={() => void selectImage()}>
              <Text style={styles.secondaryButtonText}>
                {selectedImage ? "Change Image" : "Attach Image"}
              </Text>
            </Pressable>
            {selectedImage ? (
              <Pressable
                style={[styles.secondaryButton, styles.secondaryDanger]}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.secondaryDangerText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          {selectedImage ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
              <Text style={styles.previewText}>{selectedImage.name}</Text>
            </View>
          ) : null}
          <Pressable style={styles.button} onPress={() => void submit()} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? "Posting..." : "Post News"}</Text>
          </Pressable>
          {message ? (
            <Text
              style={{
                ...styles.message,
                ...(messageTone === "success"
                  ? styles.messageSuccess
                  : messageTone === "warning"
                    ? styles.messageWarning
                    : styles.messageError)
              }}
            >
              {message}
            </Text>
          ) : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Recent Posts</Text>
          {posts.length ? (
            posts.map((post) => (
              <Card key={post.id} style={styles.postCard}>
                <Row>
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Pressable onPress={() => askDelete(post)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </Row>
                <Text style={styles.postDescription}>{post.description}</Text>
                <Text style={styles.metaText}>
                  {new Date(post.created_at).toLocaleString()} | {capitalize(post.visibility)} |{" "}
                  {capitalize(post.post_type)}
                </Text>
                <Text style={styles.metaText}>
                  {post.expires_at
                    ? `Expires ${new Date(post.expires_at).toLocaleString()}`
                    : "No expiry"}
                </Text>
              </Card>
            ))
          ) : (
            <Text style={{ color: uiColors.muted }}>No posts found.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function buildExpiryFromNow(hours: number) {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(next.getHours() + hours);
  return next;
}

function shiftDate(value: Date, hours: number) {
  const next = new Date(value.getTime());
  next.setHours(next.getHours() + hours);
  return next;
}

function truncateNotificationBody(value: string, maxLength = 140) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function createMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function getErrorMessage(error: any) {
  if (typeof error?.message === "string" && error.message) return error.message;
  return "Unknown error";
}

function getImageExtension(filename: string, mimeType: string | null) {
  const trimmedName = filename.trim().toLowerCase();
  const nameParts = trimmedName.split(".");
  if (nameParts.length > 1) {
    const ext = nameParts[nameParts.length - 1];
    if (ext) return ext;
  }
  if (!mimeType) return "";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "";
}

function base64ToArrayBuffer(base64: string) {
  if (!base64) return new ArrayBuffer(0);
  const atobFn = globalThis.atob;
  const binary = atobFn ? atobFn(base64) : decodeBase64Fallback(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function decodeBase64Fallback(input: string) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let str = input.replace(/=+$/, "");
  let output = "";
  if (str.length % 4 === 1) {
    throw new Error("Invalid base64 string.");
  }
  for (
    let bc = 0, bs: number | undefined, buffer: number, idx = 0;
    (buffer = str.charCodeAt(idx++));
  ) {
    const charIndex = chars.indexOf(String.fromCharCode(buffer));
    if (charIndex === -1) continue;
    bs = bc % 4 ? (bs as number) * 64 + charIndex : charIndex;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & ((bs as number) >> ((-2 * bc) & 6)));
    }
  }
  return output;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  refreshText: {
    color: uiColors.accent,
    fontWeight: "700"
  },
  input: {
    backgroundColor: uiColors.surfaceAlt,
    color: uiColors.text,
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 10,
    padding: 12
  },
  multiline: {
    minHeight: 92
  },
  attachmentRow: {
    flexDirection: "row",
    gap: 8
  },
  expirySection: {
    backgroundColor: uiColors.surfaceAlt,
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  expiryLabel: {
    color: uiColors.text,
    fontWeight: "700"
  },
  expiryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  secondaryButton: {
    backgroundColor: uiColors.surfaceAlt,
    borderColor: uiColors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  secondaryButtonText: {
    color: uiColors.text,
    fontWeight: "700"
  },
  expirySelected: {
    borderColor: uiColors.accent
  },
  secondaryDanger: {
    borderColor: "#7f1d1d",
    backgroundColor: "#2b1113"
  },
  secondaryDangerText: {
    color: "#fca5a5",
    fontWeight: "700"
  },
  previewWrap: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt
  },
  previewImage: {
    width: "100%",
    height: 170
  },
  previewText: {
    color: uiColors.muted,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  button: {
    backgroundColor: uiColors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: {
    color: "#0b1220",
    fontWeight: "800"
  },
  message: {
    fontWeight: "600"
  },
  messageError: {
    color: "#fca5a5"
  },
  messageWarning: {
    color: "#fcd34d"
  },
  messageSuccess: {
    color: "#86efac"
  },
  postCard: {
    marginTop: 8,
    backgroundColor: uiColors.surfaceAlt
  },
  postTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12
  },
  postDescription: {
    color: uiColors.text
  },
  metaText: {
    color: uiColors.muted,
    fontSize: 12
  },
  deleteText: {
    color: "#fca5a5",
    fontWeight: "700"
  }
});
