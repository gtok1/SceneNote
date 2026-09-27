export const colors = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F3F5",
  text: "#171717",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",
  border: "#E5E7EB",
  primary: "#2563EB",
  primarySoft: "#DBEAFE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  success: "#047857",
  successSoft: "#D1FAE5",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  overlay: "rgba(23, 23, 23, 0.48)"
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999
} as const;

export const typography = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" }
} as const;

export const elevation = {
  card: { boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.06), 0px 1px 3px rgba(16, 24, 40, 0.08)" },
  bar: { boxShadow: "0px -1px 0px rgba(16, 24, 40, 0.06)" }
} as const;
