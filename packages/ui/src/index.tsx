import { ReactNode } from "react";
import {
  View,
  Text as RNText,
  StyleSheet,
  ViewStyle,
  TextStyle
} from "react-native";

export type Tone = "default" | "success" | "warning" | "danger";

export const uiColors = {
  background: "#0b0b0b",
  surface: "#111111",
  surfaceAlt: "#151515",
  border: "#2a2a2a",
  text: "#f5f5f5",
  muted: "#9ca3af",
  accent: "#e11d2e",
  accentDark: "#a3001b"
} as const;

const toneMap: Record<Tone, { bg: string; fg: string; border?: string }> = {
  default: { bg: uiColors.surfaceAlt, fg: uiColors.text, border: "#1e293b" },
  success: { bg: "#064e3b", fg: "#bbf7d0", border: "#047857" },
  warning: { bg: "#713f12", fg: "#fde68a", border: "#b45309" },
  danger: { bg: "#7f1d1d", fg: "#fecdd3", border: "#b91c1c" }
};

export function Card({
  children,
  style
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({
  children,
  style
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Text({
  children,
  style
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return <RNText style={[styles.text, style]}>{children}</RNText>;
}

export function Badge({
  label,
  tone = "default"
}: {
  label: string;
  tone?: Tone;
}) {
  const palette = toneMap[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border }
      ]}
    >
      <RNText style={[styles.badgeText, { color: palette.fg }]}>{label}</RNText>
    </View>
  );
}

export function Screen({
  title,
  children
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {title ? <RNText style={styles.title}>{title}</RNText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 12,
    padding: 16,
    backgroundColor: uiColors.background
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: uiColors.text,
    letterSpacing: 0.5
  },
  text: {
    color: uiColors.text
  },
  card: {
    backgroundColor: uiColors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: uiColors.border,
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  badgeText: {
    fontWeight: "600",
    fontSize: 12
  }
});
