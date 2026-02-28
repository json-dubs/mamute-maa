import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
  class_type: string;
};

type ClassScheduleRecord = {
  id: string;
  class_type: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
};

type ClassCatalogRecord = {
  id: string;
  name: string;
  created_at: string;
};

type ScheduleExceptionRecord = {
  id: string;
  schedule_id: string;
  occurrence_date: string;
  created_at: string;
};

type ScheduleDragPayload =
  | {
      type: "class" | "instructor";
      value: string;
    }
  | null;

type AttendanceStudent = {
  first_name: string | null;
  last_name: string | null;
  student_number: number;
};

type AttendanceSchedule = {
  class_type: string;
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

type AdminTab =
  | "frontdesk"
  | "students"
  | "instructors"
  | "classes"
  | "news"
  | "badges"
  | "attendance"
  | "settings";

const adminTabs: { id: AdminTab; label: string }[] = [
  { id: "frontdesk", label: "Front Desk" },
  { id: "students", label: "Students" },
  { id: "instructors", label: "Instructors" },
  { id: "classes", label: "Classes" },
  { id: "news", label: "Mamute News" },
  { id: "badges", label: "Badges" },
  { id: "attendance", label: "Attendance" },
  { id: "settings", label: "Settings" }
];

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
  const [selectedCheckinScheduleId, setSelectedCheckinScheduleId] = useState("");
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinResponse, setCheckinResponse] = useState<CheckInResponse | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinNow, setCheckinNow] = useState(() => Date.now());

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
  const [classCatalog, setClassCatalog] = useState<ClassCatalogRecord[]>([]);
  const [scheduleExceptions, setScheduleExceptions] = useState<ScheduleExceptionRecord[]>([]);
  const [draftSchedules, setDraftSchedules] = useState<ClassScheduleRecord[]>([]);
  const [draftScheduleExceptions, setDraftScheduleExceptions] = useState<
    ScheduleExceptionRecord[]
  >([]);
  const [schedulesMessage, setSchedulesMessage] = useState<string | null>(null);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);
  const [isScheduleEditing, setIsScheduleEditing] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [classCatalogMessage, setClassCatalogMessage] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState("");
  const [scheduleDragPayload, setScheduleDragPayload] = useState<ScheduleDragPayload>(null);
  const [selectedSchedulePayload, setSelectedSchedulePayload] = useState<ScheduleDragPayload>(null);
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
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [previewBadge, setPreviewBadge] = useState<BadgeRecord | null>(null);
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
  const [activeTab, setActiveTab] = useState<AdminTab>("frontdesk");

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
    const interval = window.setInterval(() => {
      setCheckinNow(Date.now());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const actualNextOccurrenceBySchedule = useMemo(() => {
    const now = new Date();
    return new Map(
      schedules.map((schedule) => [schedule.id, getNextOccurrenceDate(schedule, now)])
    );
  }, [schedules]);

  const actualCancelledNextOccurrenceIds = useMemo(() => {
    const keys = new Set(
      scheduleExceptions.map((item) => `${item.schedule_id}:${item.occurrence_date}`)
    );
    return new Set(
      schedules
        .filter((schedule) => {
          const occurrenceDate = actualNextOccurrenceBySchedule.get(schedule.id);
          if (!occurrenceDate) return false;
          return keys.has(`${schedule.id}:${occurrenceDate}`);
        })
        .map((schedule) => schedule.id)
    );
  }, [actualNextOccurrenceBySchedule, scheduleExceptions, schedules]);

  const workingSchedules = isScheduleEditing ? draftSchedules : schedules;
  const workingScheduleExceptions = isScheduleEditing
    ? draftScheduleExceptions
    : scheduleExceptions;

  const nextOccurrenceBySchedule = useMemo(() => {
    const now = new Date();
    return new Map(
      workingSchedules.map((schedule) => [schedule.id, getNextOccurrenceDate(schedule, now)])
    );
  }, [workingSchedules]);

  const cancelledNextOccurrenceIds = useMemo(() => {
    const keys = new Set(
      workingScheduleExceptions.map((item) => `${item.schedule_id}:${item.occurrence_date}`)
    );
    return new Set(
      workingSchedules
        .filter((schedule) => {
          const occurrenceDate = nextOccurrenceBySchedule.get(schedule.id);
          if (!occurrenceDate) return false;
          return keys.has(`${schedule.id}:${occurrenceDate}`);
        })
        .map((schedule) => schedule.id)
    );
  }, [nextOccurrenceBySchedule, workingScheduleExceptions, workingSchedules]);

  const eligibleFrontdeskSchedules = useMemo(() => {
    const now = new Date(checkinNow);
    return schedules
      .filter(
        (schedule) =>
          schedule.is_active && !actualCancelledNextOccurrenceIds.has(schedule.id)
      )
      .map((schedule) => ({
        schedule,
        delta: minutesUntilSchedule(schedule, now)
      }))
      .filter((item) => item.delta >= -30 && item.delta <= 4 * 60)
      .sort((a, b) => a.delta - b.delta)
      .map((item) => item.schedule);
  }, [actualCancelledNextOccurrenceIds, checkinNow, schedules]);

  useEffect(() => {
    if (!eligibleFrontdeskSchedules.length) {
      setSelectedCheckinScheduleId("");
      return;
    }

    if (
      !selectedCheckinScheduleId ||
      !eligibleFrontdeskSchedules.some((schedule) => schedule.id === selectedCheckinScheduleId)
    ) {
      setSelectedCheckinScheduleId(eligibleFrontdeskSchedules[0].id);
    }
  }, [eligibleFrontdeskSchedules, selectedCheckinScheduleId]);

  const beginScheduleEditing = () => {
    setSchedulesMessage(null);
    setDraftSchedules(schedules.map((item) => ({ ...item })));
    setDraftScheduleExceptions(scheduleExceptions.map((item) => ({ ...item })));
    setScheduleDragPayload(null);
    setSelectedSchedulePayload(null);
    setIsScheduleEditing(true);
  };

  const cancelScheduleEditing = () => {
    setDraftSchedules([]);
    setDraftScheduleExceptions([]);
    setSchedulesMessage(null);
    setScheduleDragPayload(null);
    setSelectedSchedulePayload(null);
    setIsScheduleEditing(false);
  };

  const saveScheduleDraft = async () => {
    if (!session) return;
    setSchedulesMessage(null);
    setIsScheduleSaving(true);

    const currentById = new Map(schedules.map((item) => [item.id, item]));
    const draftRealIds = new Set(
      draftSchedules.filter((item) => !isDraftId(item.id)).map((item) => item.id)
    );
    const draftIdMap = new Map<string, string>();

    try {
      for (const schedule of draftSchedules) {
        const payload = {
          class_type: schedule.class_type,
          instructor_id: schedule.instructor_id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          timezone: schedule.timezone,
          is_active: schedule.is_active
        };

        if (isDraftId(schedule.id)) {
          const { data, error } = await supabase
            .from("class_schedules")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          if (data?.id) {
            draftIdMap.set(schedule.id, data.id);
          }
          continue;
        }

        const current = currentById.get(schedule.id);
        if (!current) continue;

        if (
          current.class_type !== schedule.class_type ||
          current.instructor_id !== schedule.instructor_id ||
          current.day_of_week !== schedule.day_of_week ||
          current.start_time !== schedule.start_time ||
          current.end_time !== schedule.end_time ||
          current.timezone !== schedule.timezone ||
          current.is_active !== schedule.is_active
        ) {
          const { error } = await supabase
            .from("class_schedules")
            .update(payload)
            .eq("id", schedule.id);
          if (error) throw error;
        }
      }

      for (const schedule of schedules) {
        if (!draftRealIds.has(schedule.id)) {
          const { error } = await supabase
            .from("class_schedules")
            .delete()
            .eq("id", schedule.id);
          if (error) throw error;
        }
      }

      const normalizedDraftExceptions = draftScheduleExceptions.map((item) => ({
        ...item,
        schedule_id: draftIdMap.get(item.schedule_id) ?? item.schedule_id
      }));

      const currentExceptionKeys = new Map(
        scheduleExceptions.map((item) => [`${item.schedule_id}:${item.occurrence_date}`, item])
      );
      const draftExceptionKeys = new Set(
        normalizedDraftExceptions.map((item) => `${item.schedule_id}:${item.occurrence_date}`)
      );

      for (const item of normalizedDraftExceptions) {
        const key = `${item.schedule_id}:${item.occurrence_date}`;
        if (currentExceptionKeys.has(key)) continue;
        const { error } = await supabase.from("class_schedule_exceptions").insert({
          schedule_id: item.schedule_id,
          occurrence_date: item.occurrence_date
        });
        if (error) throw error;
      }

      for (const item of scheduleExceptions) {
        const key = `${item.schedule_id}:${item.occurrence_date}`;
        if (!draftExceptionKeys.has(key)) {
          const { error } = await supabase
            .from("class_schedule_exceptions")
            .delete()
            .eq("id", item.id);
          if (error) throw error;
        }
      }

      await Promise.all([loadSchedules(), loadScheduleExceptions()]);
      setDraftSchedules([]);
      setDraftScheduleExceptions([]);
      setScheduleDragPayload(null);
      setSelectedSchedulePayload(null);
      setIsScheduleEditing(false);
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to save schedule changes");
    } finally {
      setIsScheduleSaving(false);
    }
  };

  const toggleScheduleEditing = async () => {
    if (!isScheduleEditing) {
      beginScheduleEditing();
      return;
    }
    await saveScheduleDraft();
  };

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
      loadClassCatalog();
      loadScheduleExceptions();
      loadQualifications();
      loadAttendance();
      loadAllGuardians();
      loadNews();
      loadBadges();
    } else {
      setStudents([]);
      setInstructors([]);
      setSchedules([]);
      setClassCatalog([]);
      setScheduleExceptions([]);
      setDraftSchedules([]);
      setDraftScheduleExceptions([]);
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
              scheduleId: selectedCheckinScheduleId || undefined,
              source: "frontdesk",
              deviceId: "windows-admin"
            }
          : {
              barcode,
              scheduleId: selectedCheckinScheduleId || undefined,
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

  const toggleQualification = (value: string) => {
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

  const loadClassCatalog = async () => {
    setClassCatalogMessage(null);
    try {
      const { data, error } = await supabase
        .from("class_catalog")
        .select("id, name, created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setClassCatalog((data as ClassCatalogRecord[]) ?? []);
    } catch (error: any) {
      setClassCatalog([]);
      const message = typeof error?.message === "string" ? error.message : "";
      if (!message.toLowerCase().includes("class_catalog")) {
        setClassCatalogMessage(message || "Failed to load class names");
      }
    }
  };

  const loadScheduleExceptions = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);

      const { data, error } = await supabase
        .from("class_schedule_exceptions")
        .select("id, schedule_id, occurrence_date, created_at")
        .gte("occurrence_date", startDate.toISOString().slice(0, 10))
        .lte("occurrence_date", endDate.toISOString().slice(0, 10))
        .order("occurrence_date", { ascending: true });
      if (error) throw error;
      setScheduleExceptions((data as ScheduleExceptionRecord[]) ?? []);
    } catch {
      setScheduleExceptions([]);
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

  const resetBadgeForm = () => {
    setEditingBadgeId(null);
    setBadgeTitle("");
    setBadgeDescription("");
    setBadgeImage(null);
    const fileInput = document.getElementById("mamute-badge-image") as
      | HTMLInputElement
      | null;
    if (fileInput) fileInput.value = "";
  };

  const startEditBadge = (badge: BadgeRecord) => {
    setEditingBadgeId(badge.id);
    setBadgeTitle(badge.title);
    setBadgeDescription(badge.description ?? "");
    setBadgeImage(null);
    const fileInput = document.getElementById("mamute-badge-image") as
      | HTMLInputElement
      | null;
    if (fileInput) fileInput.value = "";
  };

  const deleteBadge = async (badge: BadgeRecord) => {
    if (!session) return;
    if (badge.milestone_count !== null) {
      setBadgesMessage("Automatic milestone badges are managed by the system and cannot be deleted here.");
      return;
    }
    const confirmed = window.confirm(
      `Delete the "${badge.title}" badge? This also removes its student badge assignments.`
    );
    if (!confirmed) return;

    setBadgesMessage(null);
    try {
      if (badge.image_path) {
        await supabase.storage.from(badgesBucket).remove([badge.image_path]);
      }
      const { error } = await supabase.from("badges").delete().eq("id", badge.id);
      if (error) throw error;

      if (selectedBadgeId === badge.id) {
        setSelectedBadgeId("");
      }
      if (editingBadgeId === badge.id) {
        resetBadgeForm();
      }
      if (previewBadge?.id === badge.id) {
        setPreviewBadge(null);
      }
      await loadBadges();
    } catch (error: any) {
      setBadgesMessage(error?.message ?? "Failed to delete badge");
    }
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

    const existingBadge = editingBadgeId
      ? badges.find((item) => item.id === editingBadgeId) ?? null
      : null;
    let imagePath: string | null = existingBadge?.image_path ?? null;
    let imageName: string | null = existingBadge?.image_name ?? null;
    let imageMimeType: string | null = existingBadge?.image_mime_type ?? null;
    let uploadedReplacementPath: string | null = null;

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
        uploadedReplacementPath = path;
        imageName = badgeImage.name;
        imageMimeType = badgeImage.type || null;
      }

      const payload = {
        title,
        description: badgeDescription.trim() || null,
        image_path: imagePath,
        image_name: imageName,
        image_mime_type: imageMimeType
      };

      const { error } = editingBadgeId
        ? await supabase.from("badges").update(payload).eq("id", editingBadgeId)
        : await supabase.from("badges").insert({
            ...payload,
            created_by: session.user.id
          });
      if (error) throw error;

      if (
        editingBadgeId &&
        uploadedReplacementPath &&
        existingBadge?.image_path &&
        existingBadge.image_path !== uploadedReplacementPath
      ) {
        await supabase.storage.from(badgesBucket).remove([existingBadge.image_path]);
      }

      resetBadgeForm();
      await loadBadges();
    } catch (error: any) {
      if (uploadedReplacementPath) {
        await supabase.storage.from(badgesBucket).remove([uploadedReplacementPath]);
      }
      setBadgesMessage(
        error?.message ?? (editingBadgeId ? "Failed to update badge" : "Failed to create badge")
      );
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

  const scheduleBySlot = workingSchedules.reduce<Record<string, ClassScheduleRecord>>(
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

  const paletteClasses = classCatalog.length
    ? classCatalog
    : [...new Set(schedules.map((schedule) => schedule.class_type))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({
          id: `derived-${name}`,
          name,
          created_at: ""
        }));

  const resetClassEdit = () => {
    setEditingClassId(null);
    setEditingClassName("");
    setNewClassName("");
  };

  const startEditClass = (item: ClassCatalogRecord) => {
    setEditingClassId(item.id);
    setEditingClassName(item.name);
    setNewClassName("");
  };

  const submitClassCatalog = async (event: FormEvent) => {
    event.preventDefault();
    setClassCatalogMessage(null);
    if (!session) {
      setClassCatalogMessage("Sign in as admin to manage class names.");
      return;
    }

    const targetName = (editingClassId ? editingClassName : newClassName).trim();
    if (!targetName) {
      setClassCatalogMessage("Enter a class name.");
      return;
    }

    try {
      if (editingClassId) {
        const existing = classCatalog.find((item) => item.id === editingClassId);
        if (!existing) {
          setClassCatalogMessage("Class name was not found.");
          return;
        }

        const { error: updateCatalogError } = await supabase
          .from("class_catalog")
          .update({ name: targetName })
          .eq("id", editingClassId);
        if (updateCatalogError) throw updateCatalogError;

        if (existing.name !== targetName) {
          const { error: scheduleRenameError } = await supabase
            .from("class_schedules")
            .update({ class_type: targetName })
            .eq("class_type", existing.name);
          if (scheduleRenameError) throw scheduleRenameError;

          const { error: qualificationRenameError } = await supabase
            .from("instructor_qualifications")
            .update({ class_type: targetName })
            .eq("class_type", existing.name);
          if (qualificationRenameError) throw qualificationRenameError;
        }
      } else {
        const { error } = await supabase.from("class_catalog").insert({
          name: targetName
        });
        if (error) throw error;
      }

      resetClassEdit();
      await loadClassCatalog();
      await loadSchedules();
      await loadQualifications();
    } catch (error: any) {
      setClassCatalogMessage(error?.message ?? "Failed to save class name");
    }
  };

  const deleteClassCatalogItem = async (item: ClassCatalogRecord) => {
    if (!session) return;
    if (schedules.some((schedule) => schedule.class_type === item.name)) {
      setClassCatalogMessage("Remove this class from the schedule before deleting its name.");
      return;
    }
    const confirmed = window.confirm(`Delete "${item.name}" from the class menu?`);
    if (!confirmed) return;
    setClassCatalogMessage(null);
    try {
      const { error } = await supabase.from("class_catalog").delete().eq("id", item.id);
      if (error) throw error;
      if (editingClassId === item.id) {
        resetClassEdit();
      }
      await loadClassCatalog();
    } catch (error: any) {
      setClassCatalogMessage(error?.message ?? "Failed to delete class name");
    }
  };

  const handleScheduleDragStart = (
    event: DragEvent<HTMLDivElement>,
    payload: NonNullable<ScheduleDragPayload>
  ) => {
    if (!isScheduleEditing) return;
    setScheduleDragPayload(payload);
    event.dataTransfer.effectAllowed = "copy";
    const serializedPayload = JSON.stringify(payload);
    event.dataTransfer.setData("text/plain", serializedPayload);
    try {
      event.dataTransfer.setData("application/x-mamute-schedule", serializedPayload);
    } catch {
      // Tauri/WebView drag support can vary; the in-memory payload remains the fallback.
    }
  };

  const clearScheduleDragPayload = () => {
    setScheduleDragPayload(null);
  };

  const applySchedulePayload = (
    dayOfWeek: number,
    hour: number,
    payload: NonNullable<ScheduleDragPayload>
  ) => {
    if (payload.type === "class") {
      void handleDropSchedule(
        dayOfWeek,
        hour,
        payload.value as ClassScheduleRecord["class_type"]
      );
    }
    if (payload.type === "instructor") {
      void handleDropInstructor(dayOfWeek, hour, payload.value);
    }
  };

  const readScheduleDragPayload = (
    event: DragEvent<HTMLDivElement>
  ): NonNullable<ScheduleDragPayload> | null => {
    const transferData =
      event.dataTransfer.getData("application/x-mamute-schedule") ||
      event.dataTransfer.getData("text/plain");
    if (transferData) {
      try {
        const parsed = JSON.parse(transferData) as ScheduleDragPayload;
        if (
          parsed &&
          (parsed.type === "class" || parsed.type === "instructor") &&
          typeof parsed.value === "string" &&
          parsed.value
        ) {
          return parsed;
        }
      } catch {
        // Fall back to the React state payload below.
      }
    }

    return scheduleDragPayload;
  };

  const handleDropSchedule = async (
    dayOfWeek: number,
    hour: number,
    classType: string
  ) => {
    if (!session || !isScheduleEditing) return;
    setSchedulesMessage(null);
    const key = `${dayOfWeek}-${hour}`;
    const existing = scheduleBySlot[key];
    setDraftSchedules((prev) => {
      if (existing?.id) {
        return prev.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                class_type: classType,
                day_of_week: dayOfWeek,
                start_time: `${String(hour).padStart(2, "0")}:00`,
                end_time: `${String(hour + 1).padStart(2, "0")}:00`
              }
            : item
        );
      }

      return [
        ...prev,
        {
          id: `draft-${crypto.randomUUID()}`,
          class_type: classType,
          instructor_id: null,
          day_of_week: dayOfWeek,
          start_time: `${String(hour).padStart(2, "0")}:00`,
          end_time: `${String(hour + 1).padStart(2, "0")}:00`,
          timezone: defaultTimezone,
          is_active: true
        }
      ];
    });
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
    setDraftSchedules((prev) =>
      prev.map((item) =>
        item.id === existing.id ? { ...item, instructor_id: instructorId } : item
      )
    );
  };

  const clearScheduleSlot = async (scheduleId: string) => {
    if (!session || !isScheduleEditing) return;
    setSchedulesMessage(null);
    setDraftSchedules((prev) => prev.filter((item) => item.id !== scheduleId));
    setDraftScheduleExceptions((prev) =>
      prev.filter((item) => item.schedule_id !== scheduleId)
    );
  };

  const toggleNextOccurrenceCancellation = async (schedule: ClassScheduleRecord) => {
    if (!session || !isScheduleEditing) return;
    const occurrenceDate = nextOccurrenceBySchedule.get(schedule.id);
    if (!occurrenceDate) {
      setSchedulesMessage("Could not determine the next occurrence for this class.");
      return;
    }

    setSchedulesMessage(null);
    setDraftScheduleExceptions((prev) => {
      const draftExisting = prev.find(
        (item) =>
          item.schedule_id === schedule.id && item.occurrence_date === occurrenceDate
      );
      if (draftExisting) {
        return prev.filter((item) => item.id !== draftExisting.id);
      }
      return [
        ...prev,
        {
          id: `draft-${crypto.randomUUID()}`,
          schedule_id: schedule.id,
          occurrence_date: occurrenceDate,
          created_at: new Date().toISOString()
        }
      ];
    });
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

  const previewBadgeUrl = previewBadge?.image_path
    ? supabase.storage.from(badgesBucket).getPublicUrl(previewBadge.image_path).data.publicUrl
    : null;

  const isInstructorQualified = (
    instructorId: string,
    classType: string
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
          <nav className="tabbar">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "tabbar-button active" : "tabbar-button"}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "settings" ? (
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
          ) : null}
          {activeTab === "frontdesk" ? (
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
              <label className="field">
                <span>Class</span>
                <select
                  className="input"
                  value={selectedCheckinScheduleId}
                  onChange={(event) => setSelectedCheckinScheduleId(event.target.value)}
                  disabled={isCheckingIn || !eligibleFrontdeskSchedules.length}
                >
                  {eligibleFrontdeskSchedules.length ? (
                    eligibleFrontdeskSchedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {formatFrontdeskScheduleOption(schedule, checkinNow)}
                      </option>
                    ))
                  ) : (
                    <option value="">No classes available in next 4 hours</option>
                  )}
                </select>
              </label>
              <button
                className="button"
                type="submit"
                disabled={isCheckingIn || !eligibleFrontdeskSchedules.length}
              >
                {isCheckingIn ? "Checking in..." : "Check in"}
              </button>
            </form>
            <p className="muted">
              Select the current class or any active class starting in the next 4 hours.
              Late front desk check-in remains available for 30 minutes after class start.
            </p>
            {checkinMessage ? <p className="error">{checkinMessage}</p> : null}
            {checkinResponse ? (
              <div className="results">
                <p className="muted">
                  Checked into: {checkinResponse.schedule.classType} -{" "}
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
          ) : null}

          {activeTab === "classes" ? (
          <section className="panel">
            <h2>Classes</h2>
            <p className="muted">
              Create class names for the drag menu, then place them onto the weekly grid.
              Cancellation now applies only to the next occurrence and resets automatically
              after that class has passed.
            </p>
            <div className="form-actions">
              <button
                className={isScheduleEditing ? "button secondary" : "button"}
                type="button"
                onClick={() => void toggleScheduleEditing()}
                disabled={!session || isScheduleSaving}
              >
                {isScheduleEditing
                  ? isScheduleSaving
                    ? "Saving..."
                    : "Save & Lock Schedule"
                  : "Edit Schedule"}
              </button>
              {isScheduleEditing ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={cancelScheduleEditing}
                  disabled={isScheduleSaving}
                >
                  Discard Draft
                </button>
              ) : null}
            </div>
            <form className="form" onSubmit={submitClassCatalog}>
              <label className="field">
                <span>{editingClassId ? "Edit Class Name" : "New Class Name"}</span>
                <input
                  className="input"
                  value={editingClassId ? editingClassName : newClassName}
                  onChange={(event) =>
                    editingClassId
                      ? setEditingClassName(event.target.value)
                      : setNewClassName(event.target.value)
                  }
                  placeholder="Competition Team"
                  disabled={!session}
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={!session}>
                  {editingClassId ? "Save Name" : "Add Class Name"}
                </button>
                {editingClassId ? (
                  <button className="button secondary" type="button" onClick={resetClassEdit}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
            {classCatalogMessage ? <p className="error">{classCatalogMessage}</p> : null}
            {schedulesMessage ? <p className="error">{schedulesMessage}</p> : null}
            {isSchedulesLoading ? <p className="muted">Loading schedules...</p> : null}
            <div className="schedule-layout">
              <div className="class-palette">
                <p className="muted">Available classes</p>
                <div className="chip-group">
                  {paletteClasses.map((item) => (
                    <div
                      key={item.id}
                      className={`chip draggable${
                        selectedSchedulePayload?.type === "class" &&
                        selectedSchedulePayload.value === item.name
                          ? " active"
                          : ""
                      }`}
                      draggable={isScheduleEditing}
                      onDragStart={(event) =>
                        handleScheduleDragStart(event, {
                          type: "class",
                          value: item.name
                        })
                      }
                      onDragEnd={clearScheduleDragPayload}
                      onClick={() => {
                        if (!isScheduleEditing) return;
                        setSelectedSchedulePayload((current) =>
                          current?.type === "class" && current.value === item.name
                            ? null
                            : { type: "class", value: item.name }
                        );
                      }}
                      style={{
                        backgroundColor: getClassColor(item.name),
                        borderColor:
                          selectedSchedulePayload?.type === "class" &&
                          selectedSchedulePayload.value === item.name
                            ? "#f5f5f5"
                            : "transparent",
                        boxShadow:
                          selectedSchedulePayload?.type === "class" &&
                          selectedSchedulePayload.value === item.name
                            ? "0 0 0 2px rgba(255,255,255,0.15)"
                            : "none"
                      }}
                    >
                      <span>{item.name}</span>
                      {!item.id.startsWith("derived-") ? (
                        <span className="chip-inline-actions">
                          <button
                            className="chip-mini-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditClass(item);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="chip-mini-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteClassCatalogItem(item);
                            }}
                          >
                            Delete
                          </button>
                        </span>
                      ) : null}
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
                    className={`chip draggable${
                      selectedSchedulePayload?.type === "instructor" &&
                      selectedSchedulePayload.value === instructor.id
                        ? " active"
                        : ""
                    }`}
                    draggable={isScheduleEditing}
                    onDragStart={(event) =>
                      handleScheduleDragStart(event, {
                        type: "instructor",
                        value: instructor.id
                      })
                    }
                    onDragEnd={clearScheduleDragPayload}
                    onClick={() => {
                      if (!isScheduleEditing) return;
                      setSelectedSchedulePayload((current) =>
                        current?.type === "instructor" && current.value === instructor.id
                          ? null
                          : { type: "instructor", value: instructor.id }
                      );
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
                          className={
                            slot
                              ? `slot filled${
                                  isNextOccurrenceCancelled(slot, cancelledNextOccurrenceIds)
                                    ? " cancelled"
                                    : ""
                                }`
                              : "slot"
                          }
                          onDragOver={(event) => {
                            if (isScheduleEditing) {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "copy";
                            }
                          }}
                          onDrop={(event) => {
                            if (!isScheduleEditing) return;
                            event.preventDefault();
                            const payload = readScheduleDragPayload(event);
                            clearScheduleDragPayload();
                            if (!payload) return;
                            applySchedulePayload(day.value, hour, payload);
                          }}
                          onClick={() => {
                            if (!isScheduleEditing || !selectedSchedulePayload) return;
                            applySchedulePayload(day.value, hour, selectedSchedulePayload);
                          }}
                        >
                        {slot ? (
                          <div className="slot-content">
                            <div className="slot-title">
                              {formatDisplayLabel(slot.class_type)}
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
                            <button
                              className={
                                isNextOccurrenceCancelled(slot, cancelledNextOccurrenceIds)
                                  ? "slot-status-toggle cancelled"
                                  : "slot-status-toggle"
                              }
                              type="button"
                              disabled={!isScheduleEditing}
                              onClick={() => toggleNextOccurrenceCancellation(slot)}
                            >
                              {getNextOccurrenceStatusLabel(
                                slot,
                                cancelledNextOccurrenceIds,
                                nextOccurrenceBySchedule
                              )}
                            </button>
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
          ) : null}

          {activeTab === "news" ? (
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
          ) : null}

          {activeTab === "badges" ? (
          <section className="panel">
            <h2>Badges</h2>
            <p className="muted">
              Create reward badges and assign them to students. Private assignments are visible
              only to users linked to that student, while public assignments post to everyone.
            </p>

            <div className="panel nested">
              <h3>{editingBadgeId ? "Edit Badge" : "Create Badge"}</h3>
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
                  ) : editingBadgeId ? (
                    <span className="helper">Keep current file or choose a replacement.</span>
                  ) : null}
                </label>
                {editingBadgeId ? (
                  <div className="field">
                    <span>Current Image</span>
                    {(() => {
                      const currentBadge = badges.find((item) => item.id === editingBadgeId);
                      if (!currentBadge?.image_path) {
                        return <span className="helper">No image attached.</span>;
                      }
                      const currentImageUrl = supabase.storage
                        .from(badgesBucket)
                        .getPublicUrl(currentBadge.image_path).data.publicUrl;
                      const isImage = (currentBadge.image_mime_type ?? "").startsWith("image/");
                      return (
                        <div className="badge-file-preview">
                          {isImage ? (
                            <img
                              className="badge-thumb"
                              src={currentImageUrl}
                              alt={currentBadge.title}
                            />
                          ) : null}
                          <div className="badge-file-meta">
                            <span className="helper">{currentBadge.image_name ?? "Stored file"}</span>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => setPreviewBadge(currentBadge)}
                            >
                              Preview File
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                <div className="form-actions">
                  <button className="button" type="submit" disabled={!session || isBadgeSaving}>
                    {isBadgeSaving
                      ? editingBadgeId
                        ? "Saving..."
                        : "Creating..."
                      : editingBadgeId
                        ? "Save Badge"
                        : "Create Badge"}
                  </button>
                  {editingBadgeId ? (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={resetBadgeForm}
                      disabled={isBadgeSaving}
                    >
                      Cancel
                    </button>
                  ) : null}
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {badges.map((badge) => (
                        <tr key={badge.id}>
                          <td>{badge.title}</td>
                          <td>{badge.description ?? "-"}</td>
                          <td>{badge.milestone_count ?? "-"}</td>
                          <td>
                            {badge.image_path ? (
                              <div className="badge-file-preview compact">
                                {(badge.image_mime_type ?? "").startsWith("image/") ? (
                                  <img
                                    className="badge-thumb compact"
                                    src={
                                      supabase.storage.from(badgesBucket).getPublicUrl(badge.image_path)
                                        .data.publicUrl
                                    }
                                    alt={badge.title}
                                  />
                                ) : null}
                                <div className="badge-file-meta">
                                  <span className="helper">{badge.image_name ?? "Stored file"}</span>
                                  <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => setPreviewBadge(badge)}
                                  >
                                    Preview
                                  </button>
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>{new Date(badge.created_at).toLocaleString()}</td>
                          <td>
                            {badge.milestone_count === null ? (
                              <div className="row-actions">
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => startEditBadge(badge)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => void deleteBadge(badge)}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="helper">Automatic milestone badge</span>
                            )}
                          </td>
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
            {previewBadge ? (
              <div className="modal-backdrop" onClick={() => setPreviewBadge(null)}>
                <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <h3>{previewBadge.title}</h3>
                      <p className="muted">{previewBadge.image_name ?? "Stored file"}</p>
                    </div>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setPreviewBadge(null)}
                    >
                      Close
                    </button>
                  </div>
                  {previewBadgeUrl && (previewBadge.image_mime_type ?? "").startsWith("image/") ? (
                    <img className="badge-preview-image" src={previewBadgeUrl} alt={previewBadge.title} />
                  ) : previewBadgeUrl ? (
                    <iframe
                      className="badge-preview-frame"
                      src={previewBadgeUrl}
                      title={previewBadge.title}
                    />
                  ) : (
                    <p className="muted">No preview available for this badge.</p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
          ) : null}

          {activeTab === "students" ? (
          <section className="panel">
            <div className="section-header">
          <div className="section-copy">
          <h2>Students</h2>
          <p className="muted">Create, edit, and manage student profiles.</p>
          </div>
          <label className="field section-search">
            <span>Search</span>
            <input
              className="input"
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Search by name, number, or email"
              disabled={!session}
            />
          </label>
          </div>
          <div className="panel nested utility-panel">
            <h3>Import Utilities</h3>
            <p className="muted">
              Use CSV import for bulk student creation. Keep day-to-day edits in the main form below.
            </p>
            <label className="field utility-field">
              <span>Paste CSV</span>
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
          </section>
          ) : null}

          {activeTab === "instructors" ? (
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
              {paletteClasses.map((item) => {
                const type = item.name;
                const checked = selectedQualifications.includes(type);
                return (
                  <button
                    key={item.id}
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
          ) : null}

          {activeTab === "attendance" ? (
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
          ) : null}
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

function getClassColor(className: string) {
  const palette = [
    "#1d4ed8",
    "#7c3aed",
    "#15803d",
    "#c2410c",
    "#b91c1c",
    "#0369a1",
    "#a21caf",
    "#be123c"
  ];
  const seed = className
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function isNextOccurrenceCancelled(
  schedule: ClassScheduleRecord,
  cancelledIds: Set<string>
) {
  return cancelledIds.has(schedule.id);
}

function getNextOccurrenceStatusLabel(
  schedule: ClassScheduleRecord,
  cancelledIds: Set<string>,
  occurrenceMap: Map<string, string>
) {
  const occurrenceDate = occurrenceMap.get(schedule.id);
  const base = cancelledIds.has(schedule.id) ? "Next: Cancelled" : "Next: Active";
  return occurrenceDate ? `${base} (${occurrenceDate})` : base;
}

function getNextOccurrenceDate(schedule: ClassScheduleRecord, now: Date) {
  const timezone = safeTimeZone(schedule.timezone || "America/Toronto");
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.start_time);
  let dayOffset = schedule.day_of_week - nowDay;

  if (dayOffset < 0 || (dayOffset === 0 && startMinutes < nowMinutes)) {
    dayOffset += 7;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10);
  const month =
    Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "1", 10) - 1;
  const day = Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "1", 10);

  const baseDate = new Date(Date.UTC(year, month, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
  return baseDate.toISOString().slice(0, 10);
}

function formatFrontdeskScheduleOption(
  schedule: ClassScheduleRecord,
  nowTimestamp: number
) {
  const now = new Date(nowTimestamp);
  const delta = minutesUntilSchedule(schedule, now);
  const dayLabel = delta < 24 * 60
    ? "Today"
    : dayOptions.find((day) => day.value === schedule.day_of_week)?.label ?? "Upcoming";
  const statusLabel =
    delta < 0
      ? `Late check-in (${Math.abs(delta)} min after start)`
      : delta === 0
        ? "Starts now"
        : `Starts in ${delta} min`;

  return `${dayLabel} ${schedule.start_time} - ${formatDisplayLabel(schedule.class_type)} - ${statusLabel}`;
}

function formatDisplayLabel(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function minutesUntilSchedule(schedule: ClassScheduleRecord, now: Date) {
  const timezone = safeTimeZone(schedule.timezone || "America/Toronto");
  const nowDay = getDayOfWeek(now, timezone);
  const nowMinutes = getMinutesOfDay(now, timezone);
  const startMinutes = timeToMinutes(schedule.start_time);
  let delta = (schedule.day_of_week - nowDay) * 24 * 60 + (startMinutes - nowMinutes);
  if (delta < -30) {
    delta += 7 * 24 * 60;
  }
  return delta;
}

function getDayOfWeek(date: Date, timezone: string) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[label] ?? 0;
}

function getMinutesOfDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(
    parts.find((part) => part.type === "minute")?.value ?? "0",
    10
  );
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((chunk) => Number.parseInt(chunk, 10));
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function isDraftId(value: string) {
  return value.startsWith("draft-");
}

function safeTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "America/Toronto";
  }
}

