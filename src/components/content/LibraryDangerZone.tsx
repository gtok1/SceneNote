import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { LIBRARY_DELETE_ZONE_COPY } from "@/utils/libraryFeedbackCopy";

export function LibraryDangerZone({ pending, onDelete }: { pending: boolean; onDelete: () => void }) {
  return (
    <DashboardPanel title={LIBRARY_DELETE_ZONE_COPY.title}>
      <Text style={styles.description}>{LIBRARY_DELETE_ZONE_COPY.description}</Text>
      <Pressable
        accessibilityLabel={LIBRARY_DELETE_ZONE_COPY.actionLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, busy: pending }}
        disabled={pending}
        onPress={onDelete}
        style={({ pressed }) => [styles.button, pressed && !pending ? styles.buttonPressed : null, pending ? styles.buttonPending : null]}
      >
        <Ionicons color={colors.danger} name="trash-outline" size={16} />
        <Text style={styles.buttonText}>{pending ? LIBRARY_DELETE_ZONE_COPY.pendingLabel : LIBRARY_DELETE_ZONE_COPY.actionLabel}</Text>
      </Pressable>
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.caption,
    color: colors.textMuted
  },
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger
  },
  buttonPressed: {
    backgroundColor: colors.dangerSoft
  },
  buttonPending: {
    opacity: 0.6
  },
  buttonText: {
    ...typography.label,
    color: colors.danger
  }
});
