import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, elevation, radius, spacing, typography } from "@/constants/theme";

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  width?: number | undefined;
  children: ReactNode;
}

export function DashboardPanel({ title, subtitle, accessory, width, children }: DashboardPanelProps) {
  return (
    <View style={[styles.panel, width !== undefined ? { width } : null]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {accessory}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.card
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerCopy: {
    flexShrink: 1,
    gap: 2
  },
  title: {
    ...typography.headline,
    color: colors.text
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted
  }
});
