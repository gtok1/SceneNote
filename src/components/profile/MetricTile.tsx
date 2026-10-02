import { StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { ProfileMetric } from "@/utils/profileDashboard";

export function MetricTile({ metric, width }: { metric: ProfileMetric; width: number }) {
  const { label, value, caption, icon } = metric;

  return (
    <View
      accessibilityLabel={`${label} ${value}${caption ? `, ${caption}` : ""}`}
      accessible
      style={[styles.card, { width }]}
    >
      <View style={styles.iconCircle}>
        <Ionicons color={colors.primary} name={icon as keyof typeof Ionicons.glyphMap} size={18} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: spacing.lg,
    ...elevation.card
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  value: {
    ...typography.display,
    color: colors.text,
    fontVariant: ["tabular-nums"]
  },
  label: {
    ...typography.label,
    color: colors.textMuted
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted
  }
});
