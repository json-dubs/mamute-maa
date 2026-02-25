import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import {
  fetchNotifications,
  fetchLinkedStudents,
  getSupabaseClient,
  registerMobileUser,
  verifyMobileEmail,
  verifyMobileStudentNumbers
} from "@mamute/api";
import { LinkedStudentSummary } from "@mamute/types";
import { classifyStanding } from "@mamute/utils";
import { useRealtimeRefresh } from "../../components/useRealtimeRefresh";

type LinkStep = "email" | "students";

const milestoneBadgeImages: Record<number, ImageSourcePropType> = {
  10: require("../../assets/images/10classes.png"),
  25: require("../../assets/images/25classes.png"),
  50: require("../../assets/images/50classes.png"),
  100: require("../../assets/images/100classes.png"),
  200: require("../../assets/images/200classes.png"),
  300: require("../../assets/images/300classes.png"),
  400: require("../../assets/images/400classes.png"),
  500: require("../../assets/images/500classes.png")
};

function formatAccountError(error: any, fallback: string) {
  const raw =
    typeof error?.message === "string" && error.message.trim()
      ? error.message
      : fallback;

  if (raw.includes("EMAIL_NOT_FOUND")) {
    return "Email was not found in student or guardian records.";
  }
  if (raw.includes("STUDENT_MISMATCH")) {
    return "Student numbers do not match this email.";
  }
  if (raw.includes("MISSING_FIELDS")) {
    return "Please complete all required fields.";
  }
  if (raw.includes("UNAUTHORIZED")) {
    return "Session missing. Please try linking again.";
  }
  if (raw.includes("Invalid JWT")) {
    return "Function JWT verification rejected the session token. Redeploy latest edge functions and restart Expo.";
  }
  if (raw.includes("ANON_SESSION_FAILED")) {
    return "Could not create a device session. Try again.";
  }
  if (raw.toLowerCase().includes("anonymous") && raw.toLowerCase().includes("disabled")) {
    return "Anonymous sign-in is disabled in Supabase Auth settings.";
  }
  if (raw.includes("SERVICE_ROLE_KEY") || raw.includes("SUPABASE_URL")) {
    return "Server configuration is missing for this function. Contact admin.";
  }
  return raw;
}

export default function AccountScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<LinkStep>("email");
  const [studentNumbers, setStudentNumbers] = useState<string[]>([""]);

  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsInitializedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionUserId(next?.user.id ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  const loadLinkedStudents = useCallback(async () => {
    if (!sessionUserId) {
      setLinkedStudents([]);
      return;
    }
    try {
      const rows = await fetchLinkedStudents();
      setLinkedStudents(rows);
    } catch {
      setLinkedStudents([]);
    }
  }, [sessionUserId]);

  const loadNotifications = useCallback(async () => {
    if (!sessionUserId) {
      seenNotificationIdsRef.current.clear();
      notificationsInitializedRef.current = false;
      return;
    }

    try {
      const rows = await fetchNotifications(sessionUserId);
      if (!notificationsInitializedRef.current) {
        rows.forEach((row) => seenNotificationIdsRef.current.add(row.id));
        notificationsInitializedRef.current = true;
        return;
      }

      const fresh = rows.filter((row) => !seenNotificationIdsRef.current.has(row.id));
      if (!fresh.length) return;
      fresh.forEach((row) => seenNotificationIdsRef.current.add(row.id));

      const priority = fresh.find((row) => row.type === "dues") ?? fresh[0];
      if (priority?.title && priority?.body) {
        alertMessage(priority.title, priority.body);
      }
    } catch {
      // no-op: notification failures should not block account rendering
    }
  }, [sessionUserId]);

  useEffect(() => {
    loadLinkedStudents();
    loadNotifications();
  }, [loadLinkedStudents, loadNotifications]);

  useRealtimeRefresh({
    name: "account-linked-data",
    tables: [
      "students",
      "student_access",
      "student_guardians",
      "student_badges",
      "badges",
      "mamute_news"
    ],
    onRefresh: loadLinkedStudents,
    enabled: Boolean(sessionUserId)
  });

  useRealtimeRefresh({
    name: "account-notifications",
    tables: ["notifications"],
    onRefresh: loadNotifications,
    enabled: Boolean(sessionUserId)
  });

  const ensureSession = async () => {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      const { error: userError } = await supabase.auth.getUser();
      if (!userError) return existing.session;
      await supabase.auth.signOut();
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session) throw new Error("ANON_SESSION_FAILED");
    return data.session;
  };

  const submitEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Enter your email.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await verifyMobileEmail({ email: normalizedEmail });
      setStep("students");
    } catch (error: any) {
      setMessage(formatAccountError(error, "Email was not found."));
    } finally {
      setLoading(false);
    }
  };

  const linkAccount = async () => {
    const parsedNumbers = [
      ...new Set(
        studentNumbers
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value))
      )
    ];
    if (!parsedNumbers.length) {
      setMessage("Enter at least one student number.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const verifyResult = await verifyMobileStudentNumbers({
        email: normalizedEmail,
        studentNumbers: parsedNumbers
      });

      const session = await ensureSession();
      await registerMobileUser({
        email: normalizedEmail,
        studentNumbers: verifyResult.students.map((student) => student.studentNumber)
      }, session.access_token);

      await loadLinkedStudents();

      setMessage("App linked on this device.");
      setStep("email");
      setStudentNumbers([""]);
    } catch (error: any) {
      setMessage(formatAccountError(error, "Could not link app to student records."));
    } finally {
      setLoading(false);
    }
  };

  const unlinkDevice = async () => {
    await supabase.auth.signOut();
    setMessage("Device unlinked. You can link again anytime.");
    setStep("email");
    setStudentNumbers([""]);
    seenNotificationIdsRef.current.clear();
    notificationsInitializedRef.current = false;
  };

  const addStudentNumber = () => {
    setStudentNumbers((prev) => [...prev, ""]);
  };

  const updateStudentNumber = (index: number, value: string) => {
    setStudentNumbers((prev) => prev.map((entry, idx) => (idx === index ? value : entry)));
  };

  if (sessionUserId && linkedStudents.length) {
    return (
      <Screen>
        <HeroHeader title="Account" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          <Card style={styles.statusCard}>
            <Text style={styles.statusTitle}>Device Linked</Text>
            <Text style={styles.statusSubtitle}>
              This device is currently linked to your account.
            </Text>
          </Card>

          <SectionHeader title="Linked Students" subtitle="Membership and guardian details" />
          {linkedStudents.map((student) => {
            const standingView = classifyStanding(student.membershipStanding);
            const studentName = [student.firstName, student.lastName].filter(Boolean).join(" ");
            const guardians = student.guardianNames?.length
              ? student.guardianNames.join(", ")
              : "None listed";
            return (
              <Card key={student.studentId} style={styles.studentCard}>
                <Row>
                  <Text style={styles.studentName}>{studentName || "Student"}</Text>
                  <Badge tone={standingView.tone} label={standingView.label} />
                </Row>
                <Text style={styles.studentMeta}>Student #: {student.studentNumber}</Text>
                <Text style={styles.studentMeta}>
                  Membership: {formatMembershipType(student.membershipType)}
                </Text>
                <Text style={styles.studentMeta}>Guardian name(s): {guardians}</Text>
              </Card>
            );
          })}

          <SectionHeader
            title="Badges Earned"
            subtitle="Rewards unlocked through attendance and achievements"
          />
          {linkedStudents.map((student) => {
            const studentName = [student.firstName, student.lastName].filter(Boolean).join(" ");
            const badges = student.badges ?? [];
            return (
              <Card key={`badges-${student.studentId}`} style={styles.badgesCard}>
                <Text style={styles.badgesStudentLabel}>
                  {(studentName || "Student") + ` #${student.studentNumber}`}
                </Text>
                {badges.length ? (
                  <View style={styles.badgeGrid}>
                    {badges.map((badge) => {
                      const imageSource = resolveBadgeImageSource(
                        badge.imageUrl ?? null,
                        badge.milestoneCount
                      );
                      return (
                        <View key={badge.id} style={styles.badgeTile}>
                          <View style={styles.badgeImageFrame}>
                            {imageSource ? (
                            <Image
                              source={imageSource}
                              style={styles.badgeImage}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={styles.badgeFallbackIcon}>Award</Text>
                          )}
                          </View>
                          <Text style={styles.badgeTitle} numberOfLines={2}>
                            {badge.title}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.studentMeta}>No badges earned yet.</Text>
                )}
              </Card>
            );
          })}

          <SectionHeader title="Device Link" subtitle="Manage connection on this phone" />
          <Card>
            <Pressable onPress={unlinkDevice} style={buttonStyle}>
              <Text style={buttonTextStyle}>Break link on this device</Text>
            </Pressable>
            {message ? <Text style={styles.errorText}>{message}</Text> : null}
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <HeroHeader title="Account" />
      <SectionHeader
        title="Link Mobile App"
        subtitle="Connect this device to your student account"
      />
      <Card>
        <Text style={styles.linkLead}>
          Link this app using your email and linked student number(s).
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={uiColors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={inputStyle}
        />

        {step === "email" ? (
          <Pressable onPress={submitEmail} style={buttonStyle} disabled={loading}>
            <Text style={buttonTextStyle}>{loading ? "Checking email..." : "Continue"}</Text>
          </Pressable>
        ) : null}

        {step === "students" ? (
          <>
            <Text style={styles.linkLead}>
              Enter student number(s) linked to this email.
            </Text>

            {studentNumbers.map((value, index) => (
              <TextInput
                key={`student-number-${index}`}
                value={value}
                onChangeText={(next) => updateStudentNumber(index, next)}
                placeholder={`Student number ${index + 1}`}
                placeholderTextColor={uiColors.muted}
                keyboardType="number-pad"
                style={inputStyle}
              />
            ))}

            <Pressable onPress={addStudentNumber} style={buttonStyle}>
              <Text style={buttonTextStyle}>Add another student number</Text>
            </Pressable>

            <Pressable onPress={linkAccount} style={[buttonStyle, { marginTop: 10 }]} disabled={loading}>
              <Text style={buttonTextStyle}>{loading ? "Linking..." : "Link app"}</Text>
            </Pressable>

            <Pressable onPress={() => setStep("email")} style={{ marginTop: 10 }}>
              <Text style={linkStyle}>Back</Text>
            </Pressable>
          </>
        ) : null}

        {message ? <Text style={styles.errorText}>{message}</Text> : null}
      </Card>
    </Screen>
  );
}

function resolveBadgeImageSource(
  imageUrl: string | null,
  milestoneCount?: number | null
): ImageSourcePropType | null {
  if (typeof milestoneCount === "number" && milestoneBadgeImages[milestoneCount]) {
    return milestoneBadgeImages[milestoneCount];
  }
  if (imageUrl) {
    return { uri: imageUrl };
  }
  return null;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderColor: "#3f0d14",
    backgroundColor: "#21090d"
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3
  },
  statusSubtitle: {
    color: "#fda4af",
    fontWeight: "600"
  },
  sectionHeaderWrap: {
    marginTop: 6,
    marginBottom: 2,
    borderLeftWidth: 4,
    borderLeftColor: uiColors.accent,
    paddingLeft: 10,
    paddingVertical: 4
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  sectionHeaderSubtitle: {
    color: uiColors.muted,
    marginTop: 2
  },
  studentCard: {
    marginTop: 8
  },
  studentName: {
    fontWeight: "700",
    fontSize: 16
  },
  studentMeta: {
    color: uiColors.muted
  },
  badgesCard: {
    marginTop: 8
  },
  badgesStudentLabel: {
    fontWeight: "700",
    marginBottom: 8
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  badgeTile: {
    width: "31%",
    minWidth: 98,
    backgroundColor: uiColors.surfaceAlt,
    borderWidth: 1,
    borderColor: uiColors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 8
  },
  badgeImageFrame: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },
  badgeImage: {
    width: "100%",
    height: "100%"
  },
  badgeFallbackIcon: {
    color: "#fbbf24",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center"
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16
  },
  linkLead: {
    marginBottom: 8
  },
  errorText: {
    color: "#fca5a5",
    marginTop: 10
  }
});

const inputStyle = {
  backgroundColor: uiColors.surfaceAlt,
  color: uiColors.text,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: uiColors.border,
  marginBottom: 10
};

const buttonStyle = {
  backgroundColor: uiColors.accent,
  padding: 12,
  borderRadius: 10,
  alignItems: "center"
};

const buttonTextStyle = {
  color: "#0b1220",
  fontWeight: "700"
};

const linkStyle = {
  color: uiColors.accent,
  marginTop: 10
};

function formatMembershipType(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function alertMessage(title: string, body: string) {
  const safeTitle = title || "Notification";
  const safeBody = body || "";
  Alert.alert(safeTitle, safeBody);
}
