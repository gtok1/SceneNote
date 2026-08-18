import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/constants/theme";
import type { ContentTheme } from "../../../supabase/functions/_shared/recommendationThemes";

export interface ThemeReductionSheetProps {
  themes: readonly ContentTheme[];
  visible: boolean;
  submittingThemeKey: string | null;
  onClose: () => void;
  onSelect: (theme: ContentTheme) => void;
}

export function ThemeReductionSheet({
  themes,
  visible,
  submittingThemeKey,
  onClose,
  onSelect
}: ThemeReductionSheetProps) {
  const isSubmitting = submittingThemeKey !== null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={isSubmitting ? undefined : onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="테마 선택 닫기"
          disabled={isSubmitting}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel="추천에서 줄일 테마 선택"
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>이런 요소 줄이기</Text>
              <Text style={styles.description}>추천에서 덜 보고 싶은 작품 요소를 선택하세요.</Text>
            </View>
            <Pressable
              accessibilityLabel="테마 선택 닫기"
              disabled={isSubmitting}
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.options}>
            {themes.map((theme) => {
              const themeKey = `${theme.family}:${theme.key}`;
              const isCurrentTheme = submittingThemeKey === themeKey;

              return (
                <Pressable
                  accessibilityHint="선택하면 이후 추천에서 이 요소의 비중을 줄입니다"
                  accessibilityLabel={`${theme.label} 요소 줄이기`}
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  key={themeKey}
                  onPress={() => onSelect(theme)}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && !isSubmitting ? styles.optionPressed : null,
                    isSubmitting && !isCurrentTheme ? styles.optionDisabled : null
                  ]}
                >
                  <Text style={styles.optionText}>{theme.label}</Text>
                  {isCurrentTheme ? (
                    <ActivityIndicator accessibilityLabel="피드백 저장 중" color={colors.primary} size="small" />
                  ) : (
                    <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: radius.md,
    height: 4,
    width: 40
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  heading: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44
  },
  options: {
    gap: spacing.sm
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionPressed: {
    borderColor: colors.primary
  },
  optionDisabled: {
    opacity: 0.5
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700"
  }
});
