import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
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
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="알림 닫기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => removeToast(toast.id)}
              style={styles.closeButton}
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
    gap: 2
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "900"
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
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  closeButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radius.sm,
    minHeight: 32,
    paddingHorizontal: spacing.sm
  },
  actionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: 24
  }
});
