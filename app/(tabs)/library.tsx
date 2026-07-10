import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { GenreFilterChips } from "@/components/common/GenreFilterChips";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { YearSelect } from "@/components/common/YearSelect";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentGalleryCard } from "@/components/content/ContentGalleryCard";
import {
  LibraryFilterBottomSheet,
  type LibrarySheetFilterState
} from "@/components/library/LibraryFilterBottomSheet";
import { LibraryStatusFilter as LibraryStatusFilterBar } from "@/components/library/LibraryStatusFilter";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import { useLibrary } from "@/hooks/useLibrary";
import { buildLibraryShareUrl, createLibraryShare, shareLibraryUrl } from "@/services/libraryShare";
import { useLibraryUiStore } from "@/stores/libraryUiStore";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import type { DateSortOrder } from "@/utils/contentSort";
import { ALL_GENRE_FILTER } from "@/utils/genre";
import {
  CONTENT_TYPE_FILTERS,
  CONTENT_TYPE_LABELS,
  createLibraryShareTitle,
  filterLibraryItems,
  parseGenreFilters,
  RATING_FILTERS,
  STATUS_FILTERS,
  type ContentTypeFilter,
  type RatingFilter
} from "@/utils/libraryFilters";
import { createLibraryRouteParams, parseLibraryRouteParams } from "@/utils/libraryRouteParams";
import { getLibraryResponsiveLayout } from "@/utils/libraryResponsive";

type ShareFeedback =
  | { status: "loading"; message: string; url?: undefined }
  | { status: "success"; message: string; url: string }
  | { status: "error"; message: string; url?: undefined };

export default function LibraryScreen() {
  const params = useLocalSearchParams<{
    status?: string;
    libraryType?: string;
    genre?: string;
    rating?: string;
    q?: string;
    year?: string;
    sort?: string;
    view?: string;
  }>();
  const routeState = parseLibraryRouteParams(params);
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>(routeState.statusFilter);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>(routeState.contentTypeFilter);
  const [genreFilter, setGenreFilter] = useState(routeState.genreFilter);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(routeState.ratingFilter);
  const [searchQuery, setSearchQuery] = useState(routeState.searchQuery);
  const [year, setYear] = useState(routeState.year);
  const [sortOrder, setSortOrder] = useState<DateSortOrder>(routeState.sortOrder);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleItemCount, setVisibleItemCount] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback | null>(null);
  const listRef = useRef<FlashListRef<LibraryListItem>>(null);
  const filterButtonRef = useRef<View>(null);
  const loadMoreQueuedRef = useRef(false);
  const viewMode = useLibraryUiStore((state) => state.viewMode);
  const setViewMode = useLibraryUiStore((state) => state.setViewMode);
  const { width } = useWindowDimensions();
  const { galleryColumns, isDesktop, isMobile } = getLibraryResponsiveLayout(width);
  const library = useLibrary(statusFilter);
  const router = useRouter();
  const filters = useMemo(
    () => ({
      statusFilter,
      contentTypeFilter,
      genreFilter,
      ratingFilter,
      searchQuery,
      year,
      sortOrder
    }),
    [contentTypeFilter, genreFilter, ratingFilter, searchQuery, sortOrder, statusFilter, year]
  );
  const advancedFilterCount =
    (isMobile && contentTypeFilter !== "all" ? 1 : 0) +
    parseGenreFilters(genreFilter).length +
    [ratingFilter !== "all", Boolean(year), sortOrder !== "latest"].filter(Boolean).length;
  const isGallery = viewMode === "gallery";
  const pageSize = isGallery ? galleryColumns * 2 : 4;
  const genreOptions = useMemo(
    () => (library.data ?? []).flatMap((item) => item.genres),
    [library.data]
  );
  const filteredItems = useMemo(
    () => filterLibraryItems(library.data ?? [], filters),
    [filters, library.data]
  );
  const libraryRouteParams = useMemo(
    () => createLibraryRouteParams(filters, viewMode),
    [filters, viewMode]
  );
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleItemCount),
    [filteredItems, visibleItemCount]
  );
  const visibleItemEnd = Math.min(visibleItemCount, filteredItems.length);
  const hasMoreItems = visibleItemEnd < filteredItems.length;
  const hasActiveFilter =
    statusFilter !== "all" ||
    contentTypeFilter !== "all" ||
    genreFilter !== ALL_GENRE_FILTER ||
    ratingFilter !== "all" ||
    Boolean(searchQuery.trim()) ||
    Boolean(year) ||
    sortOrder !== "latest";

  useEffect(() => {
    setStatusFilter(routeState.statusFilter);
    setContentTypeFilter(routeState.contentTypeFilter);
    setGenreFilter(routeState.genreFilter);
    setRatingFilter(routeState.ratingFilter);
    setSearchQuery(routeState.searchQuery);
    setYear(routeState.year);
    setSortOrder(routeState.sortOrder);
    if (routeState.viewMode) setViewMode(routeState.viewMode);
  }, [
    routeState.contentTypeFilter,
    routeState.genreFilter,
    routeState.ratingFilter,
    routeState.searchQuery,
    routeState.sortOrder,
    routeState.statusFilter,
    routeState.viewMode,
    routeState.year,
    setViewMode
  ]);

  useEffect(() => {
    setVisibleItemCount(pageSize);
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [contentTypeFilter, genreFilter, pageSize, ratingFilter, searchQuery, sortOrder, statusFilter, viewMode, year]);

  const loadMoreItems = useCallback(() => {
    if (loadMoreQueuedRef.current) return;
    if (!hasMoreItems) return;
    loadMoreQueuedRef.current = true;
    requestAnimationFrame(() => {
      setVisibleItemCount((count) => Math.min(count + pageSize, filteredItems.length));
      loadMoreQueuedRef.current = false;
    });
  }, [filteredItems.length, hasMoreItems, pageSize]);

  const commitFilters = useCallback(
    (patch: Partial<typeof filters>) => {
      const next = { ...filters, ...patch };
      setStatusFilter(next.statusFilter);
      setContentTypeFilter(next.contentTypeFilter);
      setGenreFilter(next.genreFilter);
      setRatingFilter(next.ratingFilter);
      setSearchQuery(next.searchQuery);
      setYear(next.year);
      setSortOrder(next.sortOrder);
      router.setParams({
        ...createLibraryRouteParams(next, viewMode),
        q: next.searchQuery.trim() || undefined,
        year: next.year.trim() || undefined
      });
    },
    [filters, router, viewMode]
  );

  const changeViewMode = useCallback(
    (nextViewMode: "detail" | "gallery") => {
      setViewMode(nextViewMode);
      router.setParams({ view: nextViewMode });
    },
    [router, setViewMode]
  );

  const resetFilters = useCallback(() => {
    commitFilters({
      statusFilter: "all",
      contentTypeFilter: "all",
      genreFilter: ALL_GENRE_FILTER,
      ratingFilter: "all",
      searchQuery: "",
      year: "",
      sortOrder: "latest"
    });
  }, [commitFilters]);

  const restoreFilterButtonFocus = useCallback(() => {
    (filterButtonRef.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, []);

  const closeMobileFilters = useCallback(() => {
    setShowFilters(false);
    setTimeout(restoreFilterButtonFocus, 0);
  }, [restoreFilterButtonFocus]);

  const applySheetFilters = useCallback(
    (next: LibrarySheetFilterState) => {
      commitFilters(next);
      closeMobileFilters();
    },
    [closeMobileFilters, commitFilters]
  );

  const shareCurrentView = async () => {
    if (!filteredItems.length) {
      setShareFeedback({ status: "error", message: "현재 필터 조건에 맞는 공유할 작품이 없습니다." });
      return;
    }

    setIsSharing(true);
    setShareFeedback({ status: "loading", message: "공유 링크를 생성하고 있습니다." });
    try {
      const title = createLibraryShareTitle(filters);
      const share = await withTimeout(
        createLibraryShare({
          title,
          filters,
          contentIds: filteredItems.map((item) => item.content_id)
        }),
        15000,
        "공유 링크 생성 요청이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
      );
      const url = buildLibraryShareUrl(share.id);
      setShareFeedback({ status: "success", message: "공유 링크를 생성했습니다.", url });

      try {
        const delivery = await shareLibraryUrl({ title, url });
        const message =
          delivery === "shared"
            ? "공유 앱으로 보낼 준비를 마쳤습니다."
            : delivery === "copied"
              ? "공유 링크를 생성하고 클립보드에 복사했습니다."
              : "공유 링크를 생성했습니다.";
        setShareFeedback({
          status: "success",
          message,
          url
        });
      } catch {
        setShareFeedback({
          status: "success",
          message: "공유 링크를 생성했습니다. 클립보드 복사는 브라우저에서 허용되지 않았습니다.",
          url
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다.";
      setShareFeedback({ status: "error", message });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterSection}>
        <TextInput
          accessibilityLabel="라이브러리 검색"
          onChangeText={(value) => commitFilters({ searchQuery: value })}
          placeholder="작품명, 출연자, 성우 검색"
          style={styles.searchInput}
          value={searchQuery}
        />
        {isMobile ? (
          <>
            <LibraryStatusFilterBar compact onChange={(value) => commitFilters({ statusFilter: value })} value={statusFilter} />
            <View style={styles.mobileToolRow}>
              <View style={styles.mobileToolGroup}>
                <Pressable
                  accessibilityLabel="엑셀 업로드"
                  accessibilityRole="button"
                  onPress={() => router.push("/library/import")}
                  style={styles.mobileIconButton}
                >
                  <Ionicons color={colors.textMuted} name="cloud-upload-outline" size={19} />
                </Pressable>
                <Pressable
                  accessibilityLabel={isSharing ? "공유 중" : "라이브러리 공유"}
                  accessibilityRole="button"
                  disabled={isSharing || library.isLoading}
                  onPress={shareCurrentView}
                  style={[styles.mobileIconButton, isSharing || library.isLoading ? styles.toolButtonDisabled : null]}
                >
                  <Ionicons color={colors.textMuted} name="share-social-outline" size={19} />
                </Pressable>
              </View>
              <View style={styles.mobileToolGroup}>
                {[
                  { label: "자세히 보기", value: "detail" as const, icon: "list-outline" as const },
                  { label: "갤러리 보기", value: "gallery" as const, icon: "grid-outline" as const }
                ].map((item) => {
                  const selected = item.value === viewMode;
                  return (
                    <Pressable
                      accessibilityLabel={item.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      key={item.value}
                      onPress={() => changeViewMode(item.value)}
                      style={[styles.mobileIconButton, selected ? styles.filterSelected : null]}
                    >
                      <Ionicons color={selected ? colors.surface : colors.textMuted} name={item.icon} size={19} />
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showFilters }}
                  ref={filterButtonRef}
                  onPress={() => setShowFilters(true)}
                  style={[styles.mobileFilterButton, advancedFilterCount > 0 ? styles.filterSelected : null]}
                >
                  <Ionicons
                    color={advancedFilterCount > 0 ? colors.surface : colors.textMuted}
                    name="options-outline"
                    size={18}
                  />
                  <Text style={[styles.filterText, advancedFilterCount > 0 ? styles.filterTextSelected : null]}>
                    {advancedFilterCount > 0 ? `필터 ${advancedFilterCount}` : "필터"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
        <View style={[styles.quickBar, !isDesktop ? styles.quickBarTablet : null]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.primaryFiltersScroll}
            contentContainerStyle={styles.primaryFilters}
          >
            <View
              accessibilityLabel="시청 상태"
              style={styles.filterGroupIcon}
            >
              <Ionicons color={colors.textMuted} name="eye-outline" size={15} />
            </View>
            {STATUS_FILTERS.map((item) => {
              const selected = item === statusFilter;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item}
                  onPress={() => commitFilters({ statusFilter: item })}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {item === "all" ? "전체" : WATCH_STATUS_LABEL[item]}
                  </Text>
                </Pressable>
              );
            })}
            <View style={styles.filterDivider} />
            <View
              accessibilityLabel="작품 유형"
              style={styles.filterGroupIcon}
            >
              <Ionicons color={colors.textMuted} name="albums-outline" size={15} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: contentTypeFilter === "all" }}
              onPress={() => commitFilters({ contentTypeFilter: "all" })}
              style={[styles.filter, contentTypeFilter === "all" && styles.filterSelected]}
            >
              <Text style={[styles.filterText, contentTypeFilter === "all" && styles.filterTextSelected]}>
                전체
              </Text>
            </Pressable>
            {CONTENT_TYPE_FILTERS.filter((item) => item !== "all").map((item) => {
              const selected = item === contentTypeFilter;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item}
                  onPress={() => commitFilters({ contentTypeFilter: item })}
                  style={[styles.filter, selected && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {CONTENT_TYPE_LABELS[item]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.toolGroup}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/library/import")}
              style={styles.toolButton}
            >
              <Ionicons color={colors.textMuted} name="cloud-upload-outline" size={16} />
              <Text style={styles.filterText}>엑셀 업로드</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSharing || library.isLoading}
              onPress={shareCurrentView}
              style={[styles.toolButton, isSharing || library.isLoading ? styles.toolButtonDisabled : null]}
            >
              <Ionicons color={colors.textMuted} name="share-social-outline" size={16} />
              <Text style={styles.filterText}>{isSharing ? "공유 중" : "공유"}</Text>
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
                  onPress={() => changeViewMode(item.value)}
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
        )}

        {showFilters && !isMobile ? (
          <View style={styles.advancedFilters}>
            <View style={styles.dateRow}>
              <YearSelect onChange={(value) => commitFilters({ year: value })} value={year} />
              {[
                { label: "최신순", value: "latest" as const },
                { label: "오래된순", value: "oldest" as const }
              ].map((item) => {
                const selected = item.value === sortOrder;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.value}
                    onPress={() => commitFilters({ sortOrder: item.value })}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <GenreFilterChips
              genres={genreOptions}
              multiple
              onChange={(value) => commitFilters({ genreFilter: value })}
              value={genreFilter}
            />
            <View style={styles.ratingFilterGroup}>
              <Text style={styles.ratingFilterLabel}>추천점수</Text>
              <View style={styles.ratingFilterChips}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: ratingFilter === "all" }}
                  onPress={() => commitFilters({ ratingFilter: "all" })}
                  style={[styles.filter, ratingFilter === "all" && styles.filterSelected]}
                >
                  <Text style={[styles.filterText, ratingFilter === "all" && styles.filterTextSelected]}>전체</Text>
                </Pressable>
                {RATING_FILTERS.map((rating) => {
                  const selected = rating === ratingFilter;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={rating}
                      onPress={() => commitFilters({ ratingFilter: rating })}
                      style={[styles.filter, selected && styles.filterSelected]}
                    >
                      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{rating}/10</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {shareFeedback ? (
          <View
            style={[
              styles.shareFeedback,
              shareFeedback.status === "error" ? styles.shareFeedbackError : null,
              shareFeedback.status === "success" ? styles.shareFeedbackSuccess : null
            ]}
          >
            <Text
              selectable
              style={[
                styles.shareFeedbackText,
                shareFeedback.status === "error" ? styles.shareFeedbackTextError : null
              ]}
            >
              {shareFeedback.message}
            </Text>
            {shareFeedback.url ? (
              <Text selectable numberOfLines={2} style={styles.shareFeedbackUrl}>
                {shareFeedback.url}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {library.isLoading ? <LoadingSkeleton /> : null}
      {library.isError ? <ErrorState onRetry={() => library.refetch()} /> : null}
      {!library.isLoading && !filteredItems.length ? (
        <EmptyState
          actionLabel={hasActiveFilter ? "필터 초기화" : "작품 검색하기"}
          description={
            hasActiveFilter
              ? "선택한 조건에 맞는 작품이 없습니다."
              : "검색에서 작품을 추가하면 라이브러리가 채워집니다."
          }
          onAction={hasActiveFilter ? resetFilters : () => router.push("/search")}
          title={hasActiveFilter ? "조건에 맞는 작품이 없어요" : "라이브러리가 비어 있어요"}
        />
      ) : null}

      <FlashList
        ItemSeparatorComponent={isGallery ? undefined : () => <View style={{ height: spacing.md }} />}
        ListFooterComponent={
          filteredItems.length > pageSize ? (
            <InfiniteScrollFooter
              hasMoreItems={hasMoreItems}
              visibleItemEnd={visibleItemEnd}
              totalItems={filteredItems.length}
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        data={visibleItems}
        key={viewMode}
        keyExtractor={(item) => item.library_item_id}
        numColumns={isGallery ? galleryColumns : 1}
        onEndReached={loadMoreItems}
        onEndReachedThreshold={0.6}
        ref={listRef}
        renderItem={({ item }) => (
          isGallery ? (
            <ContentGalleryCard
              item={item}
              onOpenEpisodes={() =>
                router.push({ pathname: "/content/[id]/episodes", params: { id: item.content_id } })
              }
              onPress={() =>
                router.push({
                  pathname: "/content/[id]",
                  params: { id: item.content_id, ...libraryRouteParams }
                })
              }
            />
          ) : (
            <ContentCard
              item={item}
              onOpenEpisodes={() =>
                router.push({ pathname: "/content/[id]/episodes", params: { id: item.content_id } })
              }
              onPress={() =>
                router.push({
                  pathname: "/content/[id]",
                  params: { id: item.content_id, ...libraryRouteParams }
                })
              }
            />
          )
        )}
      />
      {isMobile ? (
        <LibraryFilterBottomSheet
          filters={filters}
          genreOptions={genreOptions}
          onApply={applySheetFilters}
          onClose={closeMobileFilters}
          onClosed={restoreFilterButtonFocus}
          visible={showFilters}
        />
      ) : null}
    </View>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function InfiniteScrollFooter({
  hasMoreItems,
  visibleItemEnd,
  totalItems,
}: {
  hasMoreItems: boolean;
  visibleItemEnd: number;
  totalItems: number;
}) {
  return (
    <View style={styles.infiniteFooter}>
      <Text style={styles.infiniteFooterInfo}>
        1-{visibleItemEnd} / {totalItems}
      </Text>
      {!hasMoreItems ? <Text style={styles.infiniteFooterHint}>전체 표시 완료</Text> : null}
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
  quickBarTablet: {
    alignItems: "stretch",
    flexDirection: "column"
  },
  mobileToolRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  mobileToolGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  mobileIconButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  mobileFilterButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  primaryFiltersScroll: {
    flex: 1,
    minWidth: 0
  },
  primaryFilters: {
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  filterDivider: {
    backgroundColor: colors.border,
    height: 30,
    marginHorizontal: spacing.xs,
    width: StyleSheet.hairlineWidth
  },
  filterGroupIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 30,
    justifyContent: "center",
    width: 30
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
  toolButtonDisabled: {
    opacity: 0.48
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
  shareFeedback: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  shareFeedbackSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0"
  },
  shareFeedbackError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  shareFeedbackText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  shareFeedbackTextError: {
    color: "#B91C1C"
  },
  shareFeedbackUrl: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  ratingFilterGroup: {
    gap: spacing.xs
  },
  ratingFilterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  ratingFilterChips: {
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
  infiniteFooter: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  infiniteFooterInfo: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  infiniteFooterHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  }
});
