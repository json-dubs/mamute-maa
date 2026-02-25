import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import logo from "../../student-app/assets/images/MamuteLogo.png";

type CheckInResult = {
  student: {
    studentNumber: number;
    firstName?: string | null;
    lastName?: string | null;
    membershipStanding: string;
  };
  attendance?: { scannedAt: string } | null;
  blocked: boolean;
  reason?: string;
};

type CheckInResponse = {
  schedule: {
    classType: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  results: CheckInResult[];
};

type StudentRecord = {
  id: string;
  student_number: number;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  email: string | null;
  membership_type:
    | "adults-unlimited"
    | "kids-unlimited"
    | "striking-only"
    | "grappling-only"
    | "adults-limited-once-weekly"
    | "kids-limited-once-weekly";
  membership_standing: "active" | "inactive" | "overdue";
};

type InstructorRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type InstructorQualificationRecord = {
  instructor_id: string;
  class_type: ClassScheduleRecord["class_type"];
};

type ClassScheduleRecord = {
  id: string;
  class_type:
    | "bjj-gi"
    | "bjj-nogi"
    | "kids-bjj-gi"
    | "kids-bjj-nogi"
    | "kids-wrestling"
    | "kids-strength-conditioning"
    | "kids-muay-thai"
    | "muay-thai"
    | "boxing"
    | "mma";
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
};

type AttendanceStudent = {
  first_name: string | null;
  last_name: string | null;
  student_number: number;
};

type AttendanceSchedule = {
  class_type: ClassScheduleRecord["class_type"];
  day_of_week: number;
  start_time: string;
};

type AttendanceRecord = {
  id: string;
  scanned_at: string;
  source: string;
  students?: AttendanceStudent | AttendanceStudent[] | null;
  class_schedules?: AttendanceSchedule | AttendanceSchedule[] | null;
};

type StudentGuardianRecord = {
  id: string;
  student_id: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string;
  created_at: string;
};

type PendingGuardian = {
  id: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_email: string;
};

type MamuteNewsRecord = {
  id: string;
  title: string;
  description: string;
  post_type: "general" | "birthday" | "badge" | "payment";
  visibility: "public" | "private";
  student_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  expires_at: string | null;
  created_at: string;
};

type BadgeRecord = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  milestone_count: number | null;
  created_at: string;
};

const membershipTypes: StudentRecord["membership_type"][] = [
  "adults-unlimited",
  "kids-unlimited",
  "striking-only",
  "grappling-only",
  "adults-limited-once-weekly",
  "kids-limited-once-weekly"
];

const membershipStandings: StudentRecord["membership_standing"][] = [
  "active",
  "inactive",
  "overdue"
];

const classTypes: ClassScheduleRecord["class_type"][] = [
  "bjj-gi",
  "bjj-nogi",
  "kids-bjj-gi",
  "kids-bjj-nogi",
  "kids-wrestling",
  "kids-strength-conditioning",
  "kids-muay-thai",
  "muay-thai",
  "boxing",
  "mma"
];

const classTypeColors: Record<ClassScheduleRecord["class_type"], string> = {
  "bjj-gi": "#1e40af",
  "bjj-nogi": "#1d4ed8",
  "kids-bjj-gi": "#15803d",
  "kids-bjj-nogi": "#16a34a",
  "kids-wrestling": "#7c3aed",
  "kids-strength-conditioning": "#6d28d9",
  "kids-muay-thai": "#b45309",
  "muay-thai": "#c2410c",
  boxing: "#b91c1c",
  mma: "#7f1d1d"
};

const dayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

const newsBucket = "mamute-news";
const badgesBucket = "mamute-badges";

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminCreateFirstName, setAdminCreateFirstName] = useState("");
  const [adminCreateLastName, setAdminCreateLastName] = useState("");
  const [adminCreateEmail, setAdminCreateEmail] = useState("");
  const [adminCreateMessage, setAdminCreateMessage] = useState<string | null>(null);
  const [isAdminCreating, setIsAdminCreating] = useState(false);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRecord[]>([]);
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const [barcode, setBarcode] = useState("");
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinResponse, setCheckinResponse] = useState<CheckInResponse | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentsMessage, setStudentsMessage] = useState<string | null>(null);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [isCsvImporting, setIsCsvImporting] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentBirthDate, setStudentBirthDate] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentMembershipType, setStudentMembershipType] =
    useState<StudentRecord["membership_type"]>("adults-unlimited");
  const [studentMembershipStanding, setStudentMembershipStanding] =
    useState<StudentRecord["membership_standing"]>("active");
  const [guardianRows, setGuardianRows] = useState<StudentGuardianRecord[]>([]);
  const [allGuardianRows, setAllGuardianRows] = useState<StudentGuardianRecord[]>([]);
  const [guardianFirstName, setGuardianFirstName] = useState("");
  const [guardianLastName, setGuardianLastName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianMessage, setGuardianMessage] = useState<string | null>(null);
  const [isGuardianLoading, setIsGuardianLoading] = useState(false);
  const [pendingGuardians, setPendingGuardians] = useState<PendingGuardian[]>([]);

  const [instructors, setInstructors] = useState<InstructorRecord[]>([]);
  const [instructorsMessage, setInstructorsMessage] = useState<string | null>(null);
  const [isInstructorsLoading, setIsInstructorsLoading] = useState(false);
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [instructorFirstName, setInstructorFirstName] = useState("");
  const [instructorLastName, setInstructorLastName] = useState("");
  const [instructorEmail, setInstructorEmail] = useState("");
  const [qualifications, setQualifications] = useState<InstructorQualificationRecord[]>([]);
  const [isQualificationsLoading, setIsQualificationsLoading] = useState(false);
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [selectedQualifications, setSelectedQualifications] = useState<
    ClassScheduleRecord["class_type"][]
  >([]);
  const [qualificationsMessage, setQualificationsMessage] = useState<string | null>(
    null
  );
  const [schedules, setSchedules] = useState<ClassScheduleRecord[]>([]);
  const [schedulesMessage, setSchedulesMessage] = useState<string | null>(null);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);
  const [isScheduleEditing, setIsScheduleEditing] = useState(false);
  const [newsPosts, setNewsPosts] = useState<MamuteNewsRecord[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsDescription, setNewsDescription] = useState("");
  const [newsExpiresAt, setNewsExpiresAt] = useState("");
  const [newsAttachment, setNewsAttachment] = useState<File | null>(null);
  const [newsMessage, setNewsMessage] = useState<string | null>(null);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isNewsSaving, setIsNewsSaving] = useState(false);
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [badgeTitle, setBadgeTitle] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeImage, setBadgeImage] = useState<File | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [badgeAssignVisibility, setBadgeAssignVisibility] = useState<"private" | "public">(
    "private"
  );
  const [badgeStudentQuery, setBadgeStudentQuery] = useState("");
  const [selectedBadgeStudentIds, setSelectedBadgeStudentIds] = useState<string[]>([]);
  const [badgesMessage, setBadgesMessage] = useState<string | null>(null);
  const [isBadgesLoading, setIsBadgesLoading] = useState(false);
  const [isBadgeSaving, setIsBadgeSaving] = useState(false);
  const [isBadgeAssigning, setIsBadgeAssigning] = useState(false);

  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    }
    return createClient(url, key);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const loadAdminState = async () => {
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }
      setIsAdminLoading(true);
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setIsAdmin(!error && Boolean(data));
      setIsAdminLoading(false);
    };

    if (session) {
      loadAdminState();
    } else {
      setIsAdmin(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    if (session && isAdmin) {
      loadStudents();
      loadInstructors();
      loadSchedules();
      loadQualifications();
      loadAttendance();
      loadAllGuardians();
      loadNews();
      loadBadges();
    } else {
      setStudents([]);
      setInstructors([]);
      setSchedules([]);
      setQualifications([]);
      setAttendanceRows([]);
      setGuardianRows([]);
      setAllGuardianRows([]);
      setNewsPosts([]);
      setBadges([]);
    }
  }, [session, isAdmin]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setAuthMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthMessage(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const createAdminUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setAdminCreateMessage(null);
    setIsAdminCreating(true);
    try {
      const { error } = await supabase.functions.invoke("createAdminUser", {
        body: {
          firstName: adminCreateFirstName.trim(),
          lastName: adminCreateLastName.trim(),
          email: adminCreateEmail.trim()
        }
      });
      if (error) throw error;
      setAdminCreateFirstName("");
      setAdminCreateLastName("");
      setAdminCreateEmail("");
      setAdminCreateMessage("Invite sent. They will set their password by email.");
    } catch (error: any) {
      setAdminCreateMessage(error?.message ?? "Failed to create admin");
    } finally {
      setIsAdminCreating(false);
    }
  };

  const submitCheckin = async (event: FormEvent) => {
    event.preventDefault();
    setCheckinMessage(null);
    setIsCheckingIn(true);
    try {
      const singleNumber = parseStudentNumbers(barcode);
      const body =
        singleNumber.length > 0
          ? {
              studentNumbers: singleNumber,
              source: "frontdesk",
              deviceId: "windows-admin"
            }
          : {
              barcode,
              source: "frontdesk",
              deviceId: "windows-admin"
            };
      const { data, error } = await supabase.functions.invoke("recordAttendance", {
        body
      });
      if (error) throw error;
      setCheckinResponse(data as CheckInResponse);
      setBarcode("");
    } catch (error: any) {
      setCheckinResponse(null);
      const status = error?.context?.status ? `status ${error.context.status}` : null;
      const details =
        typeof error?.context?.body === "string"
          ? error.context.body
          : error?.context?.body
            ? JSON.stringify(error.context.body)
            : null;
      const parts = [error?.message ?? "Check-in failed", status, details].filter(
        Boolean
      );
      setCheckinMessage(parts.join(": "));
      console.error("Check-in failed", error);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const loadStudents = async () => {
    setStudentsMessage(null);
    setIsStudentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("student_number", { ascending: true });
      if (error) throw error;
      setStudents((data as StudentRecord[]) ?? []);
    } catch (error: any) {
      setStudentsMessage(error?.message ?? "Failed to load students");
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const startEditStudent = (student: StudentRecord) => {
    setEditingStudentId(student.id);
    setStudentNumber(String(student.student_number));
    setStudentFirstName(student.first_name ?? "");
    setStudentLastName(student.last_name ?? "");
    setStudentBirthDate(student.birth_date ?? "");
    setStudentEmail(student.email ?? "");
    setStudentMembershipType(student.membership_type);
    setStudentMembershipStanding(student.membership_standing);
    setPendingGuardians([]);
    loadGuardians(student.id);
  };

  const resetStudentForm = () => {
    setEditingStudentId(null);
    setStudentNumber("");
    setStudentFirstName("");
    setStudentLastName("");
    setStudentBirthDate("");
    setStudentEmail("");
    setStudentMembershipType("adults-unlimited");
    setStudentMembershipStanding("active");
    setGuardianRows([]);
    setGuardianFirstName("");
    setGuardianLastName("");
    setGuardianEmail("");
    setGuardianMessage(null);
    setPendingGuardians([]);
  };

  const submitStudent = async (event: FormEvent) => {
    event.preventDefault();
    setStudentsMessage(null);
    if (!session) {
      setStudentsMessage("Sign in as admin to manage students.");
      return;
    }

    const parsedNumber = Number.parseInt(studentNumber, 10);
    if (!Number.isFinite(parsedNumber)) {
      setStudentsMessage("Student number must be numeric.");
      return;
    }

    const payload = {
      student_number: parsedNumber,
      first_name: studentFirstName.trim(),
      last_name: studentLastName.trim(),
      birth_date: studentBirthDate || null,
      email: studentEmail.trim() || null,
      membership_type: studentMembershipType,
      membership_standing: studentMembershipStanding
    };
    const guardianDrafts = normalizeGuardians(pendingGuardians);
    const previousStanding = editingStudentId
      ? students.find((student) => student.id === editingStudentId)?.membership_standing ?? null
      : null;

    try {
      let savedStudentId: string | null = editingStudentId;
      if (editingStudentId) {
        const { error } = await supabase
          .from("students")
          .update(payload)
          .eq("id", editingStudentId);
        if (error) throw error;
        await upsertGuardiansForStudent(editingStudentId, guardianDrafts);
      } else {
        const { data, error } = await supabase
          .from("students")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        const studentId = data?.id;
        savedStudentId = studentId ?? null;
        if (studentId) {
          await upsertGuardiansForStudent(studentId, guardianDrafts);
        }
      }

      const shouldDispatchOverduePush =
        payload.membership_standing === "overdue" && previousStanding !== "overdue";
      if (shouldDispatchOverduePush && savedStudentId) {
        await sendOverduePushNotifications(savedStudentId);
      }
      resetStudentForm();
      await loadStudents();
      await loadAllGuardians();
    } catch (error: any) {
      setStudentsMessage(error?.message ?? "Failed to save student");
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!session) return;
    const confirmed = window.confirm("Delete this student?");
    if (!confirmed) return;
    setStudentsMessage(null);
    try {
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) throw error;
      await loadStudents();
    } catch (error: any) {
      setStudentsMessage(error?.message ?? "Failed to delete student");
    }
  };

  const parseCsvLine = (line: string) =>
    line
      .split(",")
      .map((item) => item.trim());

  const parseBirthDateFromCsvValue = (value: string | undefined) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsedAge = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsedAge) && parsedAge > 0) {
      const today = new Date();
      const estimated = new Date(
        Date.UTC(
          today.getUTCFullYear() - parsedAge,
          today.getUTCMonth(),
          today.getUTCDate()
        )
      );
      return estimated.toISOString().slice(0, 10);
    }

    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10);
    }

    return null;
  };

  const normalizeGuardians = (guardians: PendingGuardian[]) => {
    const byEmail = new Map<string, PendingGuardian>();
    for (const guardian of guardians) {
      const normalizedEmail = guardian.guardian_email?.trim().toLowerCase();
      if (!normalizedEmail) continue;
      const existing = byEmail.get(normalizedEmail);
      if (existing) {
        byEmail.set(normalizedEmail, {
          ...existing,
          guardian_first_name:
            existing.guardian_first_name ?? guardian.guardian_first_name ?? null,
          guardian_last_name:
            existing.guardian_last_name ?? guardian.guardian_last_name ?? null
        });
        continue;
      }
      byEmail.set(normalizedEmail, {
        ...guardian,
        guardian_email: normalizedEmail
      });
    }
    return [...byEmail.values()];
  };

  const upsertGuardiansForStudent = async (
    studentId: string,
    guardians: PendingGuardian[]
  ) => {
    const normalized = normalizeGuardians(guardians);
    if (!normalized.length) return;
    const { error } = await supabase.from("student_guardians").upsert(
      normalized.map((guardian) => ({
        student_id: studentId,
        guardian_first_name: guardian.guardian_first_name,
        guardian_last_name: guardian.guardian_last_name,
        guardian_email: guardian.guardian_email
      })),
      { onConflict: "student_id,guardian_email" }
    );
    if (error) throw error;
  };

  const importStudentsCsv = async () => {
    if (!session) {
      setStudentsMessage("Sign in as admin to import students.");
      return;
    }
    if (!csvInput.trim()) return;

    setIsCsvImporting(true);
    setStudentsMessage(null);
    try {
      const lines = csvInput
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (!lines.length) return;

      const header = parseCsvLine(lines[0]);
      const hasHeader = header.includes("student_number");
      const startIndex = hasHeader ? 1 : 0;
      const rows = lines.slice(startIndex).map(parseCsvLine);
      const parsedRows = rows.map((row) => {
        const [
          studentNumber,
          firstName,
          lastName,
          birthDateOrAge,
          email,
          membershipType,
          membershipStanding,
          guardianFirstName,
          guardianLastName,
          guardianEmail
        ] = row;
        return {
          student_number: Number.parseInt(studentNumber, 10),
          first_name: firstName,
          last_name: lastName,
          birth_date: parseBirthDateFromCsvValue(birthDateOrAge),
          email: email || null,
          membership_type: membershipType,
          membership_standing: membershipStanding,
          guardian_first_name: guardianFirstName || null,
          guardian_last_name: guardianLastName || null,
          guardian_email: guardianEmail ? guardianEmail.toLowerCase() : null
        };
      });
      const studentPayload = parsedRows.map((row) => ({
        student_number: row.student_number,
        first_name: row.first_name,
        last_name: row.last_name,
        birth_date: row.birth_date,
        email: row.email,
        membership_type: row.membership_type,
        membership_standing: row.membership_standing
      }));

      const invalid = studentPayload.find(
        (row) =>
          !Number.isFinite(row.student_number) ||
          !row.first_name ||
          !row.last_name ||
          !row.membership_type ||
          !row.membership_standing
      );
      if (invalid) {
        setStudentsMessage("CSV contains invalid rows. Check required fields.");
        return;
      }

      const { data: inserted, error } = await supabase
        .from("students")
        .insert(studentPayload)
        .select("id, student_number");
      if (error) throw error;

      const idsByNumber = new Map(
        ((inserted as Array<{ id: string; student_number: number }> | null) ?? []).map(
          (row) => [row.student_number, row.id]
        )
      );
      const guardianByStudentAndEmail = new Map<
        string,
        {
          student_id: string;
          guardian_first_name: string | null;
          guardian_last_name: string | null;
          guardian_email: string;
        }
      >();
      for (const row of parsedRows) {
        if (!row.guardian_email) continue;
        const studentId = idsByNumber.get(row.student_number);
        if (!studentId) continue;
        const key = `${studentId}:${row.guardian_email}`;
        const existing = guardianByStudentAndEmail.get(key);
        if (existing) {
          guardianByStudentAndEmail.set(key, {
            ...existing,
            guardian_first_name: existing.guardian_first_name ?? row.guardian_first_name,
            guardian_last_name: existing.guardian_last_name ?? row.guardian_last_name
          });
          continue;
        }
        guardianByStudentAndEmail.set(key, {
          student_id: studentId,
          guardian_first_name: row.guardian_first_name,
          guardian_last_name: row.guardian_last_name,
          guardian_email: row.guardian_email
        });
      }
      const guardianPayload = [...guardianByStudentAndEmail.values()];
      if (guardianPayload.length) {
        const { error: guardianError } = await supabase
          .from("student_guardians")
          .upsert(guardianPayload, { onConflict: "student_id,guardian_email" });
        if (guardianError) throw guardianError;
      }

      setCsvInput("");
      await loadStudents();
      await loadAllGuardians();
    } catch (error: any) {
      setStudentsMessage(error?.message ?? "Failed to import students");
    } finally {
      setIsCsvImporting(false);
    }
  };

  const loadInstructors = async () => {
    setInstructorsMessage(null);
    setIsInstructorsLoading(true);
    try {
      const { data, error } = await supabase
        .from("instructors")
        .select("*")
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (error) throw error;
      setInstructors((data as InstructorRecord[]) ?? []);
    } catch (error: any) {
      setInstructorsMessage(error?.message ?? "Failed to load instructors");
    } finally {
      setIsInstructorsLoading(false);
    }
  };

  const loadQualifications = async () => {
    setQualificationsMessage(null);
    setIsQualificationsLoading(true);
    try {
      const { data, error } = await supabase
        .from("instructor_qualifications")
        .select("*")
        .order("class_type", { ascending: true });
      if (error) throw error;
      setQualifications((data as InstructorQualificationRecord[]) ?? []);
    } catch (error: any) {
      setQualificationsMessage(error?.message ?? "Failed to load qualifications");
    } finally {
      setIsQualificationsLoading(false);
    }
  };

  const selectInstructorQualifications = (instructorId: string) => {
    setSelectedInstructorId(instructorId);
    const current = qualifications
      .filter((item) => item.instructor_id === instructorId)
      .map((item) => item.class_type);
    setSelectedQualifications(current);
  };

  const toggleQualification = (value: ClassScheduleRecord["class_type"]) => {
    setSelectedQualifications((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const saveQualifications = async () => {
    setQualificationsMessage(null);
    if (!session) {
      setQualificationsMessage("Sign in as admin to manage qualifications.");
      return;
    }
    if (!selectedInstructorId) {
      setQualificationsMessage("Select an instructor first.");
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("instructor_qualifications")
        .delete()
        .eq("instructor_id", selectedInstructorId);
      if (deleteError) throw deleteError;

      if (selectedQualifications.length) {
        const rows = selectedQualifications.map((classType) => ({
          instructor_id: selectedInstructorId,
          class_type: classType
        }));
        const { error } = await supabase
          .from("instructor_qualifications")
          .insert(rows);
        if (error) throw error;
      }

      await loadQualifications();
    } catch (error: any) {
      setQualificationsMessage(error?.message ?? "Failed to save qualifications");
    }
  };

  const loadSchedules = async () => {
    setSchedulesMessage(null);
    setIsSchedulesLoading(true);
    try {
      const { data, error } = await supabase
        .from("class_schedules")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      setSchedules((data as ClassScheduleRecord[]) ?? []);
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to load schedules");
    } finally {
      setIsSchedulesLoading(false);
    }
  };

  const loadAttendance = async () => {
    setAttendanceMessage(null);
    setIsAttendanceLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "id, scanned_at, source, students:student_id(first_name, last_name, student_number), class_schedules:schedule_id(class_type, day_of_week, start_time)"
        )
        .order("scanned_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAttendanceRows((data as unknown as AttendanceRecord[]) ?? []);
    } catch (error: any) {
      setAttendanceMessage(error?.message ?? "Failed to load attendance");
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const sendOverduePushNotifications = async (studentId: string) => {
    try {
      const { data: accessRows, error } = await supabase
        .from("student_access")
        .select("user_id")
        .eq("student_id", studentId);
      if (error) throw error;

      const userIds = [
        ...new Set((accessRows ?? []).map((row: { user_id: string }) => row.user_id))
      ];
      for (const userId of userIds) {
        await supabase.functions.invoke("sendNotification", {
          body: {
            id: crypto.randomUUID(),
            title: "Payment Required",
            body: "Hey there, we noticed you are behind on membership payment. Please make payment at your earliest convenience to help us keep running smoothly. If you believe this notification is in error, please contact us.",
            target: { profileId: userId }
          }
        });
      }
    } catch (error) {
      console.warn("Failed to dispatch overdue push notification", error);
    }
  };

  const loadNews = async () => {
    setNewsMessage(null);
    setIsNewsLoading(true);
    try {
      const { data, error } = await supabase
        .from("mamute_news")
        .select(
          "id, title, description, post_type, visibility, student_id, attachment_path, attachment_name, attachment_mime_type, expires_at, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNewsPosts((data as MamuteNewsRecord[]) ?? []);
    } catch (error: any) {
      setNewsMessage(error?.message ?? "Failed to load Mamute News");
    } finally {
      setIsNewsLoading(false);
    }
  };

  const onNewsAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setNewsAttachment(file);
  };

  const submitNewsPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) {
      setNewsMessage("Sign in as admin to create news posts.");
      return;
    }

    const title = newsTitle.trim();
    const description = newsDescription.trim();
    if (!title || !description) {
      setNewsMessage("Title and description are required.");
      return;
    }

    setIsNewsSaving(true);
    setNewsMessage(null);

    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMimeType: string | null = null;

    try {
      if (newsAttachment) {
        const extension = newsAttachment.name.includes(".")
          ? newsAttachment.name.split(".").pop()
          : "";
        const filename = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
        const path = `posts/${new Date().toISOString().slice(0, 10)}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from(newsBucket)
          .upload(path, newsAttachment, {
            upsert: false,
            contentType: newsAttachment.type || undefined
          });
        if (uploadError) throw uploadError;
        attachmentPath = path;
        attachmentName = newsAttachment.name;
        attachmentMimeType = newsAttachment.type || null;
      }

      const { error } = await supabase.from("mamute_news").insert({
        title,
        description,
        post_type: "general",
        visibility: "public",
        student_id: null,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_mime_type: attachmentMimeType,
        expires_at: newsExpiresAt ? new Date(newsExpiresAt).toISOString() : null,
        created_by: session.user.id
      });
      if (error) throw error;

      setNewsTitle("");
      setNewsDescription("");
      setNewsExpiresAt("");
      setNewsAttachment(null);
      const newsFileInput = document.getElementById("mamute-news-attachment") as
        | HTMLInputElement
        | null;
      if (newsFileInput) newsFileInput.value = "";
      await loadNews();
    } catch (error: any) {
      setNewsMessage(error?.message ?? "Failed to create news post");
    } finally {
      setIsNewsSaving(false);
    }
  };

  const deleteNewsPost = async (post: MamuteNewsRecord) => {
    if (!session) return;
    const confirmed = window.confirm("Delete this news post?");
    if (!confirmed) return;
    setNewsMessage(null);
    try {
      if (post.attachment_path) {
        await supabase.storage.from(newsBucket).remove([post.attachment_path]);
      }
      const { error } = await supabase.from("mamute_news").delete().eq("id", post.id);
      if (error) throw error;
      await loadNews();
    } catch (error: any) {
      setNewsMessage(error?.message ?? "Failed to delete news post");
    }
  };

  const loadBadges = async () => {
    setBadgesMessage(null);
    setIsBadgesLoading(true);
    try {
      const { data, error } = await supabase
        .from("badges")
        .select(
          "id, title, description, image_path, image_name, image_mime_type, milestone_count, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBadges((data as BadgeRecord[]) ?? []);
    } catch (error: any) {
      setBadgesMessage(error?.message ?? "Failed to load badges");
    } finally {
      setIsBadgesLoading(false);
    }
  };

  const onBadgeImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setBadgeImage(file);
  };

  const submitBadge = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) {
      setBadgesMessage("Sign in as admin to create badges.");
      return;
    }

    const title = badgeTitle.trim();
    if (!title) {
      setBadgesMessage("Badge title is required.");
      return;
    }

    setIsBadgeSaving(true);
    setBadgesMessage(null);

    let imagePath: string | null = null;
    let imageName: string | null = null;
    let imageMimeType: string | null = null;

    try {
      if (badgeImage) {
        const extension = badgeImage.name.includes(".")
          ? badgeImage.name.split(".").pop()
          : "";
        const filename = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
        const path = `catalog/${new Date().toISOString().slice(0, 10)}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from(badgesBucket)
          .upload(path, badgeImage, {
            upsert: false,
            contentType: badgeImage.type || undefined
          });
        if (uploadError) throw uploadError;
        imagePath = path;
        imageName = badgeImage.name;
        imageMimeType = badgeImage.type || null;
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
      setBadgeImage(null);
      const fileInput = document.getElementById("mamute-badge-image") as
        | HTMLInputElement
        | null;
      if (fileInput) fileInput.value = "";
      await loadBadges();
    } catch (error: any) {
      setBadgesMessage(error?.message ?? "Failed to create badge");
    } finally {
      setIsBadgeSaving(false);
    }
  };

  const toggleBadgeStudentSelection = (studentId: string) => {
    setSelectedBadgeStudentIds((previous) =>
      previous.includes(studentId)
        ? previous.filter((id) => id !== studentId)
        : [...previous, studentId]
    );
  };

  const assignBadgeToStudents = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) {
      setBadgesMessage("Sign in as admin to assign badges.");
      return;
    }
    if (!selectedBadgeId) {
      setBadgesMessage("Select a badge to assign.");
      return;
    }
    if (!selectedBadgeStudentIds.length) {
      setBadgesMessage("Select at least one student.");
      return;
    }

    const badge = badges.find((item) => item.id === selectedBadgeId);
    if (!badge) {
      setBadgesMessage("Selected badge was not found.");
      return;
    }

    setIsBadgeAssigning(true);
    setBadgesMessage(null);
    try {
      const { data: existingRows, error: existingError } = await supabase
        .from("student_badges")
        .select("student_id")
        .eq("badge_id", selectedBadgeId)
        .in("student_id", selectedBadgeStudentIds);
      if (existingError) throw existingError;

      const existingStudentIds = new Set(
        (existingRows ?? []).map((row: { student_id: string }) => row.student_id)
      );
      const targetStudentIds = selectedBadgeStudentIds.filter(
        (studentId) => !existingStudentIds.has(studentId)
      );

      if (!targetStudentIds.length) {
        setBadgesMessage("Selected students already have this badge.");
        return;
      }

      const { error: assignError } = await supabase.from("student_badges").insert(
        targetStudentIds.map((studentId) => ({
          student_id: studentId,
          badge_id: selectedBadgeId,
          visibility: badgeAssignVisibility,
          assigned_source: "manual",
          assigned_by: session.user.id
        }))
      );
      if (assignError) throw assignError;

      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const selectedStudents = students.filter((student) =>
        targetStudentIds.includes(student.id)
      );

      if (badgeAssignVisibility === "public") {
        const studentNames = selectedStudents
          .map((student) => [student.first_name, student.last_name].filter(Boolean).join(" "))
          .map((name) => (name ? name : "Student"))
          .join(", ");
        const { error: newsError } = await supabase.from("mamute_news").insert({
          title: `Badge Award: ${badge.title}`,
          description: `Congratulations to ${studentNames} for earning the ${badge.title} badge.`,
          post_type: "badge",
          visibility: "public",
          student_id: null,
          attachment_path: badge.image_path,
          attachment_name: badge.image_name,
          attachment_mime_type: badge.image_mime_type,
          expires_at: expiresAt,
          created_by: session.user.id
        });
        if (newsError) throw newsError;
      } else {
        const privatePosts = selectedStudents.map((student) => {
          const studentName =
            [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student";
          return {
            title: `Badge Award: ${badge.title}`,
            description: `${studentName} has earned the ${badge.title} badge.`,
            post_type: "badge",
            visibility: "private",
            student_id: student.id,
            attachment_path: badge.image_path,
            attachment_name: badge.image_name,
            attachment_mime_type: badge.image_mime_type,
            expires_at: expiresAt,
            created_by: session.user.id
          };
        });
        if (privatePosts.length) {
          const { error: privatePostError } = await supabase
            .from("mamute_news")
            .insert(privatePosts);
          if (privatePostError) throw privatePostError;
        }
      }

      setBadgesMessage(
        `Assigned ${badge.title} to ${targetStudentIds.length} student${targetStudentIds.length === 1 ? "" : "s"}.`
      );
      setSelectedBadgeStudentIds([]);
      await loadNews();
    } catch (error: any) {
      setBadgesMessage(error?.message ?? "Failed to assign badge");
    } finally {
      setIsBadgeAssigning(false);
    }
  };

  const loadGuardians = async (studentId: string) => {
    setGuardianMessage(null);
    setIsGuardianLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_guardians")
        .select(
          "id, student_id, guardian_first_name, guardian_last_name, guardian_email, created_at"
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGuardianRows((data as StudentGuardianRecord[]) ?? []);
    } catch (error: any) {
      setGuardianMessage(error?.message ?? "Failed to load guardians");
    } finally {
      setIsGuardianLoading(false);
    }
  };

  const loadAllGuardians = async () => {
    try {
      const { data, error } = await supabase
        .from("student_guardians")
        .select(
          "id, student_id, guardian_first_name, guardian_last_name, guardian_email, created_at"
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      setAllGuardianRows((data as StudentGuardianRecord[]) ?? []);
    } catch {
      setAllGuardianRows([]);
    }
  };

  const addGuardian = async () => {
    if (!session) return;
    const normalizedEmail = guardianEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setGuardianMessage("Enter guardian email.");
      return;
    }
    setIsGuardianLoading(true);
    setGuardianMessage(null);
    try {
      if (editingStudentId) {
        const { error } = await supabase.from("student_guardians").insert({
          student_id: editingStudentId,
          guardian_first_name: guardianFirstName.trim() || null,
          guardian_last_name: guardianLastName.trim() || null,
          guardian_email: normalizedEmail
        });
        if (error) throw error;
        await loadGuardians(editingStudentId);
        await loadAllGuardians();
      } else {
        if (
          pendingGuardians.some(
            (guardian) => guardian.guardian_email.toLowerCase() === normalizedEmail
          )
        ) {
          setGuardianMessage("This guardian email is already in the list.");
          return;
        }
        setPendingGuardians((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            guardian_first_name: guardianFirstName.trim() || null,
            guardian_last_name: guardianLastName.trim() || null,
            guardian_email: normalizedEmail
          }
        ]);
      }
      setGuardianFirstName("");
      setGuardianLastName("");
      setGuardianEmail("");
    } catch (error: any) {
      setGuardianMessage(error?.message ?? "Failed to add guardian");
    } finally {
      setIsGuardianLoading(false);
    }
  };

  const removePendingGuardian = (guardianId: string) => {
    setPendingGuardians((prev) => prev.filter((item) => item.id !== guardianId));
  };

  const removeGuardian = async (guardianId: string) => {
    if (!session) return;
    if (!editingStudentId) return;
    const confirmed = window.confirm("Remove this guardian?");
    if (!confirmed) return;
    setIsGuardianLoading(true);
    setGuardianMessage(null);
    try {
      const { error } = await supabase
        .from("student_guardians")
        .delete()
        .eq("id", guardianId);
      if (error) throw error;
      await loadGuardians(editingStudentId);
      await loadAllGuardians();
    } catch (error: any) {
      setGuardianMessage(error?.message ?? "Failed to remove guardian");
    } finally {
      setIsGuardianLoading(false);
    }
  };

  const timeSlots = Array.from({ length: 12 }, (_, idx) => 9 + idx);
  const defaultTimezone = "America/Toronto";

  const scheduleBySlot = schedules.reduce<Record<string, ClassScheduleRecord>>(
    (acc, schedule) => {
      const hour = Number.parseInt(schedule.start_time.split(":")[0], 10);
      if (Number.isFinite(hour)) {
        acc[`${schedule.day_of_week}-${hour}`] = schedule;
      }
      return acc;
    },
    {}
  );

  const formatHourLabel = (hour: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const normalized = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalized}:00 ${suffix}`;
  };

  const handleDropSchedule = async (
    dayOfWeek: number,
    hour: number,
    classType: ClassScheduleRecord["class_type"]
  ) => {
    if (!session || !isScheduleEditing) return;
    setSchedulesMessage(null);
    const key = `${dayOfWeek}-${hour}`;
    const existing = scheduleBySlot[key];
    const payload = {
      class_type: classType,
      instructor_id: existing?.instructor_id ?? null,
      day_of_week: dayOfWeek,
      start_time: `${String(hour).padStart(2, "0")}:00`,
      end_time: `${String(hour + 1).padStart(2, "0")}:00`,
      timezone: existing?.timezone ?? defaultTimezone,
      is_active: true
    };

    try {
      if (existing?.id) {
        const { error } = await supabase
          .from("class_schedules")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("class_schedules").insert(payload);
        if (error) throw error;
      }
      await loadSchedules();
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to save schedule");
    }
  };

  const handleDropInstructor = async (
    dayOfWeek: number,
    hour: number,
    instructorId: string
  ) => {
    if (!session || !isScheduleEditing) return;
    setSchedulesMessage(null);
    const key = `${dayOfWeek}-${hour}`;
    const existing = scheduleBySlot[key];
    if (!existing) {
      setSchedulesMessage("Assign a class first, then add an instructor.");
      return;
    }
    if (!isInstructorQualified(instructorId, existing.class_type)) {
      setSchedulesMessage("Instructor is not qualified for this class.");
      return;
    }
    try {
      const { error } = await supabase
        .from("class_schedules")
        .update({ instructor_id: instructorId })
        .eq("id", existing.id);
      if (error) throw error;
      await loadSchedules();
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to save schedule");
    }
  };

  const clearScheduleSlot = async (scheduleId: string) => {
    if (!session || !isScheduleEditing) return;
    setSchedulesMessage(null);
    try {
      const { error } = await supabase
        .from("class_schedules")
        .delete()
        .eq("id", scheduleId);
      if (error) throw error;
      await loadSchedules();
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to clear slot");
    }
  };

  const startEditInstructor = (instructor: InstructorRecord) => {
    setEditingInstructorId(instructor.id);
    setInstructorFirstName(instructor.first_name ?? "");
    setInstructorLastName(instructor.last_name ?? "");
    setInstructorEmail(instructor.email);
  };

  const resetInstructorForm = () => {
    setEditingInstructorId(null);
    setInstructorFirstName("");
    setInstructorLastName("");
    setInstructorEmail("");
  };

  const submitInstructor = async (event: FormEvent) => {
    event.preventDefault();
    setInstructorsMessage(null);
    if (!session) {
      setInstructorsMessage("Sign in as admin to manage instructors.");
      return;
    }

    const payload = {
      first_name: instructorFirstName.trim() || null,
      last_name: instructorLastName.trim() || null,
      email: instructorEmail.trim()
    };

    try {
      if (editingInstructorId) {
        const { error } = await supabase
          .from("instructors")
          .update(payload)
          .eq("id", editingInstructorId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("instructors").insert(payload);
        if (error) throw error;
      }
      resetInstructorForm();
      await loadInstructors();
    } catch (error: any) {
      setInstructorsMessage(error?.message ?? "Failed to save instructor");
    }
  };

  const deleteInstructor = async (instructorId: string) => {
    if (!session) return;
    const confirmed = window.confirm("Delete this instructor?");
    if (!confirmed) return;
    setInstructorsMessage(null);
    try {
      const { error } = await supabase
        .from("instructors")
        .delete()
        .eq("id", instructorId);
      if (error) throw error;
      await loadInstructors();
    } catch (error: any) {
      setInstructorsMessage(error?.message ?? "Failed to delete instructor");
    }
  };

  function getInstructorLabel(instructor?: InstructorRecord | null) {
    return (
      [instructor?.first_name, instructor?.last_name].filter(Boolean).join(" ") ||
      "Unnamed"
    );
  }

  const parseStudentNumbers = (value: string) => {
    return value
      .split(/[\s,]+/)
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isFinite(item));
  };

  const filteredStudents = students.filter((student) => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return true;
    const studentDisplayName = [student.first_name, student.last_name]
      .filter(Boolean)
      .join(" ");
    return (
      String(student.student_number).includes(query) ||
      studentDisplayName.toLowerCase().includes(query) ||
      (student.email ?? "").toLowerCase().includes(query)
    );
  });

  const filteredBadgeStudents = students.filter((student) => {
    const query = badgeStudentQuery.trim().toLowerCase();
    if (!query) return true;
    const studentDisplayName = [student.first_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      String(student.student_number).includes(query) ||
      studentDisplayName.includes(query) ||
      (student.email ?? "").toLowerCase().includes(query)
    );
  });

  const isInstructorQualified = (
    instructorId: string,
    classType: ClassScheduleRecord["class_type"]
  ) => {
    if (!instructorId) return true;
    return qualifications.some(
      (item) => item.instructor_id === instructorId && item.class_type === classType
    );
  };

  return (
    <div className="app">
      <header className="header hero">
        <div className="hero-content">
          <div className="brand">
            <img className="brand-logo" src={logo} alt="Mamute MAA logo" />
            <div>
              <h1 className="brand-title">Mamute MAA</h1>
              <p className="brand-subtitle">Martial Arts Academy</p>
            </div>
          </div>
          <p className="muted hero-copy">
            Admin scheduling, profiles, and front desk check-in.
          </p>
        </div>
        {session ? (
          <button className="button secondary" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </header>

      <section className="panel">
        <h2>Admin Login</h2>
        {session ? (
          <p className="muted">Signed in as {session.user.email}</p>
        ) : (
          <form className="form" onSubmit={signIn}>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@mamutemaa.com"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
              />
            </label>
            <button className="button" type="submit">
              Sign in
            </button>
            {authMessage ? <p className="error">{authMessage}</p> : null}
          </form>
        )}
        {session && !isAdminLoading && !isAdmin ? (
          <p className="error">
            This account is not an admin. Sign out or contact the master admin.
          </p>
        ) : null}
      </section>

      {session && isAdmin ? (
        <>
          <section className="panel">
            <h2>Admin Accounts</h2>
            <p className="muted">
              Invite admins by email. They will set their password from the invite link.
            </p>
            <form className="form" onSubmit={createAdminUser}>
              <label className="field">
                <span>First Name</span>
                <input
                  className="input"
                  value={adminCreateFirstName}
                  onChange={(event) => setAdminCreateFirstName(event.target.value)}
                  placeholder="Admin first name"
                  required
                />
              </label>
              <label className="field">
                <span>Last Name</span>
                <input
                  className="input"
                  value={adminCreateLastName}
                  onChange={(event) => setAdminCreateLastName(event.target.value)}
                  placeholder="Admin last name"
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={adminCreateEmail}
                  onChange={(event) => setAdminCreateEmail(event.target.value)}
                  placeholder="admin@mamutemaa.com"
                  required
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={isAdminCreating}>
                  {isAdminCreating ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
            {adminCreateMessage ? <p className="muted">{adminCreateMessage}</p> : null}
          </section>
          <section className="panel">
            <h2>Front Desk Check-in</h2>
            <form className="form" onSubmit={submitCheckin}>
              <label className="field">
                <span>Student Number</span>
                <input
                  className="input"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="1547"
                  disabled={isCheckingIn}
                />
              </label>
              <button className="button" type="submit" disabled={isCheckingIn}>
                {isCheckingIn ? "Checking in..." : "Check in"}
              </button>
            </form>
            {checkinMessage ? <p className="error">{checkinMessage}</p> : null}
            {checkinResponse ? (
              <div className="results">
                <p className="muted">
                  Next class: {checkinResponse.schedule.classType} -{" "}
                  {checkinResponse.schedule.startTime}
                </p>
                <ul>
                  {checkinResponse.results.map((result) => (
                    <li key={result.student.studentNumber}>
                      <strong>
                        {[result.student.firstName, result.student.lastName]
                          .filter(Boolean)
                          .join(" ") || "Student"}
                      </strong>{" "}
                      (
                      {result.student.studentNumber}) -{" "}
                      {result.blocked ? result.reason ?? "Blocked" : "Checked in"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <h2>Classes</h2>
            <p className="muted">
              Weekly schedule (9am-9pm). Click edit to unlock, then drag a class into a
              timeslot.
            </p>
            <div className="form-actions">
              <button
                className={isScheduleEditing ? "button secondary" : "button"}
                type="button"
                onClick={() => setIsScheduleEditing((prev) => !prev)}
                disabled={!session}
              >
                {isScheduleEditing ? "Lock Schedule" : "Edit Schedule"}
              </button>
            </div>
            {schedulesMessage ? <p className="error">{schedulesMessage}</p> : null}
            {isSchedulesLoading ? <p className="muted">Loading schedules...</p> : null}
          <div className="schedule-layout">
            <div className="class-palette">
                <p className="muted">Available classes</p>
                <div className="chip-group">
                  {classTypes.map((type) => (
                    <div
                      key={type}
                      className="chip draggable"
                      draggable={isScheduleEditing}
                      onDragStart={(event) => {
                      event.dataTransfer.setData("type", "class");
                      event.dataTransfer.setData("value", type);
                      }}
                      style={{ backgroundColor: classTypeColors[type], borderColor: "transparent" }}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              <p className="muted" style={{ marginTop: 16 }}>
                Available instructors
              </p>
              <div className="chip-group">
                {instructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="chip draggable"
                    draggable={isScheduleEditing}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("type", "instructor");
                      event.dataTransfer.setData("value", instructor.id);
                    }}
                  >
                    {getInstructorLabel(instructor)}
                  </div>
                ))}
              </div>
              </div>
              <div className="schedule-grid">
                <div className="schedule-header">
                  <div className="time-cell" />
                  {dayOptions.map((day) => (
                    <div key={day.value} className="day-cell">
                      {day.label}
                    </div>
                  ))}
                </div>
                {timeSlots.map((hour) => (
                  <div key={hour} className="schedule-row">
                    <div className="time-cell">{formatHourLabel(hour)}</div>
                    {dayOptions.map((day) => {
                      const slotKey = `${day.value}-${hour}`;
                      const slot = scheduleBySlot[slotKey];
                      return (
                        <div
                          key={slotKey}
                          className={slot ? "slot filled" : "slot"}
                          onDragOver={(event) => {
                            if (isScheduleEditing) {
                              event.preventDefault();
                            }
                          }}
                          onDrop={(event) => {
                            if (!isScheduleEditing) return;
                          const payloadType = event.dataTransfer.getData("type");
                          const value = event.dataTransfer.getData("value");
                          if (!payloadType || !value) return;
                          if (payloadType === "class") {
                            handleDropSchedule(
                              day.value,
                              hour,
                              value as ClassScheduleRecord["class_type"]
                            );
                          }
                          if (payloadType === "instructor") {
                            handleDropInstructor(day.value, hour, value);
                          }
                          }}
                        >
                        {slot ? (
                          <div className="slot-content">
                            <div className="slot-title">
                              {slot.class_type}
                            </div>
                            <div className="slot-subtle">
                              {(() => {
                                const slotInstructor = instructors.find(
                                  (item) => item.id === slot.instructor_id
                                );
                                return slotInstructor
                                  ? getInstructorLabel(slotInstructor)
                                  : "Unassigned";
                              })()}
                            </div>
                            {isScheduleEditing ? (
                              <button
                                className="slot-clear"
                                type="button"
                                onClick={() => clearScheduleSlot(slot.id)}
                              >
                                Clear
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Mamute News</h2>
            <p className="muted">
              Publish gym news and events to the mobile app. Attachments support images and
              documents (including PDF).
            </p>
            <form className="form" onSubmit={submitNewsPost}>
              <label className="field">
                <span>Title</span>
                <input
                  className="input"
                  value={newsTitle}
                  onChange={(event) => setNewsTitle(event.target.value)}
                  placeholder="Tournament prep camp this Saturday"
                  required
                  disabled={!session || isNewsSaving}
                />
              </label>
              <label className="field" style={{ width: "100%" }}>
                <span>Description</span>
                <textarea
                  className="input"
                  rows={4}
                  value={newsDescription}
                  onChange={(event) => setNewsDescription(event.target.value)}
                  placeholder="Share details with students and guardians..."
                  required
                  disabled={!session || isNewsSaving}
                />
              </label>
              <label className="field">
                <span>Expiry (optional)</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={newsExpiresAt}
                  onChange={(event) => setNewsExpiresAt(event.target.value)}
                  disabled={!session || isNewsSaving}
                />
              </label>
              <label className="field">
                <span>Attachment (optional)</span>
                <input
                  id="mamute-news-attachment"
                  className="input"
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx,.txt"
                  onChange={onNewsAttachmentChange}
                  disabled={!session || isNewsSaving}
                />
                {newsAttachment ? (
                  <span className="helper">Selected: {newsAttachment.name}</span>
                ) : null}
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={!session || isNewsSaving}>
                  {isNewsSaving ? "Posting..." : "Post News"}
                </button>
              </div>
            </form>
            {newsMessage ? <p className="error">{newsMessage}</p> : null}
            {isNewsLoading ? <p className="muted">Loading news posts...</p> : null}
            {newsPosts.length ? (
              <div className="results">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Expires</th>
                      <th>Attachment</th>
                      <th>Posted</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {newsPosts.map((post) => (
                      <tr key={post.id}>
                        <td>
                          <strong>{post.title}</strong>
                          <div className="helper">{post.description}</div>
                        </td>
                        <td>
                          {post.expires_at ? new Date(post.expires_at).toLocaleString() : "No expiry"}
                        </td>
                        <td>{post.attachment_name ?? "-"}</td>
                        <td>{new Date(post.created_at).toLocaleString()}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => deleteNewsPost(post)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No news posts yet.</p>
            )}
          </section>

          <section className="panel">
            <h2>Badges</h2>
            <p className="muted">
              Create reward badges and assign them to students. Private assignments are visible
              only to users linked to that student, while public assignments post to everyone.
            </p>

            <div className="panel nested">
              <h3>Create Badge</h3>
              <form className="form" onSubmit={submitBadge}>
                <label className="field">
                  <span>Title</span>
                  <input
                    className="input"
                    value={badgeTitle}
                    onChange={(event) => setBadgeTitle(event.target.value)}
                    placeholder="25 Class Milestone"
                    required
                    disabled={!session || isBadgeSaving}
                  />
                </label>
                <label className="field" style={{ width: "100%" }}>
                  <span>Description</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={badgeDescription}
                    onChange={(event) => setBadgeDescription(event.target.value)}
                    placeholder="Awarded for dedicated training."
                    disabled={!session || isBadgeSaving}
                  />
                </label>
                <label className="field">
                  <span>Image (optional)</span>
                  <input
                    id="mamute-badge-image"
                    className="input"
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={onBadgeImageChange}
                    disabled={!session || isBadgeSaving}
                  />
                  {badgeImage ? (
                    <span className="helper">Selected: {badgeImage.name}</span>
                  ) : null}
                </label>
                <div className="form-actions">
                  <button className="button" type="submit" disabled={!session || isBadgeSaving}>
                    {isBadgeSaving ? "Creating..." : "Create Badge"}
                  </button>
                </div>
              </form>
              {isBadgesLoading ? <p className="muted">Loading badges...</p> : null}
              {badges.length ? (
                <div className="results">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Milestone</th>
                        <th>Image</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badges.map((badge) => (
                        <tr key={badge.id}>
                          <td>{badge.title}</td>
                          <td>{badge.description ?? "-"}</td>
                          <td>{badge.milestone_count ?? "-"}</td>
                          <td>{badge.image_name ?? "-"}</td>
                          <td>{new Date(badge.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No badges created yet.</p>
              )}
            </div>

            <div className="panel nested">
              <h3>Assign Badge</h3>
              <form className="form" onSubmit={assignBadgeToStudents}>
                <label className="field">
                  <span>Badge</span>
                  <select
                    className="input"
                    value={selectedBadgeId}
                    onChange={(event) => setSelectedBadgeId(event.target.value)}
                    disabled={!session || isBadgeAssigning}
                  >
                    <option value="">Select badge</option>
                    {badges.map((badge) => (
                      <option key={badge.id} value={badge.id}>
                        {badge.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Visibility</span>
                  <select
                    className="input"
                    value={badgeAssignVisibility}
                    onChange={(event) =>
                      setBadgeAssignVisibility(event.target.value as "private" | "public")
                    }
                    disabled={!session || isBadgeAssigning}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <label className="field">
                  <span>Search Students</span>
                  <input
                    className="input"
                    value={badgeStudentQuery}
                    onChange={(event) => setBadgeStudentQuery(event.target.value)}
                    placeholder="Search by name, student number, or email"
                    disabled={!session || isBadgeAssigning}
                  />
                </label>
                <div className="field" style={{ width: "100%" }}>
                  <span>Select one or more students</span>
                  <div className="chip-group">
                    {filteredBadgeStudents.map((student) => {
                      const checked = selectedBadgeStudentIds.includes(student.id);
                      const label =
                        [student.first_name, student.last_name].filter(Boolean).join(" ") ||
                        "Student";
                      return (
                        <button
                          key={student.id}
                          type="button"
                          className={checked ? "chip active" : "chip"}
                          onClick={() => toggleBadgeStudentSelection(student.id)}
                          disabled={!session || isBadgeAssigning}
                        >
                          {label} #{student.student_number}
                        </button>
                      );
                    })}
                  </div>
                  <span className="helper">
                    Selected: {selectedBadgeStudentIds.length} student
                    {selectedBadgeStudentIds.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="form-actions">
                  <button
                    className="button"
                    type="submit"
                    disabled={!session || isBadgeAssigning}
                  >
                    {isBadgeAssigning ? "Assigning..." : "Assign Badge"}
                  </button>
                </div>
              </form>
            </div>
            {badgesMessage ? <p className="error">{badgesMessage}</p> : null}
          </section>

          <section className="panel">
            <div>
          <h2>Students</h2>
          <p className="muted">Create, edit, and manage student profiles.</p>
          <label className="field">
            <span>Search</span>
            <input
              className="input"
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Search by name, number, or email"
              disabled={!session}
            />
          </label>
          <label className="field">
            <span>Paste CSV (optional)</span>
            <textarea
              className="input"
              rows={4}
              value={csvInput}
              onChange={(event) => setCsvInput(event.target.value)}
              placeholder="student_number,first_name,last_name,birth_date,email,membership_type,membership_standing,guardian_first_name,guardian_last_name,guardian_email"
              disabled={!session || isCsvImporting}
            />
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              onClick={importStudentsCsv}
              disabled={!session || isCsvImporting}
            >
              {isCsvImporting ? "Importing..." : "Import CSV"}
            </button>
          </div>
          <form className="form" onSubmit={submitStudent}>
            <label className="field">
              <span>Student Number</span>
              <input
                className="input"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="1547"
                required
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>First Name</span>
              <input
                className="input"
                value={studentFirstName}
                onChange={(event) => setStudentFirstName(event.target.value)}
                placeholder="Jane"
                required
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Last Name</span>
              <input
                className="input"
                value={studentLastName}
                onChange={(event) => setStudentLastName(event.target.value)}
                placeholder="Doe"
                required
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Birthday</span>
              <input
                className="input"
                type="date"
                value={studentBirthDate}
                onChange={(event) => setStudentBirthDate(event.target.value)}
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                value={studentEmail}
                onChange={(event) => setStudentEmail(event.target.value)}
                placeholder="student@example.com"
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Membership Type</span>
              <select
                className="input"
                value={studentMembershipType}
                onChange={(event) =>
                  setStudentMembershipType(
                    event.target.value as StudentRecord["membership_type"]
                  )
                }
                disabled={!session}
              >
                {membershipTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Membership Standing</span>
              <select
                className="input"
                value={studentMembershipStanding}
                onChange={(event) =>
                  setStudentMembershipStanding(
                    event.target.value as StudentRecord["membership_standing"]
                  )
                }
                disabled={!session}
              >
                {membershipStandings.map((standing) => (
                  <option key={standing} value={standing}>
                    {standing}
                  </option>
                ))}
              </select>
            </label>
            <div className="field" style={{ width: "100%" }}>
              <span className="muted">Guardians</span>
              {!editingStudentId ? (
                <p className="muted">
                  Add one or more guardians before saving the student.
                </p>
              ) : null}
              <div className="form">
                <label className="field">
                  <span>Guardian First Name</span>
                  <input
                    className="input"
                    value={guardianFirstName}
                    onChange={(event) => setGuardianFirstName(event.target.value)}
                    placeholder="First name"
                  />
                </label>
                <label className="field">
                  <span>Guardian Last Name</span>
                  <input
                    className="input"
                    value={guardianLastName}
                    onChange={(event) => setGuardianLastName(event.target.value)}
                    placeholder="Last name"
                  />
                </label>
                <label className="field">
                  <span>Guardian Email</span>
                  <input
                    className="input"
                    value={guardianEmail}
                    onChange={(event) => setGuardianEmail(event.target.value)}
                    placeholder="parent@example.com"
                  />
                </label>
                <div className="form-actions">
                  <button className="button" type="button" onClick={addGuardian}>
                    Add Guardian
                  </button>
                </div>
              </div>
              {guardianMessage ? <p className="error">{guardianMessage}</p> : null}
              {isGuardianLoading ? (
                <p className="muted">Loading guardians...</p>
              ) : null}
              {editingStudentId ? (
                guardianRows.length ? (
                  <div className="results">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Guardian</th>
                          <th>Email</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {guardianRows.map((guardian) => {
                          const guardianLabel = [
                            guardian.guardian_first_name,
                            guardian.guardian_last_name
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <tr key={guardian.id}>
                              <td>{guardianLabel || "-"}</td>
                              <td>{guardian.guardian_email}</td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => removeGuardian(guardian.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">No guardians added yet.</p>
                )
              ) : pendingGuardians.length ? (
                <div className="results">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Guardian</th>
                        <th>Email</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pendingGuardians.map((guardian) => {
                        const guardianLabel = [
                          guardian.guardian_first_name,
                          guardian.guardian_last_name
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <tr key={guardian.id}>
                            <td>{guardianLabel || "-"}</td>
                            <td>{guardian.guardian_email}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => removePendingGuardian(guardian.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No guardians added yet.</p>
              )}
            </div>
            <div className="form-actions">
              <button className="button" type="submit" disabled={!session}>
                {editingStudentId ? "Update Student" : "Add Student"}
              </button>
              {editingStudentId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetStudentForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {studentsMessage ? <p className="error">{studentsMessage}</p> : null}
          {isStudentsLoading ? <p className="muted">Loading students...</p> : null}
          {filteredStudents.length ? (
            <div className="results">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Birthday</th>
                    <th>Age</th>
                    <th>Type</th>
                    <th>Standing</th>
                    <th>Guardian #1</th>
                    <th>Guardian #2</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.student_number}</td>
                      <td>
                        {[student.first_name, student.last_name].filter(Boolean).join(" ") ||
                          "-"}
                      </td>
                      <td>{student.birth_date ?? "-"}</td>
                      <td>{calculateAgeFromBirthDate(student.birth_date) ?? "-"}</td>
                      <td>{student.membership_type}</td>
                      <td>{student.membership_standing}</td>
                      <td>
                        {(() => {
                          const guardians = allGuardianRows.filter(
                            (guardian) => guardian.student_id === student.id
                          );
                          const firstGuardian = guardians[0];
                          const guardianLabel = firstGuardian
                            ? [
                                firstGuardian.guardian_first_name,
                                firstGuardian.guardian_last_name
                              ]
                                .filter(Boolean)
                                .join(" ")
                            : "";
                          return guardianLabel || "-";
                        })()}
                      </td>
                      <td>
                        {(() => {
                          const guardians = allGuardianRows.filter(
                            (guardian) => guardian.student_id === student.id
                          );
                          const extraGuardian = guardians[1];
                          const guardianLabel = extraGuardian
                            ? [
                                extraGuardian.guardian_first_name,
                                extraGuardian.guardian_last_name
                              ]
                                .filter(Boolean)
                                .join(" ")
                            : "";
                          return guardianLabel || "-";
                        })()}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => startEditStudent(student)}
                          >
                            Edit
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => deleteStudent(student.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No students yet.</p>
          )}
            </div>
          </section>

          <section className="panel">
            <div>
          <h2>Instructors</h2>
          <p className="muted">Manage instructor records.</p>
          <form className="form" onSubmit={submitInstructor}>
            <label className="field">
              <span>First Name</span>
              <input
                className="input"
                value={instructorFirstName}
                onChange={(event) => setInstructorFirstName(event.target.value)}
                placeholder="Coach first name"
                required
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Last Name</span>
              <input
                className="input"
                value={instructorLastName}
                onChange={(event) => setInstructorLastName(event.target.value)}
                placeholder="Coach last name"
                required
                disabled={!session}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={instructorEmail}
                onChange={(event) => setInstructorEmail(event.target.value)}
                placeholder="coach@example.com"
                required
                disabled={!session}
              />
            </label>
            <div className="form-actions">
              <button className="button" type="submit" disabled={!session}>
                {editingInstructorId ? "Update Instructor" : "Add Instructor"}
              </button>
              {editingInstructorId ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetInstructorForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {instructorsMessage ? <p className="error">{instructorsMessage}</p> : null}
          {isInstructorsLoading ? <p className="muted">Loading instructors...</p> : null}
          {instructors.length ? (
            <div className="results">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((instructor) => (
                    <tr key={instructor.id}>
                      <td>{getInstructorLabel(instructor)}</td>
                      <td>{instructor.email}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => selectInstructorQualifications(instructor.id)}
                          >
                            Qualifications
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => startEditInstructor(instructor)}
                          >
                            Edit
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => deleteInstructor(instructor.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No instructors yet.</p>
          )}
          <div className="panel nested">
            <h3>Qualifications</h3>
            <p className="muted">
              Select an instructor, then choose the class types they can teach.
            </p>
            <label className="field">
              <span>Instructor</span>
              <select
                className="input"
                value={selectedInstructorId}
                onChange={(event) => selectInstructorQualifications(event.target.value)}
                disabled={!session}
              >
                <option value="">Select instructor</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {getInstructorLabel(instructor)}
                  </option>
                ))}
              </select>
            </label>
            <div className="chip-group">
              {classTypes.map((type) => {
                const checked = selectedQualifications.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={checked ? "chip active" : "chip"}
                    onClick={() => toggleQualification(type)}
                    disabled={!session || !selectedInstructorId}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            <div className="form-actions">
              <button className="button" type="button" onClick={saveQualifications}>
                Save Qualifications
              </button>
            </div>
            {qualificationsMessage ? (
              <p className="error">{qualificationsMessage}</p>
            ) : null}
            {isQualificationsLoading ? (
              <p className="muted">Loading qualifications...</p>
            ) : null}
          </div>
            </div>
          </section>

          <section className="panel">
            <h2>Attendance</h2>
            <p className="muted">Most recent check-ins.</p>
            {attendanceMessage ? <p className="error">{attendanceMessage}</p> : null}
            {isAttendanceLoading ? <p className="muted">Loading attendance...</p> : null}
            {attendanceRows.length ? (
              <div className="results">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((row) => {
                      const student = Array.isArray(row.students)
                        ? row.students[0]
                        : row.students;
                      const schedule = Array.isArray(row.class_schedules)
                        ? row.class_schedules[0]
                        : row.class_schedules;
                      const studentDisplayName = student
                        ? [student.first_name, student.last_name].filter(Boolean).join(" ")
                        : "";
                      const studentLabel = student
                        ? `${studentDisplayName || "Student"} (#${student.student_number})`
                        : "Unknown";
                      const classLabel = schedule
                        ? `${dayOptions.find((d) => d.value === schedule.day_of_week)?.label ?? ""} ${schedule.start_time} - ${schedule.class_type}`
                        : "N/A";
                      return (
                        <tr key={row.id}>
                          <td>{new Date(row.scanned_at).toLocaleString()}</td>
                          <td>{studentLabel}</td>
                          <td>{classLabel}</td>
                          <td>{row.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No attendance yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function calculateAgeFromBirthDate(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const parsed = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDelta = today.getMonth() - parsed.getMonth();
  const dayDelta = today.getDate() - parsed.getDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

