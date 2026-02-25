export type MembershipType =
  | "adults-unlimited"
  | "kids-unlimited"
  | "striking-only"
  | "grappling-only"
  | "adults-limited-once-weekly"
  | "kids-limited-once-weekly";

export type MembershipStanding = "active" | "inactive" | "overdue";

export type ClassType =
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

export interface StudentRecord {
  id: string;
  studentNumber: number;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  email?: string | null;
  barcodeValue?: string | null;
  membershipType: MembershipType;
  membershipStanding: MembershipStanding;
}

export interface InstructorRecord {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}

export interface InstructorQualification {
  instructorId: string;
  classType: ClassType;
}

export interface ClassScheduleTemplate {
  id: string;
  classType: ClassType;
  instructorId?: string | null;
  instructorFirstName?: string | null;
  instructorLastName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  scheduleId?: string | null;
  sessionStartAt?: string | null;
  sessionEndAt?: string | null;
  scannedAt: string;
  deviceId?: string | null;
  source: "frontdesk" | "mobile";
  locationVerified: boolean;
}

export interface CheckInRequest {
  barcode?: string;
  studentNumbers?: number[];
  scheduleId?: string;
  deviceId?: string;
  source: "frontdesk" | "mobile";
  locationVerified?: boolean;
}

export interface CheckInResult {
  student: Pick<
    StudentRecord,
    "id" | "studentNumber" | "firstName" | "lastName" | "membershipStanding"
  >;
  attendance?: AttendanceRecord | null;
  blocked: boolean;
  reason?: string;
}

export interface CheckInResponse {
  schedule: ClassScheduleTemplate;
  results: CheckInResult[];
}

export interface StudentAccess {
  id: string;
  userId: string;
  studentId: string;
  role: "student" | "parent";
}

export interface AdminProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LinkedStudentSummary {
  studentId: string;
  studentNumber: number;
  firstName?: string | null;
  lastName?: string | null;
  guardianNames?: string[];
  badges?: StudentBadgeSummary[];
  membershipType?: MembershipType;
  membershipStanding: MembershipStanding;
  barcodeValue?: string | null;
}

export type BadgeVisibility = "public" | "private";
export type BadgeAssignedSource = "auto" | "manual";

export interface BadgeRecord {
  id: string;
  title: string;
  description?: string | null;
  imagePath?: string | null;
  imageName?: string | null;
  imageMimeType?: string | null;
  imageUrl?: string | null;
  milestoneCount?: number | null;
  createdAt: string;
}

export interface StudentBadgeSummary {
  id: string;
  badgeId: string;
  title: string;
  description?: string | null;
  milestoneCount?: number | null;
  imagePath?: string | null;
  imageName?: string | null;
  imageMimeType?: string | null;
  imageUrl?: string | null;
  visibility: BadgeVisibility;
  assignedSource: BadgeAssignedSource;
  assignedAt: string;
}

export interface LinkStudentAccessRequest {
  studentNumber?: number;
  studentFirstName?: string;
  studentLastName?: string;
  students?: {
    studentNumber: number;
    studentFirstName: string;
    studentLastName: string;
  }[];
  guardianFirstName?: string;
  guardianLastName?: string;
}

export interface LinkStudentAccessResponse {
  linked: LinkedStudentSummary[];
}

export interface RegisterMobileUserRequest {
  email: string;
  studentNumbers: number[];
}

export interface RegisterMobileUserResponse {
  ok: true;
  role: "student" | "parent";
  linked: LinkedStudentSummary[];
}

export interface VerifyMobileEmailRequest {
  email: string;
}

export interface VerifyMobileEmailResponse {
  found: true;
  students: Array<{
    id: string;
    studentNumber: number;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}

export interface VerifyMobileStudentNumbersRequest {
  email: string;
  studentNumbers: number[];
}

export interface VerifyMobileStudentNumbersResponse {
  ok: true;
  role: "student" | "parent";
  students: Array<{
    id: string;
    studentNumber: number;
    firstName?: string | null;
    lastName?: string | null;
  }>;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
}

export interface VerifyStudentLinkRequest {
  lastName: string;
  studentNumber: number;
}

export interface VerifyStudentLinkResponse {
  student: {
    id: string;
    studentNumber: number;
    firstName?: string | null;
    lastName?: string | null;
    email: string | null;
  };
}

export interface VerifyGuardianChild {
  lastName: string;
  studentNumber: number;
}

export interface VerifyGuardianLinkRequest {
  guardianEmail: string;
  children: VerifyGuardianChild[];
}

export interface VerifyGuardianLinkResponse {
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  students: Array<{
    id: string;
    studentNumber: number;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}

export interface MamuteNewsPost {
  id: string;
  title: string;
  description: string;
  postType?: "general" | "birthday" | "badge" | "payment";
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  visibility?: BadgeVisibility;
  studentId?: string | null;
  attachmentUrl?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface CreateMamuteNewsPostRequest {
  title: string;
  description: string;
  postType?: "general" | "birthday" | "badge" | "payment";
  visibility?: BadgeVisibility;
  studentId?: string | null;
  expiresAt?: string | null;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
}
