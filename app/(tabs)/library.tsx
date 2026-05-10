import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { GenreFilterChips } from "@/components/common/GenreFilterChips";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { YearSelect } from "@/components/common/YearSelect";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentGalleryCard } from "@/components/content/ContentGalleryCard";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import type { ContentType } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import { filterByYear, normalizeYearFilter, sortByYear, type DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER, matchesGenreFilter } from "@/utils/genre";

type ContentTypeFilter = ContentType | "all";
type LibraryViewMode = "detail" | "gallery";

const STATUS_FILTERS: LibraryStatusFilter[] = [
  "all",
  "watching",
  "wishlist",
  "completed",
  "recommended",
  "not_recommended"
];

const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
  all: "전체",
  anime: "애니",
  kdrama: "한국 드라마",
  jdrama: "일본 드라마",
  movie: "영화",
  other: "기타"
};

const CONTENT_TYPE_FILTERS: ContentTypeFilter[] = ["all", "anime", "kdrama", "jdrama", "movie", "other"];

export default function LibraryScreen() {
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [genreFilter, setGenreFilter] = useState(ALL_GENRE_FILTER);
  const [searchQuery, setSearchQuery] = useState("");
  const [year, setYear] = useState("");
  const [sortOrder, setSortOrder] = useState<DateSortOrder>("latest");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("detail");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const listRef = useRef<FlashListRef<LibraryListItem>>(null);
  const { width } = useWindowDimensions();
  const library = useLibrary(statusFilter);
  const router = useRouter();
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const yearFilter = normalizeYearFilter(year);
  const advancedFilterCount = [
    contentTypeFilter !== "all",
    genreFilter !== ALL_GENRE_FILTER,
    Boolean(year),
    sortOrder !== "latest"
  ].filter(Boolean).length;
  const galleryColumns = width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 3;
  const isGallery = viewMode === "gallery";
  const pageSize = isGallery ? galleryColumns * 2 : 4;
  const genreOptions = useMemo(
    () => (library.data ?? []).flatMap((item) => item.genres),
    [library.data]
  );
  const filteredItems = useMemo(
    () => {
      const searchedItems = (library.data ?? []).filter((item) => {
        const contentTypeMatches = contentTypeFilter === "all" ? true : item.content_type === contentTypeFilter;
        if (!contentTypeMatches) return false;
        if (!matchesGenreFilter(item.genres, genreFilter)) return false;
        if (!normalizedSearchQuery) return true;

        const searchableText = [
          item.title_primary,
          item.title_original,
          ...(item.cast ?? []).flatMap((member) => [member.name, member.original_name, member.character])
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();

        return searchableText.includes(normalizedSearchQuery);
      });

      return sortByYear(filterByYear(searchedItems, yearFilter), sortOrder);
    },
    [contentTypeFilter, genreFilter, library.data, normalizedSearchQuery, sortOrder, yearFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pageItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredItems, pageSize]
  );
  const pageStart = filteredItems.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, filteredItems.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [contentTypeFilter, genreFilter, normalizedSearchQuery, sortOrder, statusFilter, viewMode, yearFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [currentPage, pageSize]);

  return (
    <View style={styles.container}>
      <View style={styles.filterSection}>
        <TextInput
          accessibilityLabel="라이브러리 검색"
          onChangeText={setSearchQuery}
          placeholder="작품명, 출연자, 성우 검색"
          style={styles.searchInput}
          value={searchQuery}
        />
        <View style={styles.quickBar}>
          <View style={styles.statusFilters}>
            {STATUS_FILTERS.map((item) => {
              const selected = item === statusFilter;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={item}
                  onPress={() => setStatusFilter(item)}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {item === "all" ? "전체" : WATCH_STATUS_LABEL[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toolGroup}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/library/import")}
              style={styles.toolButton}
            >
              <Ionicons color={colors.textMuted} name="cloud-upload-outline" size={16} />
              <Text style={styles.filterText}>엑셀 업로드</Text>
            </Pressable>

            {[
              { label: "자세히", value: "detail" as const, icon: "list-outline" as const },
              { label: "갤러리", value: "gallery" as const, icon: "grid-outline" as const }
            ].map((item) => {
              const selected = item.value === viewMode;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.value}
                  onPress={() => setViewMode(item.value)}
                  style={[styles.toolButton, selected && styles.filterSelected]}
                >
                  <Ionicons
                    color={selected ? colors.surface : colors.textMuted}
                    name={item.icon}
                    size={16}
                  />
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showFilters }}
              onPress={() => setShowFilters((current) => !current)}
              style={[
                styles.toolButton,
                (showFilters || advancedFilterCount > 0) && styles.filterSelected
              ]}
            >
              <Ionicons
                color={showFilters || advancedFilterCount > 0 ? colors.surface : colors.textMuted}
                name="options-outline"
                size={16}
              />
              <Text
                style={[
                  styles.filterText,
                  (showFilters || advancedFilterCount > 0) && styles.filterTextSelected
                ]}
              >
                {advancedFilterCount > 0 ? `필터 ${advancedFilterCount}` : "필터"}
              </Text>
            </Pressable>
          </View>
        </View>

        {showFilters ? (
          <View style={styles.advancedFilters}>
            <View style={styles.dateRow}>
              <YearSelect onChange={setYear} value={year} />
              {[
                { label: "최신순", value: "latest" as const },
                { label: "오래된순", value: "oldest" as const }
              ].map((item) => {
                const selected = item.value === sortOrder;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.value}
                    onPress={() => setSortOrder(item.value)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.filters}>
              {CONTENT_TYPE_FILTERS.map((item) => {
                const selected = item === contentTypeFilter;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => setContentTypeFilter(item)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {CONTENT_TYPE_LABELS[item]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <GenreFilterChips genres={genreOptions} onChange={setGenreFilter} value={genreFilter} />
          </View>
        ) : null}
      </View>

      {library.isLoading ? <LoadingSkeleton /> : null}
      {library.isError ? <ErrorState onRetry={() => library.refetch()} /> : null}
      {!library.isLoading && !filteredItems.length ? (
        <EmptyState
          actionLabel="작품 검색하기"
          description={
            library.data?.length
              ? "선택한 조건에 맞는 작품이 없습니다."
              : "검색에서 작품을 추가하면 라이브러리가 채워집니다."
          }
          onAction={() => router.push("/search")}
          title={library.data?.length ? "조건에 맞는 작품이 없어요" : "라이브러리가 비어 있어요"}
        />
      ) : null}

      <FlashList
        ItemSeparatorComponent={isGallery ? undefined : () => <View style={{ height: spacing.md }} />}
        ListFooterComponent={
          filteredItems.length > pageSize ? (
            <PaginationControls
              currentPage={currentPage}
              onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
              pageEnd={pageEnd}
              pageStart={pageStart}
              totalItems={filteredItems.length}
              totalPages={totalPages}
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        data={pageItems}
        key={viewMode}
        keyExtractor={(item) => item.library_item_id}
        numColumns={isGallery ? galleryColumns : 1}
        ref={listRef}
        renderItem={({ item }) => (
          isGallery ? (
            <ContentGalleryCard
              item={item}
              onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.content_id } })}
            />
          ) : (
            <ContentCard
              item={item}
              onPress={() => router.push({ pathname: "/content/[id]", params: { id: item.content_id } })}
            />
          )
        )}
      />
    </View>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalItems,
  onPrevious,
  onNext
}: {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationInfo}>
        {pageStart}-{pageEnd} / {totalItems}
      </Text>
      <View style={styles.paginationButtons}>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoPrevious}
          onPress={onPrevious}
          style={[styles.pageButton, !canGoPrevious ? styles.pageButtonDisabled : null]}
        >
          <Ionicons color={canGoPrevious ? colors.text : colors.textMuted} name="chevron-back" size={16} />
          <Text style={[styles.pageButtonText, !canGoPrevious ? styles.pageButtonTextDisabled : null]}>이전</Text>
        </Pressable>
        <Text style={styles.pageIndicator}>
          {currentPage} / {totalPages}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoNext}
          onPress={onNext}
          style={[styles.pageButton, !canGoNext ? styles.pageButtonDisabled : null]}
        >
          <Text style={[styles.pageButtonText, !canGoNext ? styles.pageButtonTextDisabled : null]}>다음</Text>
          <Ionicons color={canGoNext ? colors.text : colors.textMuted} name="chevron-forward" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  listContent: {
    paddingBottom: 104
  },
  filterSection: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 1000
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  dateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickBar: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  statusFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  toolGroup: {
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
  advancedFilters: {
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
  filter: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  filterTextSelected: {
    color: colors.surface
  },
  pagination: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  paginationInfo: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  paginationButtons: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  pageButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  pageButtonDisabled: {
    opacity: 0.45
  },
  pageButtonText: {
    color: colors.text,
    fontWeight: "800"
  },
  pageButtonTextDisabled: {
    color: colors.textMuted
  },
  pageIndicator: {
    color: colors.text,
    fontWeight: "900",
    minWidth: 52,
    textAlign: "center"
  }
});
