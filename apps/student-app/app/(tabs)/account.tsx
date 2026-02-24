import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput } from "react-native";
import { Badge, Card, Row, Screen, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import {
  fetchLinkedStudents,
  getSupabaseClient,
  registerMobileUser,
  verifyMobileEmail,
  verifyMobileStudentNumbers
} from "@mamute/api";
import { LinkedStudentSummary } from "@mamute/types";
import { classifyStanding } from "@mamute/utils";

type LinkStep = "email" | "students";

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
  const [availableStudents, setAvailableStudents] = useState<
    Array<{ id: string; studentNumber: number; firstName?: string | null; lastName?: string | null }>
  >([]);

  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionUserId(next?.user.id ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!sessionUserId) {
      setLinkedStudents([]);
      return;
    }
    fetchLinkedStudents()
      .then((rows) => setLinkedStudents(rows))
      .catch(() => setLinkedStudents([]));
  }, [sessionUserId]);

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
      const result = await verifyMobileEmail({ email: normalizedEmail });
      setAvailableStudents(result.students);
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

      const linked = await fetchLinkedStudents();
      setLinkedStudents(linked);

      setMessage("App linked on this device.");
      setStep("email");
      setStudentNumbers([""]);
      setAvailableStudents([]);
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
    setAvailableStudents([]);
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
        <Card>
          <Text>App linked on this device.</Text>
          {linkedStudents.map((student) => {
            const standingView = classifyStanding(student.membershipStanding);
            const studentName = [student.firstName, student.lastName].filter(Boolean).join(" ");
            const guardians = student.guardianNames?.length
              ? student.guardianNames.join(", ")
              : "None listed";
            return (
              <Card key={student.studentId} style={{ marginTop: 8 }}>
                <Row>
                  <Text style={{ fontWeight: "700" }}>{studentName || "Student"}</Text>
                  <Badge tone={standingView.tone} label={standingView.label} />
                </Row>
                <Text style={{ color: uiColors.muted }}>Student #: {student.studentNumber}</Text>
                <Text style={{ color: uiColors.muted }}>
                  Membership: {formatMembershipType(student.membershipType)}
                </Text>
                <Text style={{ color: uiColors.muted }}>Guardian name(s): {guardians}</Text>
              </Card>
            );
          })}
          <Pressable onPress={unlinkDevice} style={[buttonStyle, { marginTop: 12 }]}>
            <Text style={buttonTextStyle}>Break link on this device</Text>
          </Pressable>
          {message ? <Text style={{ color: "#fca5a5", marginTop: 10 }}>{message}</Text> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <HeroHeader title="Account" />
      <Card>
        <Text style={{ marginBottom: 8 }}>
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
            <Text style={{ marginTop: 8, marginBottom: 8 }}>
              Enter student number(s) linked to this email.
            </Text>
            {availableStudents.length ? (
              <Text style={{ color: uiColors.muted, marginBottom: 8 }}>
                Found in records: {availableStudents.map((student) => student.studentNumber).join(", ")}
              </Text>
            ) : null}

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

        {message ? <Text style={{ color: "#fca5a5", marginTop: 10 }}>{message}</Text> : null}
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
