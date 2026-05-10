import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { GenreFilterChips } from "@/components/common/GenreFilterChips";
import { YearSelect } from "@/components/common/YearSelect";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import type { MediaTypeFilter } from "@/types/content";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER } from "@/utils/genre";

const FILTERS: { label: string; value: MediaTypeFilter }[] = [
  { label: "전체", value: "all" },
  { label: "애니", value: "anime" },
  { label: "드라마", value: "drama" },
  { label: "영화", value: "movie" }
];

const STATUS_FILTERS: LibraryStatusFilter[] = ["all", "recommended", "not_recommended"];

interface ContentSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  mediaTypeFilter: MediaTypeFilter;
  onMediaTypeChange: (value: MediaTypeFilter) => void;
  year: string;
  onYearChange: (value: string) => void;
  sortOrder: DateSortOrder;
  onSortOrderChange: (value: DateSortOrder) => void;
  genreFilter?: string;
  genreOptions?: string[];
  onGenreFilterChange?: (value: string) => void;
  statusFilter?: LibraryStatusFilter;
  onStatusFilterChange?: (value: LibraryStatusFilter) => void;
  autoFocus?: boolean;
}

export function ContentSearchBar({
  value,
  onChangeText,
  onSubmit,
  mediaTypeFilter,
  onMediaTypeChange,
  year,
  onYearChange,
  sortOrder,
  onSortOrderChange,
  genreFilter = ALL_GENRE_FILTER,
  genreOptions,
  onGenreFilterChange,
  statusFilter = "all",
  onStatusFilterChange,
  autoFocus = false
}: ContentSearchBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    mediaTypeFilter !== "all",
    statusFilter !== "all",
    genreFilter !== ALL_GENRE_FILTER,
    Boolean(year),
    sortOrder !== "latest"
  ].filter(Boolean).length;
  const submitAfterSelection = () => {
    setTimeout(onSubmit, 0);
  };
  const changeMediaType = (nextMediaType: MediaTypeFilter) => {
    onMediaTypeChange(nextMediaType);
    submitAfterSelection();
  };
  const changeYear = (nextYear: string) => {
    onYearChange(nextYear);
    submitAfterSelection();
  };
  const changeSortOrder = (nextSortOrder: DateSortOrder) => {
    onSortOrderChange(nextSortOrder);
    submitAfterSelection();
  };
  const changeStatusFilter = (nextStatusFilter: LibraryStatusFilter) => {
    onStatusFilterChange?.(nextStatusFilter);
    submitAfterSelection();
  };
  const changeGenreFilter = (nextGenreFilter: string) => {
    onGenreFilterChange?.(nextGenreFilter);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="콘텐츠 검색어"
          autoFocus={autoFocus}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="작품명, 배우, 성우 검색"
          returnKeyType="search"
          style={styles.input}
          value={value}
        />
        <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.button}>
          <Text style={styles.buttonText}>검색</Text>
        </Pressable>
      </View>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((current) => !current)}
          style={[
            styles.toolButton,
            (filtersOpen || activeFilterCount > 0) && styles.toolButtonSelected
          ]}
        >
          <Ionicons
            color={filtersOpen || activeFilterCount > 0 ? colors.surface : colors.textMuted}
            name="options-outline"
            size={16}
          />
          <Text
            style={[
              styles.toolButtonText,
              (filtersOpen || activeFilterCount > 0) && styles.toolButtonTextSelected
            ]}
          >
            {activeFilterCount > 0 ? `필터 ${activeFilterCount}` : "필터"}
          </Text>
        </Pressable>
      </View>
      {filtersOpen ? (
        <View style={styles.filterPanel}>
          <View style={styles.filters}>
            {FILTERS.map((filter) => {
              const selected = filter.value === mediaTypeFilter;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={filter.value}
                  onPress={() => changeMediaType(filter.value)}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {onStatusFilterChange ? (
            <View style={styles.filters}>
              {STATUS_FILTERS.map((filter) => {
                const selected = filter === statusFilter;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={filter}
                    onPress={() => changeStatusFilter(filter)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {filter === "all" ? "내 목록 전체" : WATCH_STATUS_LABEL[filter]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {onGenreFilterChange ? (
            <GenreFilterChips
              genres={genreOptions}
              onChange={changeGenreFilter}
              value={genreFilter}
            />
          ) : null}
          <View style={styles.dateRow}>
            <YearSelect onChange={changeYear} value={year} />
            {[
              { label: "최신순", value: "latest" as const },
              { label: "오래된순", value: "oldest" as const }
            ].map((item) => {
              const selected = item.value === sortOrder;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item.value}
                  onPress={() => changeSortOrder(item.value)}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 1000
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  buttonText: {
    color: colors.surface,
    fontWeight: "800"
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  toolButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  toolButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  toolButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  toolButtonTextSelected: {
    color: colors.surface
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md,
    zIndex: 1000
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filter: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  filterTextSelected: {
    color: colors.primary
  }
});
