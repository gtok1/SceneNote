import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, typography } from "@/constants/theme";

import { DashboardPanel } from "./DashboardPanel";

interface AccountSectionProps {
  width?: number | undefined;
  exclusionCount: number | null;
  onOpenExclusions?: (() => void) | undefined;
  onSignOut: () => void;
  signingOut: boolean;
  onDeleteAccount: () => void;
  deleting: boolean;
}

export function AccountSection({
  width,
  exclusionCount,
  onOpenExclusions,
  onSignOut,
  signingOut,
  onDeleteAccount,
  deleting
}: AccountSectionProps) {
  const busy = signingOut || deleting;

  return (
    <DashboardPanel title="계정" width={width}>
      <View>
        {onOpenExclusions ? (
          <Pressable accessibilityRole="button" onPress={onOpenExclusions} style={styles.row}>
            <Ionicons color={colors.textMuted} name="eye-off-outline" size={20} />
            <Text style={styles.label}>추천에서 제외한 작품</Text>
            <Text style={styles.meta}>{`${exclusionCount ?? 0}개`}</Text>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSignOut}
          style={[styles.row, onOpenExclusions ? styles.divider : null, busy ? styles.disabled : null]}
        >
          <Ionicons color={colors.textMuted} name="log-out-outline" size={20} />
          <Text style={styles.label}>{signingOut ? "로그아웃 중" : "로그아웃"}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onDeleteAccount}
          style={[styles.row, styles.divider, busy ? styles.disabled : null]}
        >
          <Ionicons color={colors.danger} name="person-remove-outline" size={20} />
          <Text style={[styles.label, styles.danger]}>{deleting ? "탈퇴 처리 중" : "회원 탈퇴"}</Text>
        </Pressable>
      </View>
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52
  },
  divider: {
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  label: {
    ...typography.body,
    color: colors.text,
    flex: 1
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"]
  },
  danger: {
    color: colors.danger
  },
  disabled: {
    opacity: 0.5
  }
});
