import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants/theme";
import { useAppUIStore, type AppToast } from "@/stores/appUIStore";

const TOAST_TYPE_LABEL: Record<AppToast["type"], string> = {
  success: "완료",
  error: "오류",
  info: "안내"
};

export function ToastViewport() {
  const toasts = useAppUIStore((state) => state.toasts);
  const removeToast = useAppUIStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <View
      accessibilityLabel="알림"
      accessibilityLiveRegion="polite"
      aria-live="polite"
      pointerEvents="box-none"
      style={styles.viewport}
    >
      <View pointerEvents="box-none" style={styles.list}>
        {toasts.map((toast) => (
          <View
            accessibilityRole="alert"
            key={toast.id}
            style={[
              styles.toast,
              toast.type === "success"
                ? styles.toastSuccess
                : toast.type === "error"
                  ? styles.toastError
                  : styles.toastInfo
            ]}
          >
            <View style={styles.messageGroup}>
              <Text
                style={[
                  styles.typeLabel,
                  toast.type === "success"
                    ? styles.typeLabelSuccess
                    : toast.type === "error"
                      ? styles.typeLabelError
                      : styles.typeLabelInfo
                ]}
              >
                {TOAST_TYPE_LABEL[toast.type]}
              </Text>
              <Text style={styles.message}>{toast.message}</Text>
            </View>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  removeToast(toast.id);
                  toast.onAction?.();
                }}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="알림 닫기"
              accessibilityRole="button"
              onPress={() => removeToast(toast.id)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text accessibilityElementsHidden style={styles.closeText}>
                ×
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: "center",
    bottom: 88,
    left: spacing.lg,
    position: "absolute",
    right: spacing.lg,
    zIndex: 1500
  },
  list: {
    gap: spacing.sm,
    maxWidth: 560,
    width: "100%"
  },
  toast: {
    alignItems: "center",
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  toastSuccess: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success
  },
  toastError: {
    backgroundColor: colors.dangerSoft,
    borderLeftColor: colors.danger
  },
  toastInfo: {
    backgroundColor: colors.primarySoft,
    borderLeftColor: colors.primary
  },
  messageGroup: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  typeLabel: {
    ...typography.micro
  },
  typeLabelSuccess: {
    color: colors.success
  },
  typeLabelError: {
    color: colors.danger
  },
  typeLabelInfo: {
    color: colors.primary
  },
  message: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1
  },
  closeButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    minHeight: 44,
    justifyContent: "center",
    minWidth: 44,
    flexShrink: 0
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    flexShrink: 0,
    paddingHorizontal: spacing.sm
  },
  actionText: {
    ...typography.label,
    color: colors.primary
  },
  closeText: {
    ...typography.title,
    color: colors.textMuted
  },
  pressed: {
    opacity: 0.72
  }
});
