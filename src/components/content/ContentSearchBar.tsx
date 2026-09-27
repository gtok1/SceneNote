import { FilterSheet } from "@/components/common/FilterSheet";
import {
  createSearchFilterDraft,
  emptySearchFilters,
  type SearchFilterDraft
} from "@/utils/searchFilterDraft";
import { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { YearSelect } from "@/components/common/YearSelect";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import type { MediaTypeFilter } from "@/types/content";
import type { LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { COUNTRY_FILTER_OPTIONS } from "@/utils/countryFilter";
import { createGenreFilterOptions } from "@/utils/genre";
import { normalizeDiscoveryGenre } from "../../../supabase/functions/_shared/discoveryFilters";

type SelectedMediaType = Exclude<MediaTypeFilter, "all">;
const FILTERS: { label: string; value: SelectedMediaType }[] = [
  { label: "애니", value: "anime" },
  { label: "드라마", value: "drama" },
  { label: "영화", value: "movie" }
];
const STATUS_FILTERS: LibraryStatusFilter[] = ["all", "recommended", "not_recommended"];

interface ContentSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  filters: SearchFilterDraft;
  onApplyFilters: (filters: SearchFilterDraft) => Promise<void>;
  filtersReady: boolean;
  isSavingFilters: boolean;
  genreOptions?: string[];
  autoFocus?: boolean;
  examples?: readonly string[];
  onExamplePress?: (value: string) => void;
}

export interface ContentSearchBarHandle {
  openFilters: () => void;
}

interface FilterCheckboxProps {
  label: string;
  group: string;
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
}

const FilterCheckbox = memo(function FilterCheckbox({
  label,
  group,
  checked,
  disabled,
  onPress
}: FilterCheckboxProps) {
  return (
    <Pressable
      accessibilityLabel={`${group}: ${label}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.filter,
        styles.checkbox,
        checked && styles.filterSelected,
        disabled && styles.disabled
      ]}
    >
      <Text style={[styles.filterText, styles.checkboxLabel, checked && styles.filterTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
});

function toggleSelection<T extends string>(selected: readonly T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

export const ContentSearchBar = forwardRef<ContentSearchBarHandle, ContentSearchBarProps>(
  function ContentSearchBar(
    {
      value,
      onChangeText,
      onSubmit,
      filters,
      onApplyFilters,
      filtersReady,
      isSavingFilters,
      genreOptions,
      autoFocus = false,
      examples = [],
      onExamplePress
    },
    ref
  ) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draft, setDraft] = useState(() => createSearchFilterDraft(filters));
    const [applyError, setApplyError] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const applyInFlight = useRef(false);
    const saving = isApplying || isSavingFilters;
    const activeFilterCount = filtersReady
      ? [
          filters.mediaTypes.length > 0,
          filters.statusFilter !== "all",
          filters.genreFilters.length > 0,
          filters.countryFilters.length > 0,
          Boolean(filters.year),
          filters.sortOrder !== "latest"
        ].filter(Boolean).length
      : 0;
    const openFilters = () => {
      if (!filtersReady || saving) return;
      setDraft(createSearchFilterDraft(filters));
      setApplyError(null);
      setFiltersOpen(true);
    };
    useImperativeHandle(ref, () => ({ openFilters }));
    const apply = async () => {
      if (!filtersReady || saving || applyInFlight.current) return;
      applyInFlight.current = true;
      setIsApplying(true);
      setApplyError(null);
      try {
        await onApplyFilters(createSearchFilterDraft(draft));
        setFiltersOpen(false);
      } catch (error) {
        setApplyError(
          error instanceof Error
            ? error.message
            : "검색 조건을 저장하지 못했어요. 다시 시도해 주세요."
        );
      } finally {
        applyInFlight.current = false;
        setIsApplying(false);
      }
    };
    const changeYear = (year: string) => {
      if (!saving) setDraft((value) => ({ ...value, year }));
    };
    const changeSortOrder = (sortOrder: DateSortOrder) => {
      if (!saving) setDraft((value) => ({ ...value, sortOrder }));
    };
    const changeStatusFilter = (statusFilter: LibraryStatusFilter) => {
      if (!saving) setDraft((value) => ({ ...value, statusFilter }));
    };
    const genres = createGenreFilterOptions([
      ...(genreOptions ?? []),
      ...draft.genreFilters
    ]).filter(
      (genre, index, options) =>
        options.findIndex(
          (option) => normalizeDiscoveryGenre(option) === normalizeDiscoveryGenre(genre)
        ) === index
    );

    return (
      <View style={styles.container}>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="콘텐츠 검색어"
            autoFocus={autoFocus}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            placeholder="작품명으로 검색"
            returnKeyType="search"
            style={styles.input}
            value={value}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !filtersReady }}
            disabled={!filtersReady}
            onPress={onSubmit}
            style={[styles.button, !filtersReady && styles.disabled]}
          >
            <Text style={styles.buttonText}>검색</Text>
          </Pressable>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: filtersOpen, disabled: !filtersReady || saving }}
              disabled={!filtersReady || saving}
              onPress={openFilters}
              style={[
                styles.toolButton,
                (filtersOpen || activeFilterCount > 0) && styles.toolButtonSelected,
                (!filtersReady || saving) && styles.disabled
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
        </View>
        {examples.length > 0 ? (
          <View style={styles.examples}>
            {examples.map((example) => (
              <Pressable
                accessibilityLabel={`예시 검색: ${example}`}
                accessibilityRole="button"
                disabled={!filtersReady}
                key={example}
                onPress={() => onExamplePress?.(example)}
                style={[styles.exampleChip, !filtersReady && styles.disabled]}
              >
                <Text numberOfLines={1} style={styles.exampleText}>
                  {example}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <FilterSheet
          visible={filtersOpen}
          isApplying={saving}
          onClose={() => setFiltersOpen(false)}
          onApply={() => void apply()}
          onReset={() => {
            setDraft(createSearchFilterDraft(emptySearchFilters));
            setApplyError(null);
          }}
        >
          <View style={styles.filterPanel}>
            <Text style={styles.filterDescription}>
              여러 항목을 함께 선택할 수 있어요. 같은 그룹에서는 하나만 맞아도 포함하고,
              유형·장르·제작 국가 조건은 함께 적용해요.
            </Text>
            <Text style={styles.filterDescription}>
              적용하면 이 계정에 저장돼요. 추천에는 제외 설정도 함께 적용되며, 비슷한 작품 찾기는
              별도 조건을 사용해요.
            </Text>
            {applyError ? (
              <Text accessibilityLiveRegion="assertive" style={styles.saveError}>
                {applyError}
              </Text>
            ) : null}
            <Text style={styles.groupLabel}>작품 유형</Text>
            <View style={styles.filters}>
              <FilterCheckbox
                label="전체"
                group="작품 유형"
                checked={draft.mediaTypes.length === 0}
                disabled={saving}
                onPress={() => setDraft((value) => ({ ...value, mediaTypes: [] }))}
              />
              {FILTERS.map((filter) => (
                <FilterCheckbox
                  key={filter.value}
                  label={filter.label}
                  group="작품 유형"
                  checked={draft.mediaTypes.includes(filter.value)}
                  disabled={saving}
                  onPress={() =>
                    setDraft((value) => ({
                      ...value,
                      mediaTypes: toggleSelection(value.mediaTypes, filter.value)
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.groupLabel}>보고 싶은 장르</Text>
            <View style={styles.filters}>
              <FilterCheckbox
                label="전체"
                group="보고 싶은 장르"
                checked={draft.genreFilters.length === 0}
                disabled={saving}
                onPress={() => setDraft((value) => ({ ...value, genreFilters: [] }))}
              />
              {genres.map((genre) => {
                const key = normalizeDiscoveryGenre(genre);
                return (
                  <FilterCheckbox
                    key={key}
                    label={genre}
                    group="보고 싶은 장르"
                    checked={draft.genreFilters.some(
                      (value) => normalizeDiscoveryGenre(value) === key
                    )}
                    disabled={saving}
                    onPress={() =>
                      setDraft((value) => ({
                        ...value,
                        genreFilters: value.genreFilters.some(
                          (selected) => normalizeDiscoveryGenre(selected) === key
                        )
                          ? value.genreFilters.filter(
                              (selected) => normalizeDiscoveryGenre(selected) !== key
                            )
                          : [...value.genreFilters, genre]
                      }))
                    }
                  />
                );
              })}
            </View>
            <Text style={styles.groupLabel}>제작 국가</Text>
            <View style={styles.filters}>
              <FilterCheckbox
                label="전체"
                group="제작 국가"
                checked={draft.countryFilters.length === 0}
                disabled={saving}
                onPress={() => setDraft((value) => ({ ...value, countryFilters: [] }))}
              />
              {COUNTRY_FILTER_OPTIONS.map((option) => (
                <FilterCheckbox
                  key={option.code}
                  label={option.label}
                  group="제작 국가"
                  checked={draft.countryFilters.includes(option.code)}
                  disabled={saving}
                  onPress={() =>
                    setDraft((value) => ({
                      ...value,
                      countryFilters: toggleSelection(value.countryFilters, option.code)
                    }))
                  }
                />
              ))}
            </View>
            <Text style={styles.filterDescription}>
              아래 목록 상태·연도·정렬은 제목 검색에만 적용돼요.
            </Text>
            <View style={styles.filters}>
              {STATUS_FILTERS.map((filter) => {
                const selected = filter === draft.statusFilter;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: saving }}
                    disabled={saving}
                    key={filter}
                    onPress={() => changeStatusFilter(filter)}
                    style={[
                      styles.filter,
                      selected && styles.filterSelected,
                      saving && styles.disabled
                    ]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {filter === "all" ? "내 목록 전체" : WATCH_STATUS_LABEL[filter]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.dateRow}>
              <YearSelect onChange={changeYear} value={draft.year} />
              {[
                { label: "최신순", value: "latest" as const },
                { label: "오래된순", value: "oldest" as const }
              ].map((item) => {
                const selected = item.value === draft.sortOrder;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: saving }}
                    disabled={saving}
                    key={item.value}
                    onPress={() => changeSortOrder(item.value)}
                    style={[
                      styles.filter,
                      selected && styles.filterSelected,
                      saving && styles.disabled
                    ]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </FilterSheet>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  checkbox: { alignItems: "center", flexDirection: "row", gap: spacing.xs, maxWidth: "100%" },
  checkboxLabel: { flexShrink: 1 },
  disabled: { opacity: 0.5 },
  saveError: { color: colors.danger, fontSize: 13, lineHeight: 20 },
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
    minWidth: 0,
    flexShrink: 1,
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
    minHeight: 48,
    minWidth: 48,
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
  examples: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  exampleChip: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  exampleText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  toolButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
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
  filterDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  groupLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs
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
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
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
