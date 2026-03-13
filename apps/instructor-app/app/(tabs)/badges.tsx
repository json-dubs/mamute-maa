import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Card, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";
import { getSupabaseClient } from "@mamute/api";
import { useAuth } from "../../lib/auth";

type BadgeRow = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  milestone_count: number | null;
  created_at: string;
};

type StudentRow = {
  id: string;
  student_number: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export default function BadgesScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [badgeTitle, setBadgeTitle] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [selectedBadgeImage, setSelectedBadgeImage] = useState<{
    uri: string;
    name: string;
    mimeType: string | null;
    base64: string;
  } | null>(null);

  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [badgeRes, studentRes] = await Promise.all([
        supabase
          .from("badges")
          .select(
            "id, title, description, image_path, image_name, image_mime_type, milestone_count, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("students")
          .select("id, student_number, first_name, last_name, email")
          .order("student_number", { ascending: true })
      ]);
      if (badgeRes.error) throw badgeRes.error;
      if (studentRes.error) throw studentRes.error;
      setBadges((badgeRes.data as BadgeRow[]) ?? []);
      setStudents((studentRes.data as StudentRow[]) ?? []);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to load badges.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    name: "instructor-badges",
    tables: ["badges", "student_badges", "students", "mamute_news"],
    onRefresh: load
  });

  const filteredStudents = students.filter((student) =>
    matchesStudentQuery(student, studentQuery)
  );

  const selectedStudents = selectedStudentIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is StudentRow => Boolean(student));

  const createBadge = async () => {
    if (!session) {
      setMessage("You must be signed in.");
      return;
    }
    const title = badgeTitle.trim();
    if (!title) {
      setMessage("Badge title is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    let uploadedPath: string | null = null;
    try {
      let imagePath: string | null = null;
      let imageName: string | null = null;
      let imageMimeType: string | null = null;

      if (selectedBadgeImage) {
        const extension = getImageExtension(
          selectedBadgeImage.name,
          selectedBadgeImage.mimeType
        );
        const filename = `${createMessageId()}${extension ? `.${extension}` : ""}`;
        const path = `catalog/${new Date().toISOString().slice(0, 10)}/${filename}`;
        const uploadBody = base64ToArrayBuffer(selectedBadgeImage.base64);
        const { error: uploadError } = await supabase.storage
          .from("mamute-badges")
          .upload(path, uploadBody, {
            upsert: false,
            contentType: selectedBadgeImage.mimeType ?? undefined
          });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        imagePath = path;
        imageName = selectedBadgeImage.name;
        imageMimeType = selectedBadgeImage.mimeType;
      }

      const { error } = await supabase.from("badges").insert({
        title,
        description: badgeDescription.trim() || null,
        image_path: imagePath,
        image_name: imageName,
        image_mime_type: imageMimeType,
        created_by: session.user.id
      });
      if (error) throw error;
      setBadgeTitle("");
      setBadgeDescription("");
      setSelectedBadgeImage(null);
      await load();
      setMessage("Badge created.");
    } catch (error: any) {
      if (uploadedPath) {
        await supabase.storage.from("mamute-badges").remove([uploadedPath]);
      }
      setMessage(error?.message ?? "Failed to create badge.");
    } finally {
      setSaving(false);
    }
  };

  const selectBadgeImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Media permission is required to attach badge images.");
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
      setMessage("Could not read image data from device.");
      return;
    }
    setSelectedBadgeImage({
      uri: asset.uri,
      name: asset.fileName ?? `badge-${Date.now()}`,
      mimeType: asset.mimeType ?? null,
      base64: asset.base64
    });
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const assignBadge = async () => {
    if (!session) {
      setMessage("You must be signed in.");
      return;
    }
    if (!selectedBadgeId) {
      setMessage("Select a badge.");
      return;
    }
    if (!selectedStudentIds.length) {
      setMessage("Select at least one student.");
      return;
    }
    const badge = badges.find((item) => item.id === selectedBadgeId);
    if (!badge) {
      setMessage("Selected badge not found.");
      return;
    }

    setAssigning(true);
    setMessage(null);
    let pushIssue: string | null = null;
    try {
      const { data: existingRows, error: existingError } = await supabase
        .from("student_badges")
        .select("student_id")
        .eq("badge_id", selectedBadgeId)
        .in("student_id", selectedStudentIds);
      if (existingError) throw existingError;

      const existingIds = new Set(
        ((existingRows as { student_id: string }[] | null) ?? []).map((row) => row.student_id)
      );
      const targetIds = selectedStudentIds.filter((id) => !existingIds.has(id));
      if (!targetIds.length) {
        setMessage("Selected students already have this badge.");
        return;
      }

      const { error: assignError } = await supabase.from("student_badges").insert(
        targetIds.map((studentId) => ({
          student_id: studentId,
          badge_id: selectedBadgeId,
          visibility,
          assigned_source: "manual",
          assigned_by: session.user.id
        }))
      );
      if (assignError) throw assignError;

      const expiryIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const studentsForAssignment = students.filter((student) => targetIds.includes(student.id));

      if (visibility === "public") {
        const names = studentsForAssignment.map((student) => formatStudentName(student)).join(", ");
        const { error: newsError } = await supabase.from("mamute_news").insert({
          title: `Badge Award: ${badge.title}`,
          description: `Congratulations to ${names} for earning the ${badge.title} badge.`,
          post_type: "badge",
          visibility: "public",
          student_id: null,
          attachment_path: badge.image_path,
          attachment_name: badge.image_name,
          attachment_mime_type: badge.image_mime_type,
          expires_at: expiryIso,
          created_by: session.user.id
        });
        if (newsError) throw newsError;

        try {
          const { error: pushError } = await supabase.functions.invoke("sendNotification", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: {
              id: createMessageId(),
              title: `Badge Award: ${badge.title}`,
              body: truncateNotificationBody(
                `Congratulations to ${names} for earning the ${badge.title} badge.`
              ),
              target: {}
            }
          });
          if (pushError) throw pushError;
        } catch (pushError: any) {
          pushIssue = pushError?.message ?? "unknown error";
        }
      } else {
        const privateRows = studentsForAssignment.map((student) => ({
          title: `Badge Award: ${badge.title}`,
          description: `${formatStudentName(student)} has earned the ${badge.title} badge.`,
          post_type: "badge",
          visibility: "private",
          student_id: student.id,
          attachment_path: badge.image_path,
          attachment_name: badge.image_name,
          attachment_mime_type: badge.image_mime_type,
          expires_at: expiryIso,
          created_by: session.user.id
        }));
        if (privateRows.length) {
          const { error: privateError } = await supabase.from("mamute_news").insert(privateRows);
          if (privateError) throw privateError;
        }

        try {
          const { data: accessRows, error: accessError } = await supabase
            .from("student_access")
            .select("user_id, student_id")
            .in("student_id", targetIds);
          if (accessError) throw accessError;

          const studentById = new Map(studentsForAssignment.map((student) => [student.id, student]));
          const uniqueUserIds = [
            ...new Set(
              ((accessRows as { user_id: string; student_id: string }[] | null) ?? []).map(
                (row) => row.user_id
              )
            )
          ];

          for (const userId of uniqueUserIds) {
            const studentIdsForUser = (
              (accessRows as { user_id: string; student_id: string }[] | null) ?? []
            )
              .filter((row) => row.user_id === userId)
              .map((row) => row.student_id);
            const names = studentIdsForUser
              .map((studentId) => studentById.get(studentId))
              .filter(Boolean)
              .map((student) => formatStudentName(student as StudentRow));
            const namesLabel = names.length ? names.join(", ") : "your student";
            const { error: pushError } = await supabase.functions.invoke("sendNotification", {
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: {
                id: createMessageId(),
                title: `Badge Award: ${badge.title}`,
                body: truncateNotificationBody(`${namesLabel} earned the ${badge.title} badge.`),
                target: { profileId: userId }
              }
            });
            if (pushError) throw pushError;
          }
        } catch (pushError: any) {
          pushIssue = pushError?.message ?? "unknown error";
        }
      }

      setSelectedStudentIds([]);
      await load();
      const assignmentMessage = `Assigned ${badge.title} to ${targetIds.length} student${targetIds.length === 1 ? "" : "s"}.`;
      setMessage(pushIssue ? `${assignmentMessage} Push failed: ${pushIssue}` : assignmentMessage);
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to assign badge.");
    } finally {
      setAssigning(false);
    }
  };

  const askDeleteBadge = (badge: BadgeRow) => {
    if (badge.milestone_count !== null) {
      setMessage("Automatic milestone badges are managed by the system.");
      return;
    }
    Alert.alert("Delete badge?", `Delete "${badge.title}" and related assignments?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteBadge(badge);
        }
      }
    ]);
  };

  const deleteBadge = async (badge: BadgeRow) => {
    try {
      if (badge.image_path) {
        await supabase.storage.from("mamute-badges").remove([badge.image_path]);
      }
      const { error } = await supabase.from("badges").delete().eq("id", badge.id);
      if (error) throw error;
      if (selectedBadgeId === badge.id) setSelectedBadgeId("");
      await load();
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to delete badge.");
    }
  };

  return (
    <Screen>
      <HeroHeader title="Badges" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Card>
          <Text style={styles.sectionTitle}>Create Badge</Text>
          <TextInput
            style={styles.input}
            value={badgeTitle}
            onChangeText={setBadgeTitle}
            placeholder="Badge title"
            placeholderTextColor={uiColors.muted}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={badgeDescription}
            onChangeText={setBadgeDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholder="Badge description (optional)"
            placeholderTextColor={uiColors.muted}
          />
          <View style={styles.attachmentRow}>
            <Pressable style={styles.secondaryButton} onPress={() => void selectBadgeImage()}>
              <Text style={styles.secondaryButtonText}>
                {selectedBadgeImage ? "Change Image" : "Attach Image"}
              </Text>
            </Pressable>
            {selectedBadgeImage ? (
              <Pressable
                style={[styles.secondaryButton, styles.secondaryDanger]}
                onPress={() => setSelectedBadgeImage(null)}
              >
                <Text style={styles.secondaryDangerText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          {selectedBadgeImage ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: selectedBadgeImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <Text style={styles.previewText}>{selectedBadgeImage.name}</Text>
            </View>
          ) : null}
          <Pressable style={styles.button} onPress={() => void createBadge()} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? "Saving..." : "Create Badge"}</Text>
          </Pressable>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Assign Badge</Text>
          <Text style={styles.subtleText}>Select a badge</Text>
          <View style={styles.chipWrap}>
            {badges.map((badge) => {
              const selected = selectedBadgeId === badge.id;
              return (
                <Pressable
                  key={badge.id}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                  onPress={() => setSelectedBadgeId(badge.id)}
                >
                  <Text style={selected ? styles.chipTextActive : styles.chipText}>
                    {badge.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={studentQuery}
            onChangeText={setStudentQuery}
            placeholder="Search by first name, last name, full name, number, or email"
            placeholderTextColor={uiColors.muted}
          />

          <Text style={styles.subtleText}>Visibility</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.chip, visibility === "private" ? styles.chipActive : null]}
              onPress={() => setVisibility("private")}
            >
              <Text style={visibility === "private" ? styles.chipTextActive : styles.chipText}>
                Private
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, visibility === "public" ? styles.chipActive : null]}
              onPress={() => setVisibility("public")}
            >
              <Text style={visibility === "public" ? styles.chipTextActive : styles.chipText}>
                Public
              </Text>
            </Pressable>
          </View>

          <Text style={styles.subtleText}>Selected students</Text>
          <View style={styles.selectedWrap}>
            {selectedStudents.length ? (
              selectedStudents.map((student) => (
                <Pressable
                  key={`selected-${student.id}`}
                  style={styles.selectedChip}
                  onPress={() => toggleStudent(student.id)}
                >
                  <Text style={styles.selectedChipText}>
                    {formatStudentName(student)} #{student.student_number} x
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.subtleText}>No students selected.</Text>
            )}
          </View>

          <Text style={styles.subtleText}>Search results</Text>
          {studentQuery.trim() ? (
            <View style={styles.studentList}>
              {filteredStudents.slice(0, 30).map((student) => {
                const selected = selectedStudentIds.includes(student.id);
                return (
                  <Pressable
                    key={student.id}
                    style={[styles.studentRow, selected ? styles.studentRowSelected : null]}
                    onPress={() => toggleStudent(student.id)}
                  >
                    <Text style={styles.studentLabel}>
                      {formatStudentName(student)} #{student.student_number}
                    </Text>
                  </Pressable>
                );
              })}
              {!filteredStudents.length ? (
                <Text style={styles.subtleText}>No students match that search.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.subtleText}>
              Start typing to search students for assignment.
            </Text>
          )}

          <Pressable style={styles.button} onPress={() => void assignBadge()} disabled={assigning}>
            <Text style={styles.buttonText}>{assigning ? "Assigning..." : "Assign Badge"}</Text>
          </Pressable>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>Badge Catalog</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.refreshText}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
          {badges.length ? (
            badges.map((badge) => (
              <Card key={badge.id} style={styles.badgeCard}>
                <View style={styles.row}>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  {badge.milestone_count === null ? (
                    <Pressable onPress={() => askDeleteBadge(badge)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.autoText}>Auto</Text>
                  )}
                </View>
                <Text style={styles.subtleText}>{badge.description ?? "No description"}</Text>
                <Text style={styles.metaText}>
                  {badge.milestone_count !== null
                    ? `Milestone: ${badge.milestone_count} classes`
                    : "Manual badge"}
                </Text>
              </Card>
            ))
          ) : (
            <Text style={styles.subtleText}>No badges found.</Text>
          )}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatStudentName(student: StudentRow) {
  return [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student";
}

function matchesStudentQuery(student: StudentRow, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return false;

  const first = (student.first_name ?? "").toLowerCase();
  const last = (student.last_name ?? "").toLowerCase();
  const full = `${first} ${last}`.trim();
  const email = (student.email ?? "").toLowerCase();
  const number = String(student.student_number);

  if (number.includes(query)) return true;
  if (email.includes(query)) return true;

  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  if (tokens.length === 1) {
    const token = tokens[0];
    return first.includes(token) || last.includes(token) || full.includes(token);
  }

  return tokens.every(
    (token) => first.includes(token) || last.includes(token) || full.includes(token)
  );
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

function getImageExtension(filename: string, mimeType: string | null) {
  const lowered = filename.trim().toLowerCase();
  const pieces = lowered.split(".");
  if (pieces.length > 1) {
    const ext = pieces[pieces.length - 1];
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

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
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
    minHeight: 84
  },
  attachmentRow: {
    flexDirection: "row",
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
    height: 160
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
  subtleText: {
    color: uiColors.muted
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipActive: {
    borderColor: uiColors.accent,
    backgroundColor: uiColors.accent
  },
  chipText: {
    color: uiColors.text,
    fontWeight: "700"
  },
  chipTextActive: {
    color: "#0b1220",
    fontWeight: "800"
  },
  selectedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  selectedChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#2b1113",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  selectedChipText: {
    color: "#fecdd3",
    fontWeight: "700",
    fontSize: 12
  },
  studentList: {
    gap: 6
  },
  studentRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: uiColors.border,
    backgroundColor: uiColors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  studentRowSelected: {
    borderColor: uiColors.accent,
    backgroundColor: "#3f0d14"
  },
  studentLabel: {
    color: uiColors.text,
    fontWeight: "600"
  },
  badgeCard: {
    marginTop: 8,
    backgroundColor: uiColors.surfaceAlt
  },
  badgeTitle: {
    fontWeight: "800",
    flex: 1
  },
  metaText: {
    color: "#9ca3af",
    fontSize: 12
  },
  refreshText: {
    color: uiColors.accent,
    fontWeight: "700"
  },
  deleteText: {
    color: "#fca5a5",
    fontWeight: "700"
  },
  autoText: {
    color: "#86efac",
    fontWeight: "700"
  },
  message: {
    color: "#fca5a5"
  }
});
