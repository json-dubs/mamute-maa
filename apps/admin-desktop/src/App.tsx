import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import headerImage from "../../student-app/assets/images/MamuteLogoHeader.png";

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
  schedule_id?: string | null;
  scanned_at: string;
  source: string;
  students?: AttendanceStudent | AttendanceStudent[] | null;
  class_schedules?: AttendanceSchedule | AttendanceSchedule[] | null;
};

type AttendanceClassAverage = {
  classType: string;
  checkIns: number;
  sessions: number;
  averagePerSession: number;
};

type AttendanceDayStat = {
  dayOfWeek: number;
  dayLabel: string;
  checkIns: number;
};

type AttendanceStudentStat = {
  studentNumber: number;
  studentName: string;
  checkIns: number;
};

type AttendanceSourceStat = {
  source: string;
  checkIns: number;
  percentage: number;
};

type AttendanceSummary = {
  totalCheckIns: number;
  uniqueStudents: number;
  uniqueClasses: number;
  checkInsPerStudentAverage: number;
  mostPopularClassType: string;
  leastPopularClassType: string;
  classAverages: AttendanceClassAverage[];
  busiestWeekdays: AttendanceDayStat[];
  slowestWeekdays: AttendanceDayStat[];
  peakHourWindow: string;
  topStudents: AttendanceStudentStat[];
  sourceBreakdown: AttendanceSourceStat[];
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

type ShopMerchandiseType =
  | "uniform"
  | "shirt"
  | "pants"
  | "shorts"
  | "accessory"
  | "training";

type ShopMerchandiseSex = "male" | "female" | "unisex";

type ShopMerchandiseSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

type ShopMerchandiseRecord = {
  id: string;
  name: string;
  description: string;
  item_type: ShopMerchandiseType;
  sex: ShopMerchandiseSex;
  sizes: ShopMerchandiseSize[];
  image_path: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

const shopItemTypeOptions: { value: ShopMerchandiseType; label: string }[] = [
  { value: "uniform", label: "Uniform" },
  { value: "shirt", label: "Shirt" },
  { value: "pants", label: "Pants" },
  { value: "shorts", label: "Shorts" },
  { value: "accessory", label: "Accessory" },
  { value: "training", label: "Training" }
];

const shopSexOptions: { value: ShopMerchandiseSex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unisex", label: "Unisex" }
];

const shopSizeOptions: ShopMerchandiseSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

const newsBucket = "mamute-news";
const badgesBucket = "mamute-badges";
const shopBucket = "mamute-shop";

type AdminTab =
  | "frontdesk"
  | "students"
  | "instructors"
  | "classes"
  | "news"
  | "shop"
  | "badges"
  | "attendance"
  | "settings";

const adminTabs: { id: AdminTab; label: string }[] = [
  { id: "frontdesk", label: "Front Desk" },
  { id: "students", label: "Students" },
  { id: "instructors", label: "Instructors" },
  { id: "classes", label: "Classes" },
  { id: "news", label: "Mamute News" },
  { id: "shop", label: "Shop" },
  { id: "badges", label: "Badges" },
  { id: "attendance", label: "Attendance" },
  { id: "settings", label: "Settings" }
];

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isInviteMode, setIsInviteMode] = useState(false);
  const [isInviteInitializing, setIsInviteInitializing] = useState(false);
  const [isInviteSaving, setIsInviteSaving] = useState(false);
  const [invitePassword, setInvitePassword] = useState("");
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
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
  const [attendanceStartDate, setAttendanceStartDate] = useState(() =>
    formatDateInput(getRelativeDate(-6))
  );
  const [attendanceEndDate, setAttendanceEndDate] = useState(() =>
    formatDateInput(new Date())
  );
  const [attendanceReportLabel, setAttendanceReportLabel] = useState<string | null>(null);

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
  const [shopItems, setShopItems] = useState<ShopMerchandiseRecord[]>([]);
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopItemType, setShopItemType] = useState<ShopMerchandiseType>("uniform");
  const [shopSex, setShopSex] = useState<ShopMerchandiseSex>("unisex");
  const [shopSizes, setShopSizes] = useState<ShopMerchandiseSize[]>([]);
  const [shopImage, setShopImage] = useState<File | null>(null);
  const [editingShopItemId, setEditingShopItemId] = useState<string | null>(null);
  const [previewShopItem, setPreviewShopItem] = useState<ShopMerchandiseRecord | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [isShopLoading, setIsShopLoading] = useState(false);
  const [isShopSaving, setIsShopSaving] = useState(false);
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
    const initializeInviteFlow = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const inviteType = hashParams.get("type") ?? searchParams.get("type");
      const code = searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const shouldHandleInvite =
        inviteType === "invite" ||
        inviteType === "recovery" ||
        Boolean(code) ||
        (Boolean(accessToken) && Boolean(refreshToken));

      if (!shouldHandleInvite) return;

      setIsInviteMode(true);
      setIsInviteInitializing(true);
      setInviteMessage("Validating invite link...");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) throw error;
        }

        setInviteMessage("Set your password to finish admin account setup.");
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error: any) {
        setInviteMessage(error?.message ?? "Invite link is invalid or expired.");
      } finally {
        setIsInviteInitializing(false);
      }
    };

    void initializeInviteFlow();
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    if (isInviteSetupRequired(session)) {
      setIsInviteMode(true);
      if (!inviteMessage) {
        setInviteMessage("Set your password and contact number to finish account setup.");
      }
    }
  }, [session, inviteMessage]);

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
    const scheduleChangeAnnouncements: Array<{ title: string; body: string }> = [];

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
            const dayLabel =
              dayOptions.find((option) => option.value === schedule.day_of_week)?.label ??
              "Scheduled day";
            scheduleChangeAnnouncements.push({
              title: "New class added",
              body: `${formatDisplayLabel(schedule.class_type)} added on ${dayLabel} ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}.`
            });
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

          const onlyStatusChanged =
            current.class_type === schedule.class_type &&
            current.instructor_id === schedule.instructor_id &&
            current.day_of_week === schedule.day_of_week &&
            current.start_time === schedule.start_time &&
            current.end_time === schedule.end_time &&
            current.timezone === schedule.timezone &&
            current.is_active !== schedule.is_active;

          if (onlyStatusChanged) {
            scheduleChangeAnnouncements.push({
              title: schedule.is_active ? "Class reactivated" : "Class cancelled",
              body: `${formatDisplayLabel(schedule.class_type)} is now ${
                schedule.is_active ? "active" : "cancelled"
              } on the class schedule.`
            });
          } else {
            const previousDay =
              dayOptions.find((option) => option.value === current.day_of_week)?.label ??
              "Unknown day";
            const nextDay =
              dayOptions.find((option) => option.value === schedule.day_of_week)?.label ??
              "Updated day";
            scheduleChangeAnnouncements.push({
              title: "Class schedule updated",
              body: `${formatDisplayLabel(schedule.class_type)} moved from ${previousDay} ${current.start_time.slice(0, 5)}-${current.end_time.slice(0, 5)} to ${nextDay} ${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}.`
            });
          }
        }
      }

      for (const schedule of schedules) {
        if (!draftRealIds.has(schedule.id)) {
          const { error } = await supabase
            .from("class_schedules")
            .delete()
            .eq("id", schedule.id);
          if (error) throw error;
          scheduleChangeAnnouncements.push({
            title: "Class removed",
            body: `${formatDisplayLabel(schedule.class_type)} was removed from the schedule.`
          });
        }
      }

      const normalizedDraftExceptions = draftScheduleExceptions.map((item) => ({
        ...item,
        schedule_id: draftIdMap.get(item.schedule_id) ?? item.schedule_id
      }));
      const normalizedScheduleById = new Map(
        draftSchedules.map((item) => [draftIdMap.get(item.id) ?? item.id, item])
      );

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
        const schedule = normalizedScheduleById.get(item.schedule_id);
        if (schedule) {
          scheduleChangeAnnouncements.push({
            title: "Class cancellation",
            body: `${formatDisplayLabel(schedule.class_type)} on ${item.occurrence_date} (${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}) has been cancelled.`
          });
        }
      }

      for (const item of scheduleExceptions) {
        const key = `${item.schedule_id}:${item.occurrence_date}`;
        if (!draftExceptionKeys.has(key)) {
          const { error } = await supabase
            .from("class_schedule_exceptions")
            .delete()
            .eq("id", item.id);
          if (error) throw error;
          const schedule =
            normalizedScheduleById.get(item.schedule_id) ??
            schedules.find((entry) => entry.id === item.schedule_id);
          if (schedule) {
            scheduleChangeAnnouncements.push({
              title: "Class reactivated",
              body: `${formatDisplayLabel(schedule.class_type)} on ${item.occurrence_date} is active again.`
            });
          }
        }
      }

      const uniqueAnnouncements = [
        ...new Map(
          scheduleChangeAnnouncements.map((item) => [
            `${item.title}::${item.body}`,
            {
              title: item.title,
              body: truncateNotificationBody(item.body)
            }
          ])
        ).values()
      ].slice(0, 8);
      if (uniqueAnnouncements.length) {
        for (const announcement of uniqueAnnouncements) {
          const { error: pushError } = await supabase.functions.invoke("sendNotification", {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              id: crypto.randomUUID(),
              title: announcement.title,
              body: announcement.body,
              target: {}
            }
          });
          if (pushError) throw pushError;
        }
      }

      await Promise.all([loadSchedules(), loadScheduleExceptions()]);
      setDraftSchedules([]);
      setDraftScheduleExceptions([]);
      setScheduleDragPayload(null);
      setSelectedSchedulePayload(null);
      setIsScheduleEditing(false);
    } catch (error: any) {
      setSchedulesMessage(error?.message ?? "Failed to save schedule changes or send push notification");
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
      loadAttendance({
        startDate: formatDateInput(getRelativeDate(-6)),
        endDate: formatDateInput(new Date())
      });
      loadAllGuardians();
      loadNews();
      loadShopMerchandise();
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
      setShopItems([]);
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

  const completeInviteSetup = async (event: FormEvent) => {
    event.preventDefault();
    setInviteMessage(null);

    if (invitePassword.length < 8) {
      setInviteMessage("Password must be at least 8 characters.");
      return;
    }

    if (invitePassword !== invitePasswordConfirm) {
      setInviteMessage("Passwords do not match.");
      return;
    }

    const phone = invitePhone.trim();
    if (!phone) {
      setInviteMessage("Contact phone number is required.");
      return;
    }

    if (!session) {
      setInviteMessage("Invite session missing. Please open the invite link again.");
      return;
    }

    setIsInviteSaving(true);
    try {
      const existing = session.user.user_metadata ?? {};
      const displayName =
        (typeof existing.display_name === "string" && existing.display_name.trim()) ||
        [existing.first_name, existing.last_name]
          .filter((item) => typeof item === "string" && item.trim())
          .join(" ")
          .trim() ||
        session.user.email?.split("@")[0] ||
        "Admin";

      const { error } = await supabase.auth.updateUser({
        password: invitePassword,
        data: {
          ...existing,
          display_name: displayName,
          contact_phone: phone,
          invited_setup_required: false
        }
      });
      if (error) throw error;

      setInvitePassword("");
      setInvitePasswordConfirm("");
      setInvitePhone("");
      setInviteMessage("Account setup complete.");
      setIsInviteMode(false);
    } catch (error: any) {
      setInviteMessage(error?.message ?? "Failed to set password.");
    } finally {
      setIsInviteSaving(false);
    }
  };

  const createAdminUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setAdminCreateMessage(null);
    setIsAdminCreating(true);
    try {
      const redirectTo =
        (import.meta.env.VITE_ADMIN_INVITE_REDIRECT_URL as string | undefined)?.trim() ||
        undefined;
      const { data, error } = await supabase.functions.invoke("createAdminUser", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          firstName: adminCreateFirstName.trim(),
          lastName: adminCreateLastName.trim(),
          email: adminCreateEmail.trim(),
          redirectTo
        }
      });
      if (error) throw error;
      setAdminCreateFirstName("");
      setAdminCreateLastName("");
      setAdminCreateEmail("");
      const result = (data ?? {}) as {
        delivery?: "email" | "manual_link";
        inviteLink?: string | null;
      };
      if (result.delivery === "manual_link" && result.inviteLink) {
        setAdminCreateMessage(
          `Email send limit reached. Share this invite link manually: ${result.inviteLink}`
        );
      } else {
        setAdminCreateMessage("Invite sent. They will set their password by email.");
      }
    } catch (error: any) {
      const status = error?.context?.status ? `status ${error.context.status}` : null;
      const details = await getFunctionInvokeErrorMessage(error);
      const parts = [error?.message ?? "Failed to create admin", status, details].filter(Boolean);
      setAdminCreateMessage(parts.join(": "));
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

  const loadAttendance = async ({
    startDate,
    endDate,
    limit
  }: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}) => {
    setAttendanceMessage(null);
    setIsAttendanceLoading(true);
    try {
      let query = supabase
        .from("attendance")
        .select(
          "id, schedule_id, scanned_at, source, students:student_id(first_name, last_name, student_number), class_schedules:schedule_id(class_type, day_of_week, start_time)"
        )
        .order("scanned_at", { ascending: false });

      if (startDate) {
        query = query.gte("scanned_at", toStartOfDayIso(startDate));
      }

      if (endDate) {
        query = query.lt("scanned_at", toEndExclusiveIso(endDate));
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAttendanceRows((data as unknown as AttendanceRecord[]) ?? []);
      setAttendanceReportLabel(getAttendanceRangeLabel(startDate, endDate));
    } catch (error: any) {
      setAttendanceMessage(error?.message ?? "Failed to load attendance");
    } finally {
      setIsAttendanceLoading(false);
    }
  };

  const runAttendanceReport = async () => {
    if (!attendanceStartDate || !attendanceEndDate) {
      setAttendanceMessage("Select both a start date and end date.");
      return;
    }

    if (attendanceStartDate > attendanceEndDate) {
      setAttendanceMessage("Start date must be on or before end date.");
      return;
    }

    await loadAttendance({
      startDate: attendanceStartDate,
      endDate: attendanceEndDate
    });
  };

  const resetAttendanceReport = async () => {
    const defaultStart = formatDateInput(getRelativeDate(-6));
    const defaultEnd = formatDateInput(new Date());
    setAttendanceStartDate(defaultStart);
    setAttendanceEndDate(defaultEnd);
    await loadAttendance({
      startDate: defaultStart,
      endDate: defaultEnd
    });
  };

  const printAttendanceReport = () => {
    if (!attendanceRows.length) {
      setAttendanceMessage("Run a report with results before printing.");
      return;
    }

    const summary = buildAttendanceSummary(attendanceRows);
    const rowsHtml = attendanceRows
      .map((row) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const schedule = Array.isArray(row.class_schedules)
          ? row.class_schedules[0]
          : row.class_schedules;
        const studentDisplayName = student
          ? [student.first_name, student.last_name].filter(Boolean).join(" ")
          : "";
        const studentLabel = student
          ? `${escapeHtml(studentDisplayName || "Student")} (#${student.student_number})`
          : "Unknown";
        const classLabel = schedule
          ? `${escapeHtml(dayOptions.find((d) => d.value === schedule.day_of_week)?.label ?? "")} ${escapeHtml(schedule.start_time)} - ${escapeHtml(formatDisplayLabel(schedule.class_type))}`
          : "N/A";

        return `<tr>
          <td>${escapeHtml(new Date(row.scanned_at).toLocaleString())}</td>
          <td>${studentLabel}</td>
          <td>${classLabel}</td>
          <td>${escapeHtml(capitalizeLabel(row.source))}</td>
        </tr>`;
      })
      .join("");
    const classAverageRowsHtml = summary.classAverages
      .slice(0, 8)
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.classType)}</td>
          <td>${item.checkIns}</td>
          <td>${item.sessions}</td>
          <td>${item.averagePerSession.toFixed(2)}</td>
        </tr>`
      )
      .join("");
    const topStudentsHtml = summary.topStudents.length
      ? summary.topStudents
          .map(
            (student) =>
              `<li>${escapeHtml(student.studentName)} (#${student.studentNumber}) - ${student.checkIns} check-ins</li>`
          )
          .join("")
      : "<li>No attendance records in this range.</li>";
    const sourceBreakdownHtml = summary.sourceBreakdown.length
      ? summary.sourceBreakdown
          .map(
            (source) =>
              `<li>${escapeHtml(source.source)} - ${source.checkIns} (${source.percentage.toFixed(1)}%)</li>`
          )
          .join("")
      : "<li>No source data available.</li>";
    const busiestWeekdaysHtml = summary.busiestWeekdays.length
      ? summary.busiestWeekdays
          .map((day) => `${escapeHtml(day.dayLabel)} (${day.checkIns})`)
          .join(", ")
      : "No weekday check-ins in this range.";
    const slowestWeekdaysHtml = summary.slowestWeekdays.length
      ? summary.slowestWeekdays
          .map((day) => `${escapeHtml(day.dayLabel)} (${day.checkIns})`)
          .join(", ")
      : "No weekday check-ins in this range.";

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      setAttendanceMessage("Failed to open print preview.");
      return;
    }

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Mamute Attendance Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              margin: 32px;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 28px;
            }
            p {
              margin: 0 0 10px;
              line-height: 1.4;
            }
            .meta {
              color: #4b5563;
              margin-bottom: 18px;
            }
            .summary {
              display: flex;
              gap: 18px;
              flex-wrap: wrap;
              margin: 18px 0 20px;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              border-radius: 10px;
              padding: 12px 14px;
              min-width: 140px;
            }
            .summary-label {
              display: block;
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 4px;
            }
            .summary-value {
              font-size: 24px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            .analytics {
              margin-top: 18px;
              margin-bottom: 18px;
            }
            .analytics h2 {
              margin: 0 0 8px;
              font-size: 18px;
            }
            .analytics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
              gap: 12px;
            }
            .analytics-card {
              border: 1px solid #d1d5db;
              border-radius: 10px;
              padding: 12px;
            }
            .analytics-card h3 {
              margin: 0 0 8px;
              font-size: 14px;
            }
            .analytics-card p {
              margin: 0 0 6px;
              font-size: 13px;
            }
            .analytics-card ul {
              margin: 0;
              padding-left: 16px;
            }
            .analytics-card li {
              margin-bottom: 4px;
              font-size: 13px;
            }
            .mini-table th, .mini-table td {
              font-size: 12px;
              padding: 6px 4px;
            }
            th, td {
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
              padding: 10px 8px;
              font-size: 13px;
              vertical-align: top;
            }
            th {
              color: #374151;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
          </style>
        </head>
        <body>
          <h1>Mamute Attendance Report</h1>
          <p class="meta">${escapeHtml(attendanceReportLabel ?? "Custom range")} | Generated ${escapeHtml(new Date().toLocaleString())}</p>
          <div class="summary">
            <div class="summary-card">
              <span class="summary-label">Check-ins</span>
              <span class="summary-value">${summary.totalCheckIns}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Students</span>
              <span class="summary-value">${summary.uniqueStudents}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Classes</span>
              <span class="summary-value">${summary.uniqueClasses}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Avg / Student</span>
              <span class="summary-value">${summary.checkInsPerStudentAverage.toFixed(2)}</span>
            </div>
          </div>
          <div class="analytics">
            <h2>Attendance Insights</h2>
            <div class="analytics-grid">
              <section class="analytics-card">
                <h3>Class Performance</h3>
                <p><strong>Most popular:</strong> ${escapeHtml(summary.mostPopularClassType)}</p>
                <p><strong>Least popular:</strong> ${escapeHtml(summary.leastPopularClassType)}</p>
                <table class="mini-table">
                  <thead>
                    <tr>
                      <th>Class Type</th>
                      <th>Check-ins</th>
                      <th>Sessions</th>
                      <th>Avg / Session</th>
                    </tr>
                  </thead>
                  <tbody>${classAverageRowsHtml}</tbody>
                </table>
              </section>
              <section class="analytics-card">
                <h3>Day and Time Patterns</h3>
                <p><strong>Busiest weekdays:</strong> ${busiestWeekdaysHtml}</p>
                <p><strong>Slowest weekdays:</strong> ${slowestWeekdaysHtml}</p>
                <p><strong>Peak check-in hour:</strong> ${escapeHtml(summary.peakHourWindow)}</p>
              </section>
              <section class="analytics-card">
                <h3>Student and Channel Trends</h3>
                <p><strong>Top students:</strong></p>
                <ul>${topStudentsHtml}</ul>
                <p><strong>Source breakdown:</strong></p>
                <ul>${sourceBreakdownHtml}</ul>
              </section>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Student</th>
                <th>Class</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  const exportAttendanceReportCsv = () => {
    if (!attendanceRows.length) {
      setAttendanceMessage("Run a report with results before exporting.");
      return;
    }

    const csvRows = attendanceRows.map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const schedule = Array.isArray(row.class_schedules)
        ? row.class_schedules[0]
        : row.class_schedules;
      const studentDisplayName = student
        ? [student.first_name, student.last_name].filter(Boolean).join(" ")
        : "";

      return {
        scannedAt: new Date(row.scanned_at).toLocaleString(),
        studentName: studentDisplayName || "Student",
        studentNumber: student?.student_number ? String(student.student_number) : "",
        classDay: schedule
          ? dayOptions.find((d) => d.value === schedule.day_of_week)?.label ?? ""
          : "",
        classTime: schedule?.start_time ?? "",
        className: schedule ? formatDisplayLabel(schedule.class_type) : "",
        source: capitalizeLabel(row.source)
      };
    });

    const csv = [
      ["Report Range", attendanceReportLabel ?? "Custom range"],
      ["Generated At", new Date().toLocaleString()],
      [],
      [
        "Check-ins",
        String(attendanceSummary.totalCheckIns),
        "Students",
        String(attendanceSummary.uniqueStudents),
        "Classes",
        String(attendanceSummary.uniqueClasses),
        "Avg / Student",
        attendanceSummary.checkInsPerStudentAverage.toFixed(2)
      ],
      [],
      ["Most Popular Class Type", attendanceSummary.mostPopularClassType],
      ["Least Popular Class Type", attendanceSummary.leastPopularClassType],
      [
        "Busiest Weekdays (Mon-Fri)",
        attendanceSummary.busiestWeekdays.length
          ? attendanceSummary.busiestWeekdays
              .map((day) => `${day.dayLabel} (${day.checkIns})`)
              .join("; ")
          : "No weekday check-ins"
      ],
      [
        "Slowest Weekdays (Mon-Fri)",
        attendanceSummary.slowestWeekdays.length
          ? attendanceSummary.slowestWeekdays
              .map((day) => `${day.dayLabel} (${day.checkIns})`)
              .join("; ")
          : "No weekday check-ins"
      ],
      ["Peak Check-in Hour", attendanceSummary.peakHourWindow],
      [],
      ["Class Averages by Class Type"],
      ["Class Type", "Check-ins", "Sessions", "Avg / Session"],
      ...attendanceSummary.classAverages.map((item) => [
        item.classType,
        String(item.checkIns),
        String(item.sessions),
        item.averagePerSession.toFixed(2)
      ]),
      [],
      ["Top Students"],
      ["Student", "Student Number", "Check-ins"],
      ...attendanceSummary.topStudents.map((student) => [
        student.studentName,
        String(student.studentNumber),
        String(student.checkIns)
      ]),
      [],
      ["Source Breakdown"],
      ["Source", "Check-ins", "Share (%)"],
      ...attendanceSummary.sourceBreakdown.map((source) => [
        source.source,
        String(source.checkIns),
        source.percentage.toFixed(1)
      ]),
      [],
      ["Detailed Check-ins"],
      [
        "Scanned At",
        "Student Name",
        "Student Number",
        "Class Day",
        "Class Time",
        "Class Name",
        "Source"
      ],
      ...csvRows.map((row) => [
        row.scannedAt,
        row.studentName,
        row.studentNumber,
        row.classDay,
        row.classTime,
        row.className,
        row.source
      ])
    ]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mamute-attendance-${attendanceStartDate || "start"}-to-${attendanceEndDate || "end"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sendOverduePushNotifications = async (studentId: string) => {
    if (!session?.access_token) return;
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
        const { error: pushError } = await supabase.functions.invoke("sendNotification", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            id: crypto.randomUUID(),
            title: "Payment Required",
            body: "Hey there, we noticed you are behind on membership payment. Please make payment at your earliest convenience to help us keep running smoothly. If you believe this notification is in error, please contact us.",
            target: { profileId: userId }
          }
        });
        if (pushError) throw pushError;
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
    let pushDispatchFailed = false;

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

      try {
        const { error: pushError } = await supabase.functions.invoke("sendNotification", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            id: crypto.randomUUID(),
            title,
            body: truncateNotificationBody(description),
            target: {}
          }
        });
        if (pushError) throw pushError;
      } catch (pushError) {
        pushDispatchFailed = true;
        const pushErrorMessage = await getFunctionInvokeErrorMessage(pushError);
        console.warn("Failed to dispatch news push notification", pushError);
        setNewsMessage(
          `News post created, but push notification delivery failed: ${pushErrorMessage}`
        );
      }

      setNewsTitle("");
      setNewsDescription("");
      setNewsExpiresAt("");
      setNewsAttachment(null);
      const newsFileInput = document.getElementById("mamute-news-attachment") as
        | HTMLInputElement
        | null;
      if (newsFileInput) newsFileInput.value = "";
      await loadNews();
      if (!pushDispatchFailed) {
        setNewsMessage("News post created and push notification sent.");
      }
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

  const loadShopMerchandise = async () => {
    setShopMessage(null);
    setIsShopLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_merchandise")
        .select(
          "id, name, description, item_type, sex, sizes, image_path, image_name, image_mime_type, is_active, created_by, created_at, updated_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const normalized = ((data as any[] | null) ?? []).map((row) => ({
        ...row,
        sizes: Array.isArray(row.sizes) ? row.sizes : []
      })) as ShopMerchandiseRecord[];
      setShopItems(normalized);
    } catch (error: any) {
      setShopMessage(error?.message ?? "Failed to load merchandise.");
    } finally {
      setIsShopLoading(false);
    }
  };

  const onShopImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setShopImage(file);
  };

  const toggleShopSize = (size: ShopMerchandiseSize) => {
    setShopSizes((previous) =>
      previous.includes(size) ? previous.filter((entry) => entry !== size) : [...previous, size]
    );
  };

  const resetShopForm = () => {
    setEditingShopItemId(null);
    setShopName("");
    setShopDescription("");
    setShopItemType("uniform");
    setShopSex("unisex");
    setShopSizes([]);
    setShopImage(null);
    const fileInput = document.getElementById("mamute-shop-image") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  };

  const startEditShopItem = (item: ShopMerchandiseRecord) => {
    setEditingShopItemId(item.id);
    setShopName(item.name);
    setShopDescription(item.description);
    setShopItemType(item.item_type);
    setShopSex(item.sex);
    setShopSizes(item.sizes ?? []);
    setShopImage(null);
    const fileInput = document.getElementById("mamute-shop-image") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  };

  const deleteShopItem = async (item: ShopMerchandiseRecord) => {
    if (!session) return;
    const confirmed = window.confirm(`Delete "${item.name}" from the shop?`);
    if (!confirmed) return;
    setShopMessage(null);
    try {
      if (item.image_path) {
        await supabase.storage.from(shopBucket).remove([item.image_path]);
      }
      const { error } = await supabase.from("shop_merchandise").delete().eq("id", item.id);
      if (error) throw error;

      if (editingShopItemId === item.id) {
        resetShopForm();
      }
      if (previewShopItem?.id === item.id) {
        setPreviewShopItem(null);
      }
      await loadShopMerchandise();
    } catch (error: any) {
      setShopMessage(error?.message ?? "Failed to delete merchandise.");
    }
  };

  const submitShopItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) {
      setShopMessage("Sign in as admin to manage shop merchandise.");
      return;
    }

    const trimmedName = shopName.trim();
    const trimmedDescription = shopDescription.trim();
    if (!trimmedName || !trimmedDescription) {
      setShopMessage("Name and description are required.");
      return;
    }
    if (!shopSizes.length) {
      setShopMessage("Select at least one available size.");
      return;
    }

    setIsShopSaving(true);
    setShopMessage(null);

    const existingItem = editingShopItemId
      ? shopItems.find((item) => item.id === editingShopItemId) ?? null
      : null;
    let imagePath: string | null = existingItem?.image_path ?? null;
    let imageName: string | null = existingItem?.image_name ?? null;
    let imageMimeType: string | null = existingItem?.image_mime_type ?? null;
    let uploadedReplacementPath: string | null = null;

    try {
      if (shopImage) {
        const extension = shopImage.name.includes(".") ? shopImage.name.split(".").pop() : "";
        const filename = `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
        const path = `catalog/${new Date().toISOString().slice(0, 10)}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from(shopBucket)
          .upload(path, shopImage, {
            upsert: false,
            contentType: shopImage.type || undefined
          });
        if (uploadError) throw uploadError;
        imagePath = path;
        imageName = shopImage.name;
        imageMimeType = shopImage.type || null;
        uploadedReplacementPath = path;
      }

      const payload = {
        name: trimmedName,
        description: trimmedDescription,
        item_type: shopItemType,
        sex: shopSex,
        sizes: shopSizes,
        image_path: imagePath,
        image_name: imageName,
        image_mime_type: imageMimeType,
        is_active: true
      };

      const { error } = editingShopItemId
        ? await supabase.from("shop_merchandise").update(payload).eq("id", editingShopItemId)
        : await supabase.from("shop_merchandise").insert({
            ...payload,
            created_by: session.user.id
          });
      if (error) throw error;

      if (
        editingShopItemId &&
        uploadedReplacementPath &&
        existingItem?.image_path &&
        existingItem.image_path !== uploadedReplacementPath
      ) {
        await supabase.storage.from(shopBucket).remove([existingItem.image_path]);
      }

      resetShopForm();
      await loadShopMerchandise();
      setShopMessage(editingShopItemId ? "Merchandise updated." : "Merchandise added.");
    } catch (error: any) {
      if (uploadedReplacementPath) {
        await supabase.storage.from(shopBucket).remove([uploadedReplacementPath]);
      }
      setShopMessage(
        error?.message ?? (editingShopItemId ? "Failed to update merchandise." : "Failed to add merchandise.")
      );
    } finally {
      setIsShopSaving(false);
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
    let pushIssue: string | null = null;
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
        try {
          const { error: pushError } = await supabase.functions.invoke("sendNotification", {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              id: crypto.randomUUID(),
              title: `Badge Award: ${badge.title}`,
              body: truncateNotificationBody(
                `Congratulations to ${studentNames} for earning the ${badge.title} badge.`
              ),
              target: {}
            }
          });
          if (pushError) throw pushError;
        } catch (pushError) {
          pushIssue = await getFunctionInvokeErrorMessage(pushError);
        }
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

        try {
          for (const student of selectedStudents) {
            const studentName =
              [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student";
            const { error: pushError } = await supabase.functions.invoke("sendNotification", {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              },
              body: {
                id: crypto.randomUUID(),
                title: `Badge Award: ${badge.title}`,
                body: truncateNotificationBody(
                  `${studentName} earned the ${badge.title} badge.`
                ),
                target: { studentId: student.id }
              }
            });
            if (pushError) throw pushError;
          }
        } catch (pushError) {
          pushIssue = await getFunctionInvokeErrorMessage(pushError);
        }
      }

      const assignmentMessage = `Assigned ${badge.title} to ${targetStudentIds.length} student${targetStudentIds.length === 1 ? "" : "s"}.`;
      setBadgesMessage(
        pushIssue ? `${assignmentMessage} Push notification failed: ${pushIssue}` : assignmentMessage
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
  const previewShopItemUrl = previewShopItem?.image_path
    ? supabase.storage.from(shopBucket).getPublicUrl(previewShopItem.image_path).data.publicUrl
    : null;

  const attendanceSummary = useMemo(
    () => buildAttendanceSummary(attendanceRows),
    [attendanceRows]
  );

  const isInstructorQualified = (
    instructorId: string,
    classType: string
  ) => {
    if (!instructorId) return true;
    return qualifications.some(
      (item) => item.instructor_id === instructorId && item.class_type === classType
    );
  };

  const signedInDisplayName = getSessionDisplayName(session);
  const showAuthView = isInviteMode || !session || !isAdmin;

  return (
    <div className={showAuthView ? "app auth-app" : "app"}>
      {showAuthView ? (
        <div className="auth-shell">
          <header className="header hero auth-hero">
            <div className="hero-content auth-hero-content">
              <img className="brand-logo auth-brand-logo" src={headerImage} alt="Mamute header" />
              <p className="muted hero-copy auth-copy">
                Admin scheduling, profiles, front desk check-in, and membership operations.
              </p>
            </div>
          </header>

          <section className="panel auth-panel">
            <div className="auth-panel-copy">
              <p className="eyebrow">Admin Portal</p>
              <h2>{isInviteMode ? "Create Password" : "Sign In"}</h2>
              <p className="muted">
                {isInviteMode
                  ? "Finish your admin invite by setting a password and contact number."
                  : "Access scheduling, student records, attendance, news, and badge management."}
              </p>
            </div>

            {isInviteMode ? (
              <div className="auth-state">
                {isInviteInitializing ? (
                  <p className="muted">Validating invite...</p>
                ) : (
                  <form className="form auth-form" onSubmit={completeInviteSetup}>
                    <label className="field">
                      <span>New Password</span>
                      <input
                        className="input"
                        type="password"
                        value={invitePassword}
                        onChange={(event) => setInvitePassword(event.target.value)}
                        placeholder="Create a password"
                        required
                        minLength={8}
                      />
                    </label>
                    <label className="field">
                      <span>Confirm Password</span>
                      <input
                        className="input"
                        type="password"
                        value={invitePasswordConfirm}
                        onChange={(event) => setInvitePasswordConfirm(event.target.value)}
                        placeholder="Confirm password"
                        required
                        minLength={8}
                      />
                    </label>
                    <label className="field">
                      <span>Contact Phone Number</span>
                      <input
                        className="input"
                        type="tel"
                        value={invitePhone}
                        onChange={(event) => setInvitePhone(event.target.value)}
                        placeholder="(555) 123-4567"
                        required
                      />
                    </label>
                    <button
                      className="button auth-submit"
                      type="submit"
                      disabled={isInviteSaving || isInviteInitializing}
                    >
                      {isInviteSaving ? "Saving..." : "Create Password"}
                    </button>
                  </form>
                )}
                {inviteMessage ? <p className="muted">{inviteMessage}</p> : null}
                <button
                  className="button secondary auth-secondary"
                  type="button"
                  onClick={() => {
                    setIsInviteMode(false);
                    setInviteMessage(null);
                    setInvitePassword("");
                    setInvitePasswordConfirm("");
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : session ? (
              <div className="auth-state">
                <p className="muted">Signed in as {session.user.email}</p>
                {isAdminLoading ? <p className="muted">Checking admin access...</p> : null}
                {!isAdminLoading && !isAdmin ? (
                  <p className="error">
                    This account is not an admin. Sign out or contact the master admin.
                  </p>
                ) : null}
                <button className="button secondary auth-secondary" type="button" onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <form className="form auth-form" onSubmit={signIn}>
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
                    placeholder="Enter your password"
                    required
                  />
                </label>
                <button className="button auth-submit" type="submit">
                  Sign in
                </button>
                {authMessage ? <p className="error">{authMessage}</p> : null}
              </form>
            )}
          </section>
        </div>
      ) : null}

      {session && isAdmin ? (
        <>
          <section className="admin-masthead">
            <div className="admin-masthead-main">
              <div className="admin-brand">
                <img className="brand-logo admin-brand-logo" src={headerImage} alt="Mamute header" />
                <div className="admin-brand-copy">
                  <p className="eyebrow">Mamute Admin</p>
                  <p className="muted hero-copy admin-hero-copy">
                    Scheduling, profiles, attendance, and front desk operations.
                  </p>
                </div>
              </div>
              <div className="admin-masthead-actions">
                <span className="muted">Signed in as {signedInDisplayName}</span>
                <button className="button secondary" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
            <nav className="tabbar app-tabbar">
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
          </section>

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

          {activeTab === "shop" ? (
          <section className="panel">
            <h2>Mamute Shop</h2>
            <p className="muted">
              Create and manage merchandise available in the mobile app shop tab.
            </p>

            <div className="panel nested">
              <h3>{editingShopItemId ? "Edit Merchandise" : "Add Merchandise"}</h3>
              <form className="form" onSubmit={submitShopItem}>
                <label className="field">
                  <span>Name</span>
                  <input
                    className="input"
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Mamute Team Hoodie"
                    required
                    disabled={!session || isShopSaving}
                  />
                </label>
                <label className="field" style={{ width: "100%" }}>
                  <span>Description</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={shopDescription}
                    onChange={(event) => setShopDescription(event.target.value)}
                    placeholder="Soft fleece hoodie with embroidered logo."
                    required
                    disabled={!session || isShopSaving}
                  />
                </label>
                <label className="field">
                  <span>Item Type</span>
                  <select
                    className="input"
                    value={shopItemType}
                    onChange={(event) =>
                      setShopItemType(event.target.value as ShopMerchandiseType)
                    }
                    disabled={!session || isShopSaving}
                  >
                    {shopItemTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Sex</span>
                  <select
                    className="input"
                    value={shopSex}
                    onChange={(event) => setShopSex(event.target.value as ShopMerchandiseSex)}
                    disabled={!session || isShopSaving}
                  >
                    {shopSexOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: "100%" }}>
                  <span>Sizes Available</span>
                  <div className="chip-group">
                    {shopSizeOptions.map((size) => (
                      <button
                        key={size}
                        className={shopSizes.includes(size) ? "chip active" : "chip"}
                        type="button"
                        onClick={() => toggleShopSize(size)}
                        disabled={!session || isShopSaving}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="field">
                  <span>Image (optional)</span>
                  <input
                    id="mamute-shop-image"
                    className="input"
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={onShopImageChange}
                    disabled={!session || isShopSaving}
                  />
                  {shopImage ? (
                    <span className="helper">Selected: {shopImage.name}</span>
                  ) : editingShopItemId ? (
                    <span className="helper">Keep current file or choose a replacement.</span>
                  ) : null}
                </label>
                {editingShopItemId ? (
                  <div className="field">
                    <span>Current Image</span>
                    {(() => {
                      const currentItem = shopItems.find((item) => item.id === editingShopItemId);
                      if (!currentItem?.image_path) {
                        return <span className="helper">No image attached.</span>;
                      }
                      const currentImageUrl = supabase.storage
                        .from(shopBucket)
                        .getPublicUrl(currentItem.image_path).data.publicUrl;
                      const isImage = (currentItem.image_mime_type ?? "").startsWith("image/");
                      return (
                        <div className="badge-file-preview">
                          {isImage ? (
                            <img className="badge-thumb" src={currentImageUrl} alt={currentItem.name} />
                          ) : null}
                          <div className="badge-file-meta">
                            <span className="helper">{currentItem.image_name ?? "Stored file"}</span>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => setPreviewShopItem(currentItem)}
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
                  <button className="button" type="submit" disabled={!session || isShopSaving}>
                    {isShopSaving
                      ? editingShopItemId
                        ? "Saving..."
                        : "Adding..."
                      : editingShopItemId
                        ? "Save Merchandise"
                        : "Add Merchandise"}
                  </button>
                  {editingShopItemId ? (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={resetShopForm}
                      disabled={isShopSaving}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            {isShopLoading ? <p className="muted">Loading merchandise...</p> : null}
            {shopItems.length ? (
              <div className="results">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Sex</th>
                      <th>Sizes</th>
                      <th>Image</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <div className="helper">{item.description}</div>
                        </td>
                        <td>{formatDisplayLabel(item.item_type)}</td>
                        <td>{formatDisplayLabel(item.sex)}</td>
                        <td>{item.sizes.length ? item.sizes.join(", ") : "-"}</td>
                        <td>
                          {item.image_path ? (
                            <div className="badge-file-preview compact">
                              {(item.image_mime_type ?? "").startsWith("image/") ? (
                                <img
                                  className="badge-thumb compact"
                                  src={
                                    supabase.storage.from(shopBucket).getPublicUrl(item.image_path).data
                                      .publicUrl
                                  }
                                  alt={item.name}
                                />
                              ) : null}
                              <div className="badge-file-meta">
                                <span className="helper">{item.image_name ?? "Stored file"}</span>
                                <button
                                  className="button secondary"
                                  type="button"
                                  onClick={() => setPreviewShopItem(item)}
                                >
                                  Preview
                                </button>
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{new Date(item.updated_at).toLocaleString()}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => startEditShopItem(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => void deleteShopItem(item)}
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
              <p className="muted">No merchandise items yet.</p>
            )}
            {shopMessage ? <p className="error">{shopMessage}</p> : null}
            {previewShopItem ? (
              <div className="modal-backdrop" onClick={() => setPreviewShopItem(null)}>
                <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <h3>{previewShopItem.name}</h3>
                      <p className="muted">{previewShopItem.image_name ?? "Stored file"}</p>
                    </div>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setPreviewShopItem(null)}
                    >
                      Close
                    </button>
                  </div>
                  {previewShopItemUrl &&
                  (previewShopItem.image_mime_type ?? "").startsWith("image/") ? (
                    <img
                      className="badge-preview-image"
                      src={previewShopItemUrl}
                      alt={previewShopItem.name}
                    />
                  ) : previewShopItemUrl ? (
                    <iframe className="badge-preview-frame" src={previewShopItemUrl} title={previewShopItem.name} />
                  ) : (
                    <p className="muted">No preview available for this file.</p>
                  )}
                </div>
              </div>
            ) : null}
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
            <div className="section-header">
              <div className="section-copy">
                <h2>Attendance</h2>
                <p className="muted">Run and print attendance reports by date range.</p>
              </div>
            </div>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAttendanceReport();
              }}
            >
              <label className="field">
                <span>Start Date</span>
                <input
                  className="input"
                  type="date"
                  value={attendanceStartDate}
                  onChange={(event) => setAttendanceStartDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>End Date</span>
                <input
                  className="input"
                  type="date"
                  value={attendanceEndDate}
                  onChange={(event) => setAttendanceEndDate(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={isAttendanceLoading}>
                  {isAttendanceLoading ? "Running..." : "Run Report"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void resetAttendanceReport()}
                  disabled={isAttendanceLoading}
                >
                  Reset
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={printAttendanceReport}
                  disabled={!attendanceRows.length}
                >
                  Print Report
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={exportAttendanceReportCsv}
                  disabled={!attendanceRows.length}
                >
                  Export CSV
                </button>
              </div>
            </form>
            <div className="panel nested utility-panel">
              <div className="report-summary-grid">
                <div className="report-summary-card">
                  <span className="report-summary-label">Range</span>
                  <strong>{attendanceReportLabel ?? "Custom range"}</strong>
                </div>
                <div className="report-summary-card">
                  <span className="report-summary-label">Check-ins</span>
                  <strong>{attendanceSummary.totalCheckIns}</strong>
                </div>
                <div className="report-summary-card">
                  <span className="report-summary-label">Students</span>
                  <strong>{attendanceSummary.uniqueStudents}</strong>
                </div>
                <div className="report-summary-card">
                  <span className="report-summary-label">Classes</span>
                  <strong>{attendanceSummary.uniqueClasses}</strong>
                </div>
                <div className="report-summary-card">
                  <span className="report-summary-label">Avg / Student</span>
                  <strong>{attendanceSummary.checkInsPerStudentAverage.toFixed(2)}</strong>
                </div>
              </div>
              <div className="report-insights-grid">
                <section className="report-insight-card">
                  <h3>Class Insights</h3>
                  <p>
                    <strong>Most popular:</strong> {attendanceSummary.mostPopularClassType}
                  </p>
                  <p>
                    <strong>Least popular:</strong> {attendanceSummary.leastPopularClassType}
                  </p>
                  <div className="results">
                    <table className="table compact">
                      <thead>
                        <tr>
                          <th>Class Type</th>
                          <th>Check-ins</th>
                          <th>Sessions</th>
                          <th>Avg / Session</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSummary.classAverages.slice(0, 6).map((item) => (
                          <tr key={item.classType}>
                            <td>{item.classType}</td>
                            <td>{item.checkIns}</td>
                            <td>{item.sessions}</td>
                            <td>{item.averagePerSession.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="report-insight-card">
                  <h3>Day and Time Insights</h3>
                  <p>
                    <strong>Busiest weekdays (Mon-Fri):</strong>{" "}
                    {attendanceSummary.busiestWeekdays.length
                      ? attendanceSummary.busiestWeekdays
                          .map((day) => `${day.dayLabel} (${day.checkIns})`)
                          .join(", ")
                      : "No weekday check-ins in this range."}
                  </p>
                  <p>
                    <strong>Slowest weekdays (Mon-Fri):</strong>{" "}
                    {attendanceSummary.slowestWeekdays.length
                      ? attendanceSummary.slowestWeekdays
                          .map((day) => `${day.dayLabel} (${day.checkIns})`)
                          .join(", ")
                      : "No weekday check-ins in this range."}
                  </p>
                  <p>
                    <strong>Peak check-in hour:</strong> {attendanceSummary.peakHourWindow}
                  </p>
                </section>
                <section className="report-insight-card">
                  <h3>Student and Source Trends</h3>
                  <h4>Top Students</h4>
                  <ul className="report-list">
                    {attendanceSummary.topStudents.length ? (
                      attendanceSummary.topStudents.map((student) => (
                        <li key={student.studentNumber}>
                          {student.studentName} (#{student.studentNumber}) - {student.checkIns}{" "}
                          check-ins
                        </li>
                      ))
                    ) : (
                      <li>No attendance records in this range.</li>
                    )}
                  </ul>
                  <h4>Source Mix</h4>
                  <ul className="report-list">
                    {attendanceSummary.sourceBreakdown.length ? (
                      attendanceSummary.sourceBreakdown.map((source) => (
                        <li key={source.source}>
                          {source.source}: {source.checkIns} ({source.percentage.toFixed(1)}%)
                        </li>
                      ))
                    ) : (
                      <li>No source data in this range.</li>
                    )}
                  </ul>
                </section>
              </div>
            </div>
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
                        ? `${dayOptions.find((d) => d.value === schedule.day_of_week)?.label ?? ""} ${schedule.start_time} - ${formatDisplayLabel(schedule.class_type)}`
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

function buildAttendanceSummary(rows: AttendanceRecord[]): AttendanceSummary {
  if (!rows.length) {
    return {
      totalCheckIns: 0,
      uniqueStudents: 0,
      uniqueClasses: 0,
      checkInsPerStudentAverage: 0,
      mostPopularClassType: "N/A",
      leastPopularClassType: "N/A",
      classAverages: [],
      busiestWeekdays: [],
      slowestWeekdays: [],
      peakHourWindow: "N/A",
      topStudents: [],
      sourceBreakdown: []
    };
  }

  const uniqueStudents = new Set<string>();
  const uniqueClasses = new Set<string>();
  const classCheckInCounts = new Map<string, number>();
  const classSessions = new Map<string, Set<string>>();
  const weekdayCounts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0]
  ]);
  const hourlyCounts = new Map<number, number>();
  const studentCounts = new Map<
    number,
    { studentNumber: number; studentName: string; checkIns: number }
  >();
  const sourceCounts = new Map<string, number>();

  rows.forEach((row) => {
    const student = getAttendanceStudent(row);
    const schedule = getAttendanceSchedule(row);
    const classType = schedule?.class_type
      ? formatDisplayLabel(schedule.class_type)
      : "Unknown";

    classCheckInCounts.set(classType, (classCheckInCounts.get(classType) ?? 0) + 1);

    if (!classSessions.has(classType)) {
      classSessions.set(classType, new Set<string>());
    }
    classSessions.get(classType)?.add(buildAttendanceSessionKey(row, schedule));

    if (student?.student_number) {
      uniqueStudents.add(String(student.student_number));
      const studentName = [student.first_name, student.last_name].filter(Boolean).join(" ");
      const current = studentCounts.get(student.student_number);
      if (current) {
        current.checkIns += 1;
      } else {
        studentCounts.set(student.student_number, {
          studentNumber: student.student_number,
          studentName: studentName || "Student",
          checkIns: 1
        });
      }
    }

    if (schedule) {
      uniqueClasses.add(`${schedule.day_of_week}-${schedule.start_time}-${schedule.class_type}`);
    }

    const dayOfWeek =
      typeof schedule?.day_of_week === "number"
        ? schedule.day_of_week
        : new Date(row.scanned_at).getDay();
    if (weekdayCounts.has(dayOfWeek)) {
      weekdayCounts.set(dayOfWeek, (weekdayCounts.get(dayOfWeek) ?? 0) + 1);
    }

    const scannedAt = new Date(row.scanned_at);
    if (!Number.isNaN(scannedAt.getTime())) {
      const hour = scannedAt.getHours();
      hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
    }

    const source = capitalizeLabel((row.source || "unknown").trim());
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  });

  const classAverages: AttendanceClassAverage[] = [...classCheckInCounts.entries()]
    .map(([classType, checkIns]) => {
      const sessions = classSessions.get(classType)?.size || 0;
      const denominator = sessions > 0 ? sessions : 1;
      return {
        classType,
        checkIns,
        sessions,
        averagePerSession: checkIns / denominator
      };
    })
    .sort((a, b) => b.checkIns - a.checkIns || a.classType.localeCompare(b.classType));

  const rankedClasses = classAverages.filter((item) => item.classType !== "Unknown");
  const mostPopularClassType = rankedClasses.length ? rankedClasses[0].classType : "N/A";
  const leastPopularClassType = rankedClasses.length
    ? rankedClasses[rankedClasses.length - 1].classType
    : "N/A";

  const weekdayStats: AttendanceDayStat[] = [...weekdayCounts.entries()]
    .map(([dayOfWeek, checkIns]) => ({
      dayOfWeek,
      dayLabel: dayOptions.find((option) => option.value === dayOfWeek)?.label ?? "Unknown",
      checkIns
    }))
    .filter((item) => item.checkIns > 0);

  const busiestWeekdays = [...weekdayStats]
    .sort((a, b) => b.checkIns - a.checkIns || a.dayOfWeek - b.dayOfWeek)
    .slice(0, 2);
  const slowestWeekdays = [...weekdayStats]
    .sort((a, b) => a.checkIns - b.checkIns || a.dayOfWeek - b.dayOfWeek)
    .slice(0, 2);

  const topStudents: AttendanceStudentStat[] = [...studentCounts.values()]
    .sort((a, b) => b.checkIns - a.checkIns || a.studentNumber - b.studentNumber)
    .slice(0, 5);

  const sourceBreakdown: AttendanceSourceStat[] = [...sourceCounts.entries()]
    .map(([source, checkIns]) => ({
      source,
      checkIns,
      percentage: rows.length ? (checkIns / rows.length) * 100 : 0
    }))
    .sort((a, b) => b.checkIns - a.checkIns || a.source.localeCompare(b.source));

  const peakHourEntry = [...hourlyCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0]
  )[0];

  return {
    totalCheckIns: rows.length,
    uniqueStudents: uniqueStudents.size,
    uniqueClasses: uniqueClasses.size,
    checkInsPerStudentAverage: uniqueStudents.size ? rows.length / uniqueStudents.size : 0,
    mostPopularClassType,
    leastPopularClassType,
    classAverages,
    busiestWeekdays,
    slowestWeekdays,
    peakHourWindow: peakHourEntry ? formatHourWindow(peakHourEntry[0]) : "N/A",
    topStudents,
    sourceBreakdown
  };
}

function getAttendanceStudent(row: AttendanceRecord) {
  return Array.isArray(row.students) ? row.students[0] : row.students;
}

function getAttendanceSchedule(row: AttendanceRecord) {
  return Array.isArray(row.class_schedules) ? row.class_schedules[0] : row.class_schedules;
}

function buildAttendanceSessionKey(
  row: AttendanceRecord,
  schedule: AttendanceSchedule | null | undefined
) {
  const scannedAt = new Date(row.scanned_at);
  const scannedDate = Number.isNaN(scannedAt.getTime())
    ? row.scanned_at.slice(0, 10)
    : scannedAt.toISOString().slice(0, 10);
  const scheduleKey = row.schedule_id
    ? row.schedule_id
    : schedule
      ? `${schedule.day_of_week}-${schedule.start_time}-${schedule.class_type}`
      : "no-schedule";

  return `${scheduleKey}-${scannedDate}`;
}

function formatHourWindow(hour: number) {
  return `${formatHourLabel(hour)} - ${formatHourLabel((hour + 1) % 24)}`;
}

function formatHourLabel(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const meridiem = normalizedHour >= 12 ? "PM" : "AM";
  const hour12 = normalizedHour % 12 || 12;
  return `${hour12}:00 ${meridiem}`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date;
}

function isInviteSetupRequired(session: Session | null) {
  if (!session) return false;
  const metadata = session.user.user_metadata;
  return metadata?.invited_setup_required === true;
}

function getSessionDisplayName(session: Session | null) {
  if (!session) return "Admin";
  const metadata = session.user.user_metadata ?? {};
  const displayName =
    (typeof metadata.display_name === "string" && metadata.display_name.trim()) ||
    [metadata.first_name, metadata.last_name]
      .filter((item) => typeof item === "string" && item.trim())
      .join(" ")
      .trim();
  if (displayName) return displayName;
  return session.user.email ?? "Admin";
}

function toStartOfDayIso(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toISOString();
}

function toEndExclusiveIso(dateString: string) {
  const end = new Date(`${dateString}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

function getAttendanceRangeLabel(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return `${startDate} to ${endDate}`;
  }
  if (startDate) {
    return `From ${startDate}`;
  }
  if (endDate) {
    return `Through ${endDate}`;
  }
  return "Most recent attendance";
}

function capitalizeLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCsvCell(value: string) {
  const normalized = value.replaceAll('"', '""');
  return `"${normalized}"`;
}

async function getFunctionInvokeErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown push error";
  }

  const response = "context" in error ? (error as { context?: unknown }).context : null;
  if (response instanceof Response) {
    try {
      const responseText = await response.clone().text();
      if (!responseText) {
        return `${response.status} ${response.statusText}`.trim();
      }

      try {
        const parsed = JSON.parse(responseText) as { error?: string; message?: string };
        return parsed.error ?? parsed.message ?? responseText;
      } catch {
        return responseText;
      }
    } catch {
      return `${response.status} ${response.statusText}`.trim();
    }
  }

  if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }

  return "Unknown push error";
}

function truncateNotificationBody(value: string, maxLength = 140) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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

