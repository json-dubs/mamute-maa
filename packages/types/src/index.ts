export type Role = "student" | "parent" | "instructor" | "admin" | "front-desk";

export type MembershipStatus = "good" | "delinquent" | "suspended";

export interface Profile {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
  guardianFor?: string | null;
}

export interface Membership {
  profileId: string;
  status: MembershipStatus;
  tier?: string;
  renewalDate?: string;
}

export type Discipline = "bjj" | "muay-thai" | "kickboxing" | "boxing";

export interface ClassSchedule {
  id: string;
  discipline: Discipline;
  title: string;
  instructorId: string;
  startAt: string;
  endAt: string;
  capacity?: number;
  status: "scheduled" | "cancelled" | "completed";
}

export interface Enrollment {
  profileId: string;
  classId: string;
  role: "student" | "guardian";
  attendanceCount: number;
}

export interface Attendance {
  id: string;
  profileId: string;
  classId: string;
  scannedAt: string;
  deviceId?: string;
  source: "mobile" | "web";
}

export interface PaymentStatus {
  profileId: string;
  providerRef?: string;
  amountDue?: number;
  dueDate?: string;
  lastPaymentAt?: string;
  status: "current" | "due" | "overdue";
}

export type NotificationType = "reminder" | "cancel" | "dues" | "general";

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  target: { classId?: string; profileId?: string; role?: Role };
  title: string;
  body: string;
  scheduledAt?: string;
  sentAt?: string;
}

export interface PushToken {
  profileId: string;
  token: string;
  platform: "ios" | "android" | "web";
  updatedAt: string;
}

export interface AttendanceRequest {
  barcode: string;
  deviceId?: string;
  source: "mobile" | "web";
}

export * from "./admin";
