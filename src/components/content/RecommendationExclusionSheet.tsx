import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/constants/theme";
import { useModalFocus } from "@/hooks/useModalFocus";

interface FilterOption {
  key: string;
  label: string;
}

const RELATIONSHIP_OPTIONS: readonly FilterOption[] = [
  { key: "boys-love", label: "BL" },
  { key: "girls-love", label: "GL · 백합" },
  { key: "queer-romance", label: "퀴어 · LGBTQ+" }
];

// Values match provider genre names; they are stored as account-specific exclusions.
const GENRE_OPTIONS: readonly FilterOption[] = [
  { key: "romance", label: "로맨스" },
  { key: "drama", label: "드라마" },
  { key: "comedy", label: "코미디" },
  { key: "action", label: "액션" },
  { key: "action & adventure", label: "액션·어드벤처" },
  { key: "adventure", label: "모험" },
  { key: "fantasy", label: "판타지" },
  { key: "sci-fi & fantasy", label: "SF·판타지" },
  { key: "science fiction", label: "SF" },
  { key: "mystery", label: "미스터리" },
  { key: "thriller", label: "스릴러" },
  { key: "crime", label: "범죄" },
  { key: "horror", label: "공포" },
  { key: "animation", label: "애니메이션" },
  { key: "family", label: "가족" },
  { key: "history", label: "시대극" },
  { key: "war", label: "전쟁" },
  { key: "music", label: "음악" },
  { key: "documentary", label: "다큐멘터리" }
];

export interface RecommendationExclusionSheetProps {
  visible: boolean;
  excludedThemeKeys: readonly string[];
  excludedGenres: readonly string[];
  isSaving: boolean;
  onToggleTheme: (key: string) => void;
  onToggleGenre: (key: string) => void;
  onClose: () => void;
}

export function RecommendationExclusionSheet({
  visible,
  excludedThemeKeys,
  excludedGenres,
  isSaving,
  onToggleTheme,
  onToggleGenre,
  onClose
}: RecommendationExclusionSheetProps) {
  const insets = useSafeAreaInsets();
  const { panelRef, firstRef, focusFirst } = useModalFocus(visible);
  const themeKeys = new Set(excludedThemeKeys);
  const genreKeys = new Set(excludedGenres);

  return (
    <Modal
      animationType="slide"
      onRequestClose={isSaving ? undefined : onClose}
      onShow={focusFirst}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="추천 제외 설정 닫기"
          disabled={isSaving}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel="계정별 추천 제외 설정"
          accessibilityViewIsModal
          aria-modal
          ref={panelRef}
          role="dialog"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>추천 제외 설정</Text>
              <Text style={styles.description}>
                선택한 테마와 장르는 이 계정의 추천에서 계속 제외돼요. 직접 검색한 작품과 라이브러리는 그대로 볼 수 있어요.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="추천 제외 설정 닫기"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onClose}
              ref={firstRef}
              style={styles.closeButton}
            >
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>관계 테마</Text>
              <View style={styles.options}>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <FilterChip
                    disabled={isSaving}
                    key={option.key}
                    label={option.label}
                    onPress={() => onToggleTheme(option.key)}
                    selected={themeKeys.has(option.key)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>장르</Text>
              <View style={styles.options}>
                {GENRE_OPTIONS.map((option) => (
                  <FilterChip
                    disabled={isSaving}
                    key={option.key}
                    label={option.label}
                    onPress={() => onToggleGenre(option.key)}
                    selected={genreKeys.has(option.key)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FilterChip({
  disabled,
  label,
  onPress,
  selected
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} 추천 제외`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : null]}
    >
      <Ionicons
        color={selected ? colors.surface : colors.textMuted}
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={18}
      />
      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>{label}</Text>
    </Pressable>
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
    maxHeight: "85%",
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
  header: { flexDirection: "row", gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  closeButton: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 },
  scroll: { flexShrink: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  optionTextSelected: { color: colors.surface }
});
