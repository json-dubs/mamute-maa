import { ClassSchedule, MembershipStatus } from "@mamute/types";

type Tone = "default" | "success" | "warning" | "danger";

export function formatTimeRange(startAt: string, endAt?: string) {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const startText = start.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const endText = end
    ? end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";
  return endText ? `${startText} - ${endText}` : startText;
}

export function classifyStatus(status: MembershipStatus): {
  tone: Tone;
  label: string;
} {
  if (status === "good") return { tone: "success", label: "In good standing" };
  if (status === "delinquent")
    return { tone: "warning" as Tone, label: "Payment due" };
  return { tone: "danger" as Tone, label: "Suspended" };
}

export function parseBarcode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[^A-Za-z0-9-]/g, "");
}

export function groupScheduleByDay(schedules: ClassSchedule[]) {
  return schedules.reduce<Record<string, ClassSchedule[]>>((acc, item) => {
    const dateKey = item.startAt.slice(0, 10);
    acc[dateKey] = acc[dateKey] ? [...acc[dateKey], item] : [item];
    return acc;
  }, {});
}
