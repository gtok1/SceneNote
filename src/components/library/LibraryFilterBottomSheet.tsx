import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { YearSelect } from "@/components/common/YearSelect";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER, createGenreFilterOptions } from "@/utils/genre";
import {
  CONTENT_TYPE_FILTERS,
  CONTENT_TYPE_LABELS,
  RATING_FILTERS,
  STATUS_FILTERS,
  parseGenreFilters,
  serializeGenreFilters,
  type ContentTypeFilter,
  type LibraryFilterState,
  type RatingFilter
} from "@/utils/libraryFilters";

export interface LibrarySheetFilterState {
  statusFilter: LibraryStatusFilter;
  contentTypeFilter: ContentTypeFilter;
  genreFilter: string;
  ratingFilter: RatingFilter;
  year: string;
  sortOrder: DateSortOrder;
}

interface LibraryFilterBottomSheetProps {
  visible: boolean;
  filters: LibraryFilterState;
  genreOptions: string[];
  onApply: (filters: LibrarySheetFilterState) => void;
  onClose: () => void;
  onClosed?: () => void;
  onOpenImport: () => void;
  onReset: () => void;
}

export function LibraryFilterBottomSheet({
  visible,
  filters,
  genreOptions,
  onApply,
  onClose,
  onClosed,
  onOpenImport,
  onReset
}: LibraryFilterBottomSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const closeButtonRef = useRef<View>(null);
  const [draft, setDraft] = useState<LibrarySheetFilterState>(() => pickSheetFilters(filters));
  const genres = useMemo(() => createGenreFilterOptions(genreOptions), [genreOptions]);
  const selectedGenres = useMemo(() => parseGenreFilters(draft.genreFilter), [draft.genreFilter]);

  useEffect(() => {
    if (!visible) return;
    setDraft(pickSheetFilters(filters));
    const focusTimer = setTimeout(() => {
      (closeButtonRef.current as unknown as { focus?: () => void } | null)?.focus?.();
    }, 0);
    return () => clearTimeout(focusTimer);
  }, [filters, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, visible]);

  const toggleGenre = (genre: string) => {
    const nextGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((item) => item !== genre)
      : [...selectedGenres, genre];
    setDraft((current) => ({ ...current, genreFilter: serializeGenreFilters(nextGenres) }));
  };

  return (
    <Modal animationType="slide" onDismiss={onClosed} onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="필터 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityLabel="라이브러리 필터"
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          style={[styles.sheet, { maxHeight: height * 0.85 }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>필터</Text>
            <Pressable
              accessibilityLabel="필터 닫기"
              onPress={onClose}
              ref={closeButtonRef}
              style={styles.iconButton}
            >
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
          >
            <FilterSection title="작품 유형">
              <View style={styles.chips}>
                {CONTENT_TYPE_FILTERS.map((item) => (
                  <FilterChip
                    key={item}
                    label={item === "all" ? "전체 유형" : CONTENT_TYPE_LABELS[item]}
                    selected={draft.contentTypeFilter === item}
                    onPress={() => setDraft((current) => ({ ...current, contentTypeFilter: item }))}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="장르">
              <View style={styles.chips}>
                <FilterChip
                  label="전체"
                  selected={!selectedGenres.length}
                  onPress={() => setDraft((current) => ({ ...current, genreFilter: ALL_GENRE_FILTER }))}
                />
                {genres.map((genre) => (
                  <FilterChip
                    key={genre}
                    label={genre}
                    selected={selectedGenres.includes(genre)}
                    onPress={() => toggleGenre(genre)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="시청 상태">
              <View style={styles.chips}>
                {STATUS_FILTERS.map((item) => (
                  <FilterChip
                    key={item}
                    label={item === "all" ? "전체" : WATCH_STATUS_LABEL[item]}
                    selected={draft.statusFilter === item}
                    onPress={() => setDraft((current) => ({ ...current, statusFilter: item }))}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="연도와 정렬">
              <View style={styles.sortRow}>
                <YearSelect value={draft.year} onChange={(year) => setDraft((current) => ({ ...current, year }))} />
                {(["latest", "oldest"] as const).map((item) => (
                  <FilterChip
                    key={item}
                    label={item === "latest" ? "최신순" : "오래된순"}
                    selected={draft.sortOrder === item}
                    onPress={() => setDraft((current) => ({ ...current, sortOrder: item }))}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="추천점수">
              <View style={styles.chips}>
                <FilterChip
                  label="전체"
                  selected={draft.ratingFilter === "all"}
                  onPress={() => setDraft((current) => ({ ...current, ratingFilter: "all" }))}
                />
                {RATING_FILTERS.map((rating) => (
                  <FilterChip
                    key={rating}
                    label={`${rating}/10`}
                    selected={draft.ratingFilter === rating}
                    onPress={() => setDraft((current) => ({ ...current, ratingFilter: rating }))}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="데이터 관리">
              <Pressable accessibilityRole="button" onPress={onOpenImport} style={styles.importButton}>
                <Ionicons color={colors.text} name="cloud-upload-outline" size={19} />
                <View style={styles.importTextBox}>
                  <Text style={styles.importTitle}>엑셀 업로드</Text>
                  <Text style={styles.importDescription}>엑셀 파일에서 작품을 라이브러리로 가져옵니다.</Text>
                </View>
                <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
              </Pressable>
            </FilterSection>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <Pressable accessibilityRole="button" onPress={onReset} style={styles.resetButton}>
              <Ionicons color={colors.text} name="refresh-outline" size={18} />
              <Text style={styles.resetText}>초기화</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onApply(draft)} style={styles.applyButton}>
              <Text style={styles.applyText}>적용</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function pickSheetFilters(filters: LibraryFilterState): LibrarySheetFilterState {
  return {
    statusFilter: filters.statusFilter,
    contentTypeFilter: filters.contentTypeFilter,
    genreFilter: filters.genreFilter,
    ratingFilter: filters.ratingFilter,
    year: filters.year,
    sortOrder: filters.sortOrder
  };
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      {selected ? <Ionicons color={colors.surface} name="checkmark" size={15} /> : null}
      <Text numberOfLines={1} style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.46)",
    flex: 1,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden"
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 4,
    marginTop: spacing.sm,
    width: 42
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44
  },
  scrollContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  sheetScroll: {
    flexShrink: 1
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  sortRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  chipTextSelected: {
    color: colors.surface
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  resetButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg
  },
  resetText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  importButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  importTextBox: {
    flex: 1,
    gap: 2
  },
  importTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  importDescription: {
    color: colors.textMuted,
    fontSize: 12
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    flex: 1,
    justifyContent: "center",
    minHeight: 48
  },
  applyText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900"
  }
});
