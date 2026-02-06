import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, TextInput } from "react-native";
import { Screen, Card, Text, uiColors } from "@mamute/ui";
import { HeroHeader } from "../../components/HeroHeader";
import {
  fetchLinkedStudents,
  getSupabaseClient,
  registerMobileUser,
  verifyGuardianLink,
  verifyStudentLink
} from "@mamute/api";

export default function AccountScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [children, setChildren] = useState<Array<{ lastName: string; studentNumber: string }>>([
    { lastName: "", studentNumber: "" }
  ]);
  const [role, setRole] = useState<"student" | "guardian">("student");
  const [mode, setMode] = useState<"choice" | "register" | "signin">("choice");
  const [step, setStep] = useState<"details" | "confirm" | "password">("details");
  const [verifiedStudent, setVerifiedStudent] = useState<{
    firstName?: string | null;
    lastName?: string | null;
    fullName: string;
    email: string | null;
    studentNumber: number;
  } | null>(null);
  const [verifiedGuardian, setVerifiedGuardian] = useState<{
    guardianName: string;
    students: Array<{ fullName: string; studentNumber: number }>;
  } | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSessionEmail(next?.user.email ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!sessionEmail) return;
    fetchLinkedStudents()
      .then((rows) => setLinkedStudents(rows.map((row) => row.fullName)))
      .catch(() => setLinkedStudents([]));
  }, [sessionEmail]);

  const signIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
      setMessage("Signed in.");
    } catch (error: any) {
      setMessage(error?.message ?? "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const startRegistration = () => {
    setMode("register");
    setStep("details");
    setMessage(null);
    setVerifiedStudent(null);
    setVerifiedGuardian(null);
  };

  const verifyStudent = async () => {
    const parsedNumber = Number.parseInt(studentNumber, 10);
    if (!Number.isFinite(parsedNumber) || !studentLastName.trim()) {
      setMessage("Enter last name and student number.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await verifyStudentLink({
        lastName: studentLastName.trim(),
        studentNumber: parsedNumber
      });
      if (!result.student.email) {
        setMessage("Student email is missing. Ask admin to add it.");
        return;
      }
        setVerifiedStudent({
          fullName: result.student.fullName,
          email: result.student.email,
          studentNumber: result.student.studentNumber
        });
      setStep("confirm");
    } catch (error: any) {
      setMessage(error?.message ?? "Could not verify student.");
    } finally {
      setLoading(false);
    }
  };

  const verifyGuardian = async () => {
    const parsedChildren = children
      .map((child) => ({
        lastName: child.lastName.trim(),
        studentNumber: Number.parseInt(child.studentNumber, 10)
      }))
      .filter(
        (child) => child.lastName.length > 0 && Number.isFinite(child.studentNumber)
      );
    if (!guardianEmail.trim() || !parsedChildren.length) {
      setMessage("Enter guardian email and at least one child.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await verifyGuardianLink({
        guardianEmail: guardianEmail.trim(),
        children: parsedChildren
      });
      setVerifiedGuardian({
        guardianName: result.guardianName,
        students: result.students.map((student) => ({
          fullName: student.fullName,
          studentNumber: student.studentNumber
        }))
      });
      setStep("confirm");
    } catch (error: any) {
      setMessage(error?.message ?? "Could not verify guardian.");
    } finally {
      setLoading(false);
    }
  };

  const registerAccount = async () => {
    if (!password || password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (role === "student" && verifiedStudent) {
        await registerMobileUser({
          role,
          fullName: verifiedStudent.fullName,
          email: verifiedStudent.email ?? "",
          studentNumbers: [verifiedStudent.studentNumber],
          password
        });
        const { error } = await supabase.auth.signInWithPassword({
          email: verifiedStudent.email ?? "",
          password
        });
        if (error) throw error;
      }
      if (role === "guardian" && verifiedGuardian) {
        await registerMobileUser({
          role,
          fullName: verifiedGuardian.guardianName,
          email: guardianEmail.trim(),
          studentNumbers: verifiedGuardian.students.map(
            (student) => student.studentNumber
          ),
          password
        });
        const { error } = await supabase.auth.signInWithPassword({
          email: guardianEmail.trim(),
          password
        });
        if (error) throw error;
      }
      setMessage("Account created. Signed in.");
      setMode("choice");
      setStep("details");
      setStudentLastName("");
      setStudentNumber("");
      setGuardianEmail("");
      setChildren([{ lastName: "", studentNumber: "" }]);
      setPassword("");
      setVerifiedStudent(null);
      setVerifiedGuardian(null);
    } catch (error: any) {
      setMessage(error?.message ?? "Sign up failed.");
      setStep("details");
    } finally {
      setLoading(false);
    }
  };

  const addChild = () => {
    setChildren((prev) => [...prev, { lastName: "", studentNumber: "" }]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMessage("Signed out.");
  };

  const resetPassword = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert("Reset email sent", "Check your inbox for the reset link.");
    } catch (error: any) {
      setMessage(error?.message ?? "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <HeroHeader title="Account" />
      <Card>
        {sessionEmail ? (
          <>
            <Text>Signed in as {sessionEmail}</Text>
            {linkedStudents.length ? (
              <Text style={{ color: uiColors.muted, marginTop: 6 }}>
                Linked students: {linkedStudents.join(", ")}
              </Text>
            ) : null}
            <Pressable onPress={signOut} style={buttonStyle}>
              <Text style={buttonTextStyle}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            {mode === "choice" ? (
              <>
                <Pressable onPress={startRegistration} style={buttonStyle}>
                  <Text style={buttonTextStyle}>
                    Are you a student or guardian? Sign in here
                  </Text>
                </Pressable>
                <Pressable onPress={() => setMode("signin")} style={{ marginTop: 10 }}>
                  <Text style={linkStyle}>Already have a password? Sign in</Text>
                </Pressable>
              </>
            ) : null}
            {mode === "signin" ? (
              <>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={uiColors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={inputStyle}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={uiColors.muted}
                  secureTextEntry
                  style={inputStyle}
                />
                <Pressable onPress={signIn} style={buttonStyle} disabled={loading}>
                  <Text style={buttonTextStyle}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Text>
                </Pressable>
                <Pressable onPress={resetPassword} disabled={loading}>
                  <Text style={linkStyle}>Forgot password / invite link?</Text>
                </Pressable>
              </>
            ) : null}
            {mode === "register" ? (
              <>
                <Pressable
                  onPress={() =>
                    setRole((prev) => (prev === "student" ? "guardian" : "student"))
                  }
                  style={[buttonStyle, { backgroundColor: uiColors.surfaceAlt }]}
                >
                  <Text style={[buttonTextStyle, { color: uiColors.text }]}>
                    I am a {role === "student" ? "student" : "guardian"}
                  </Text>
                </Pressable>
                {step === "details" ? (
                  <>
                    {role === "student" ? (
                      <>
                        <TextInput
                          value={studentLastName}
                          onChangeText={setStudentLastName}
                          placeholder="Last name"
                          placeholderTextColor={uiColors.muted}
                          style={inputStyle}
                        />
                        <TextInput
                          value={studentNumber}
                          onChangeText={setStudentNumber}
                          placeholder="Student number"
                          placeholderTextColor={uiColors.muted}
                          keyboardType="number-pad"
                          style={inputStyle}
                        />
                        <Pressable
                          onPress={verifyStudent}
                          style={[buttonStyle, { marginTop: 10 }]}
                        >
                          <Text style={buttonTextStyle}>Find Student</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <TextInput
                          value={guardianEmail}
                          onChangeText={setGuardianEmail}
                          placeholder="Guardian email"
                          placeholderTextColor={uiColors.muted}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          style={inputStyle}
                        />
                        {children.map((child, index) => (
                          <Card key={`child-${index}`} style={{ marginTop: 8 }}>
                            <TextInput
                              value={child.lastName}
                              onChangeText={(value) =>
                                setChildren((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, lastName: value } : item
                                  )
                                )
                              }
                              placeholder={`Child ${index + 1} last name`}
                              placeholderTextColor={uiColors.muted}
                              style={inputStyle}
                            />
                            <TextInput
                              value={child.studentNumber}
                              onChangeText={(value) =>
                                setChildren((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index
                                      ? { ...item, studentNumber: value }
                                      : item
                                  )
                                )
                              }
                              placeholder={`Child ${index + 1} student number`}
                              placeholderTextColor={uiColors.muted}
                              keyboardType="number-pad"
                              style={inputStyle}
                            />
                          </Card>
                        ))}
                        <Pressable onPress={addChild} style={buttonStyle}>
                          <Text style={buttonTextStyle}>Add another child</Text>
                        </Pressable>
                        <Pressable
                          onPress={verifyGuardian}
                          style={[buttonStyle, { marginTop: 10 }]}
                        >
                          <Text style={buttonTextStyle}>Verify Guardian</Text>
                        </Pressable>
                      </>
                    )}
                  </>
                ) : null}
                {step === "confirm" ? (
                  <>
                    {role === "student" && verifiedStudent ? (
                      <>
                        <Text>Is this you?</Text>
                        <Text style={{ color: uiColors.muted, marginTop: 6 }}>
                          {verifiedStudent.fullName} (#{verifiedStudent.studentNumber})
                        </Text>
                      </>
                    ) : null}
                    {role === "guardian" && verifiedGuardian ? (
                      <>
                        <Text>Confirm guardian + children</Text>
                        <Text style={{ color: uiColors.muted, marginTop: 6 }}>
                          {verifiedGuardian.guardianName}
                        </Text>
                        {verifiedGuardian.students.map((student) => (
                          <Text key={student.studentNumber} style={{ color: uiColors.muted }}>
                            {student.fullName} (#{student.studentNumber})
                          </Text>
                        ))}
                      </>
                    ) : null}
                    <Pressable
                      onPress={() => setStep("password")}
                      style={[buttonStyle, { marginTop: 10 }]}
                    >
                      <Text style={buttonTextStyle}>Yes, this is correct</Text>
                    </Pressable>
                    <Pressable onPress={() => setStep("details")} style={{ marginTop: 10 }}>
                      <Text style={linkStyle}>No, go back</Text>
                    </Pressable>
                  </>
                ) : null}
                {step === "password" ? (
                  <>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Create password"
                      placeholderTextColor={uiColors.muted}
                      secureTextEntry
                      style={inputStyle}
                    />
                    <Pressable
                      onPress={registerAccount}
                      style={buttonStyle}
                      disabled={loading}
                    >
                      <Text style={buttonTextStyle}>
                        {loading ? "Creating..." : "Create account"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setStep("confirm")} style={{ marginTop: 10 }}>
                      <Text style={linkStyle}>Back</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
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
