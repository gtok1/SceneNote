import { StyleSheet, Text, View } from "react-native";

import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import type { WatchStatus } from "@/types/library";

interface WatchStatusBadgeProps {
  status: WatchStatus;
  size?: "sm" | "md";
}

export function WatchStatusBadge({ status, size = "md" }: WatchStatusBadgeProps) {
  return (
    <View
      accessibilityLabel={`감상 상태: ${WATCH_STATUS_LABEL[status]}`}
      style={[styles.badge, styles[status], size === "sm" && styles.small]}
    >
      <Text style={[styles.text, size === "sm" && styles.smallText]}>
        {WATCH_STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  text: {
    fontSize: 12,
    fontWeight: "700"
  },
  smallText: {
    fontSize: 11
  },
  wishlist: {
    backgroundColor: colors.primarySoft
  },
  watching: {
    backgroundColor: colors.successSoft
  },
  completed: {
    backgroundColor: colors.surfaceMuted
  },
  recommended: {
    backgroundColor: colors.successSoft
  },
  not_recommended: {
    backgroundColor: colors.warningSoft
  },
  dropped: {
    backgroundColor: colors.dangerSoft
  }
});
