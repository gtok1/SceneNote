import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentSearchBar } from "@/components/content/ContentSearchBar";
import { SearchResultGalleryCard } from "@/components/content/SearchResultGalleryCard";
import { SearchResultItem } from "@/components/content/SearchResultItem";
import { colors, radius, spacing } from "@/constants/theme";
import { useContentSearch } from "@/hooks/useContentSearch";
import { useAddToLibrary, useLibrary } from "@/hooks/useLibrary";
import { useAddFavoritePerson, usePersonContentSearch } from "@/hooks/usePeople";
import { usePopularRecommendations } from "@/hooks/usePopularRecommendations";
import type { PopularRecommendation } from "@/services/popularRecommendations";
import { useSearchUiStore } from "@/stores/searchUiStore";
import type { ContentType, MediaTypeFilter, SearchResult } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import type { PersonSearchResult } from "@/types/people";
import { filterByYear, normalizeYearFilter, sortByYear } from "@/utils/contentSort";
import { matchesGenreFilter } from "@/utils/genre";

const PERSONALIZED_RECOMMENDATION_LIMIT = 12;

export default function SearchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const query = useSearchUiStore((state) => state.query);
  const setQuery = useSearchUiStore((state) => state.setQuery);
  const mediaType = useSearchUiStore((state) => state.mediaType);
  const setMediaType = useSearchUiStore((state) => state.setMediaType);
  const statusFilter = useSearchUiStore((state) => state.statusFilter);
  const setStatusFilter = useSearchUiStore((state) => state.setStatusFilter);
  const genreFilter = useSearchUiStore((state) => state.genreFilter);
  const setGenreFilter = useSearchUiStore((state) => state.setGenreFilter);
  const year = useSearchUiStore((state) => state.year);
  const setYear = useSearchUiStore((state) => state.setYear);
  const sortOrder = useSearchUiStore((state) => state.sortOrder);
  const setSortOrder = useSearchUiStore((state) => state.setSortOrder);
  const viewMode = useSearchUiStore((state) => state.viewMode);
  const setViewMode = useSearchUiStore((state) => state.setViewMode);
  const search = useContentSearch(query, mediaType);
  const personSearch = usePersonContentSearch(query, "all");
  const library = useLibrary("all");
  const recommendations = usePopularRecommendations();
  const addToLibrary = useAddToLibrary();
  const addFavoritePerson = useAddFavoritePerson();
  const [addedSearchKeys, setAddedSearchKeys] = useState<Set<string>>(() => new Set());
  const [addedRecommendationKeys, setAddedRecommendationKeys] = useState<Set<string>>(() => new Set());
  const [pendingSearchKey, setPendingSearchKey] = useState<string | null>(null);
  const [pendingRecommendationKey, setPendingRecommendationKey] = useState<string | null>(null);
  const yearFilter = normalizeYearFilter(year);
  const libraryItemsByExternalKey = useMemo(() => {
    return new Map(
      (library.data ?? [])
        .filter((item) => item.source_api !== "manual")
        .map((item) => [`${item.source_api}:${item.source_id}`, item])
    );
  }, [library.data]);
  const baseResults = useMemo(
    () =>
      sortByYear(
        filterByYear(
          filterResultsByLibraryStatus(
            mergeSearchResults(
              search.data?.results ?? [],
              filterResultsByMediaType(personSearch.data?.results ?? [], mediaType)
            ),
            statusFilter,
            library.data ?? []
          ),
          yearFilter
        ),
        sortOrder
      ),
    [library.data, mediaType, personSearch.data?.results, search.data?.results, sortOrder, statusFilter, yearFilter]
  );
  const genreOptions = useMemo(
    () => baseResults.flatMap((result) => result.genres ?? []),
    [baseResults]
  );
  const activeResults = useMemo(
    () => baseResults.filter((result) => matchesGenreFilter(result.genres, genreFilter)),
    [baseResults, genreFilter]
  );
  const isLoading = search.isLoading || personSearch.isLoading || (statusFilter !== "all" && library.isLoading);
  const isError = search.isError && personSearch.isError;
  const error = search.error ?? personSearch.error;
  const isGallery = viewMode === "gallery";
  const galleryColumns = width >= 1280 ? 6 : width >= 960 ? 5 : width >= 700 ? 4 : 3;
  const hasSearchQuery = query.trim().length >= 2;
  const recommendationPool = useMemo(
    () => [
      ...(recommendations.data?.categories.drama ?? []),
      ...(recommendations.data?.categories.anime ?? [])
    ],
    [recommendations.data?.categories.anime, recommendations.data?.categories.drama]
  );
  const locallyAddedKeys = useMemo(
    () => new Set([...addedSearchKeys, ...addedRecommendationKeys]),
    [addedSearchKeys, addedRecommendationKeys]
  );
  const personalizedRecommendations = useMemo(
    () =>
      createPersonalizedRecommendations({
        addedKeys: locallyAddedKeys,
        items: recommendationPool,
        libraryItems: library.data ?? [],
        mediaType
      }),
    [library.data, locallyAddedKeys, mediaType, recommendationPool]
  );
  const recommendationIsLoading = !hasSearchQuery && (recommendations.isLoading || library.isLoading);
  const displayedResults = hasSearchQuery ? activeResults : personalizedRecommendations;
  const displayedAsGallery = !hasSearchQuery || isGallery;
  const refetch = () => {
    void search.refetch();
    void personSearch.refetch();
  };

  const openResult = (result: SearchResult) => {
    router.push({
      pathname: "/content/[id]",
      params: {
        id: `${result.external_source}:${result.external_id}`,
        source: result.external_source,
        externalId: result.external_id,
        title: result.title_primary,
        originalTitle: result.title_original ?? "",
        posterUrl: result.poster_url ?? "",
        overview: result.overview ?? "",
        contentType: result.content_type,
        airYear: result.air_year ? String(result.air_year) : "",
        airDate: result.air_date ?? "",
        endDate: result.end_date ?? "",
        hasSeasons: result.has_seasons ? "true" : "false",
        episodeCount: result.episode_count ? String(result.episode_count) : ""
      }
    });
  };

  const addPerson = (person: PersonSearchResult) => {
    addFavoritePerson.mutate(person, {
      onError: (error) => Alert.alert("저장 실패", error.message)
    });
  };

  const addResult = (result: SearchResult) => {
    const key = createExternalKey(result);
    if (isResultAlreadyAdded(result, libraryItemsByExternalKey, addedSearchKeys, addedRecommendationKeys)) return;

    setPendingSearchKey(key);
    addToLibrary.mutate(
      { result, status: "wishlist" },
      {
        onSuccess: () => {
          setAddedSearchKeys((previous) => new Set(previous).add(key));
        },
        onError: (error) => {
          Alert.alert(
            "라이브러리 추가 실패",
            `${error.message}\n\n로그인 상태, Edge Function 배포 상태, 외부 API secret 설정을 확인하세요.`
          );
        },
        onSettled: () => {
          setPendingSearchKey(null);
        }
      }
    );
  };

  const addRecommendationResult = (result: SearchResult) => {
    const key = createExternalKey(result);
    if (isResultAlreadyAdded(result, libraryItemsByExternalKey, addedSearchKeys, addedRecommendationKeys)) return;

    setPendingRecommendationKey(key);

    addToLibrary.mutate(
      { result, status: "wishlist" },
      {
        onSuccess: () => {
          setAddedRecommendationKeys((previous) => new Set(previous).add(key));
        },
        onError: (error) => {
          Alert.alert("라이브러리 추가 실패", error.message);
        },
        onSettled: () => {
          setPendingRecommendationKey(null);
        }
      }
    );
  };

  const getAddState = (result: SearchResult) => {
    const key = createExternalKey(result);
    const isPending = addToLibrary.isPending && (pendingSearchKey === key || pendingRecommendationKey === key);
    const isAdded = isResultAlreadyAdded(result, libraryItemsByExternalKey, addedSearchKeys, addedRecommendationKeys);

    return {
      label: isPending ? "추가 중" : isAdded ? "추가됨" : "추가",
      disabled: isAdded || addToLibrary.isPending
    };
  };

  return (
    <View style={styles.container}>
      <ContentSearchBar
        autoFocus
        mediaTypeFilter={mediaType}
        onChangeText={setQuery}
        onMediaTypeChange={setMediaType}
        onGenreFilterChange={setGenreFilter}
        onSortOrderChange={setSortOrder}
        onStatusFilterChange={setStatusFilter}
        onSubmit={refetch}
        onYearChange={setYear}
        sortOrder={sortOrder}
        genreFilter={genreFilter}
        genreOptions={genreOptions}
        statusFilter={statusFilter}
        value={query}
        year={year}
      />

      {personSearch.data?.people.length ? (
        <View style={styles.peopleSection}>
          <Text style={styles.sectionTitle}>찾은 인물</Text>
          <View style={styles.peopleList}>
            {personSearch.data.people.slice(0, 6).map((person) => (
              <Pressable
                accessibilityRole="button"
                key={`${person.source}:${person.external_id}`}
                onPress={() => addPerson(person)}
                style={styles.personChip}
              >
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personMeta}>{person.category === "voice_actor" ? "성우 등록" : "배우 등록"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {search.data?.partial || personSearch.data?.failedSources.length ? (
        <Text style={styles.partial}>일부 외부 API 결과가 표시되지 않을 수 있습니다.</Text>
      ) : null}

      <View style={styles.viewToolbar}>
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
              style={[styles.viewButton, selected ? styles.viewButtonSelected : null]}
            >
              <Ionicons
                color={selected ? colors.surface : colors.textMuted}
                name={item.icon}
                size={16}
              />
              <Text style={[styles.viewButtonText, selected ? styles.viewButtonTextSelected : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasSearchQuery && isLoading ? <LoadingSkeleton count={5} variant="search-result" /> : null}
      {hasSearchQuery && isError ? <ErrorState message={error?.message ?? "검색 중 오류가 발생했습니다"} onRetry={refetch} /> : null}
      {recommendationIsLoading ? <LoadingSkeleton count={6} variant="search-result" /> : null}
      {!hasSearchQuery && recommendations.isError ? (
        <ErrorState
          message="추천 작품을 불러오지 못했습니다"
          onRetry={() => recommendations.refetch()}
        />
      ) : null}
      {!isLoading && hasSearchQuery && activeResults.length === 0 ? (
        <EmptyState description="작품명, 배우, 성우 이름을 다른 키워드로 검색해 보세요." title="검색 결과가 없습니다" />
      ) : null}
      {!hasSearchQuery && !recommendationIsLoading && !recommendations.isError && personalizedRecommendations.length === 0 ? (
        <EmptyState
          description="라이브러리에 작품을 더 등록하면 취향 추천이 더 정교해집니다."
          title="추천할 작품을 찾고 있어요"
        />
      ) : null}

      {!hasSearchQuery && !recommendationIsLoading && personalizedRecommendations.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>내 취향 추천</Text>
          <Text style={styles.resultsHint}>
            등록한 작품은 제외하고 {PERSONALIZED_RECOMMENDATION_LIMIT}개를 먼저 보여줍니다.
          </Text>
        </View>
      ) : null}

      {hasSearchQuery && !isLoading && activeResults.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>검색 결과</Text>
          <Text style={styles.resultsHint}>
            {yearFilter ? `${yearFilter}년 작품만 ` : ""}작품명 검색 결과와 출연자·성우 참여작을 최신순으로 함께 보여줍니다.
          </Text>
        </View>
      ) : null}

      <FlashList
        contentContainerStyle={styles.resultsList}
        ItemSeparatorComponent={displayedAsGallery ? undefined : () => <View style={{ height: spacing.md }} />}
        data={displayedResults}
        key={`${hasSearchQuery ? "search" : "recommendations"}-${viewMode}`}
        keyExtractor={(item) => `${item.external_source}:${item.external_id}`}
        numColumns={displayedAsGallery ? galleryColumns : 1}
        renderItem={({ item }) => {
          const addState = getAddState(item);

          return displayedAsGallery ? (
            <SearchResultGalleryCard
              addLabel={addState.label}
              isAddDisabled={addState.disabled}
              libraryItem={libraryItemsByExternalKey.get(createExternalKey(item)) ?? null}
              onAddToLibrary={() => (hasSearchQuery ? addResult(item) : addRecommendationResult(item))}
              onPress={() => openResult(item)}
              result={item}
            />
          ) : (
            <SearchResultItem
              addLabel={addState.label}
              isAddDisabled={addState.disabled}
              libraryItem={libraryItemsByExternalKey.get(createExternalKey(item)) ?? null}
              onAddToLibrary={() => addResult(item)}
              onPress={() => openResult(item)}
              result={item}
            />
          );
        }}
      />
    </View>
  );
}

function filterResultsByMediaType(results: SearchResult[], mediaType: MediaTypeFilter): SearchResult[] {
  if (mediaType === "all") return results;
  if (mediaType === "anime") return results.filter((item) => item.content_type === "anime");
  if (mediaType === "movie") return results.filter((item) => item.content_type === "movie");
  return results.filter((item) => item.content_type === "kdrama" || item.content_type === "jdrama");
}

function createExternalKey(result: SearchResult): string {
  return `${result.external_source}:${result.external_id}`;
}

function isResultAlreadyAdded(
  result: SearchResult,
  libraryItemsByExternalKey: Map<string, LibraryListItem>,
  addedSearchKeys: Set<string>,
  addedRecommendationKeys: Set<string>
): boolean {
  const key = createExternalKey(result);
  return libraryItemsByExternalKey.has(key) || addedSearchKeys.has(key) || addedRecommendationKeys.has(key);
}

function createPersonalizedRecommendations({
  items,
  libraryItems,
  addedKeys,
  mediaType
}: {
  items: PopularRecommendation[];
  libraryItems: LibraryListItem[];
  addedKeys: Set<string>;
  mediaType: MediaTypeFilter;
}): PopularRecommendation[] {
  const profile = createPreferenceProfile(libraryItems);
  const dedupedItems = dedupeRecommendations(items);

  return dedupedItems
    .filter((item) => filterResultsByMediaType([item], mediaType).length > 0)
    .filter((item) => !addedKeys.has(createExternalKey(item)))
    .filter((item) => !isRegisteredRecommendation(item, libraryItems))
    .map((item, index) => ({
      item,
      score: scoreRecommendation(item, profile, index)
    }))
    .sort((left, right) => right.score - left.score || left.item.rank - right.item.rank)
    .slice(0, PERSONALIZED_RECOMMENDATION_LIMIT)
    .map(({ item }, index) => ({ ...item, rank: index + 1 }));
}

function dedupeRecommendations(items: PopularRecommendation[]): PopularRecommendation[] {
  const deduped: PopularRecommendation[] = [];

  for (const item of items) {
    if (
      deduped.some((previous) =>
        isSameExternalResult(previous, item) || isSameWorkResult(previous, item)
      )
    ) {
      continue;
    }

    deduped.push(item);
  }

  return deduped;
}

function createPreferenceProfile(libraryItems: LibraryListItem[]) {
  const contentTypeScores = new Map<ContentType, number>();
  const genreScores = new Map<string, number>();

  for (const item of libraryItems) {
    const weight = getLibraryPreferenceWeight(item);
    contentTypeScores.set(item.content_type, (contentTypeScores.get(item.content_type) ?? 0) + weight);

    for (const genre of item.genres ?? []) {
      const key = genre.toLocaleLowerCase();
      genreScores.set(key, (genreScores.get(key) ?? 0) + weight);
    }
  }

  return {
    contentTypeScores,
    genreScores,
    hasPreferences: libraryItems.length > 0
  };
}

function getLibraryPreferenceWeight(item: LibraryListItem): number {
  const statuses = item.statuses;
  if (statuses.includes("not_recommended") || statuses.includes("dropped")) return -3;
  if (statuses.includes("recommended")) return 7;
  if (statuses.includes("completed")) return 5 + Math.min(item.watch_count ?? 0, 3);
  if (statuses.includes("watching")) return 4;
  return 1;
}

function scoreRecommendation(
  item: PopularRecommendation,
  profile: ReturnType<typeof createPreferenceProfile>,
  index: number
): number {
  const typeScore = profile.contentTypeScores.get(item.content_type) ?? 0;
  const genreScore = (item.genres ?? []).reduce(
    (sum, genre) => sum + (profile.genreScores.get(genre.toLocaleLowerCase()) ?? 0),
    0
  );
  const preferenceScore = typeScore * 2 + genreScore;
  const fallbackTrendScore = Math.max(0, 30 - index);
  const rankScore = Math.max(0, 20 - item.rank);

  return profile.hasPreferences
    ? preferenceScore * 10 + rankScore + fallbackTrendScore / 10
    : rankScore + fallbackTrendScore;
}

function isRegisteredRecommendation(result: SearchResult, libraryItems: LibraryListItem[]): boolean {
  return libraryItems.some((item) => {
    if (item.source_api !== "manual" && `${item.source_api}:${item.source_id}` === createExternalKey(result)) {
      return true;
    }

    return isSameLibraryWork(item, result);
  });
}

function isSameLibraryWork(item: LibraryListItem, result: SearchResult): boolean {
  if (item.content_type !== result.content_type) return false;
  if (item.air_year && result.air_year && item.air_year !== result.air_year) return false;

  const itemTitles = [item.title_primary, item.title_original]
    .map((title) => normalizeTitleForDedupe(title ?? ""))
    .filter((title) => title.length >= 2);
  const resultTitles = normalizedTitleCandidates(result);

  return itemTitles.some((title) => resultTitles.includes(title));
}

function filterResultsByLibraryStatus(
  results: SearchResult[],
  statusFilter: LibraryStatusFilter,
  libraryItems: LibraryListItem[]
): SearchResult[] {
  if (statusFilter === "all") return results;

  const matchingExternalKeys = new Set(
    libraryItems
      .filter((item) => item.statuses.includes(statusFilter) && item.source_api !== "manual")
      .map((item) => `${item.source_api}:${item.source_id}`)
  );

  return results.filter((result) => matchingExternalKeys.has(`${result.external_source}:${result.external_id}`));
}

function mergeSearchResults(titleResults: SearchResult[], personResults: SearchResult[]): SearchResult[] {
  const mergedResults: SearchResult[] = [];

  for (const result of [...titleResults, ...personResults]) {
    const duplicateIndex = mergedResults.findIndex(
      (item) =>
        isSameExternalResult(item, result) ||
        isSameWorkResult(item, result)
    );

    if (duplicateIndex < 0) {
      mergedResults.push(result);
      continue;
    }

    const previous = mergedResults[duplicateIndex];
    if (!previous) continue;
    mergedResults[duplicateIndex] = mergeResultFields(previous, result);
  }

  return mergedResults;
}

function isSameExternalResult(left: SearchResult, right: SearchResult): boolean {
  return left.external_source === right.external_source && left.external_id === right.external_id;
}

function isSameWorkResult(left: SearchResult, right: SearchResult): boolean {
  if (left.content_type !== right.content_type) return false;
  if (left.air_year && right.air_year && left.air_year !== right.air_year) return false;

  const leftTitles = normalizedTitleCandidates(left);
  const rightTitles = normalizedTitleCandidates(right);
  if (!leftTitles.length || !rightTitles.length) return false;

  return leftTitles.some((title) => rightTitles.includes(title));
}

function normalizedTitleCandidates(result: SearchResult): string[] {
  return Array.from(
    new Set(
      [result.title_primary, result.title_original]
        .map((title) => normalizeTitleForDedupe(title ?? ""))
        .filter((title) => title.length >= 2)
    )
  );
}

function normalizeTitleForDedupe(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function mergeResultFields(left: SearchResult, right: SearchResult): SearchResult {
  const preferred = preferSearchResult(left, right);
  const fallback = preferred === left ? right : left;
  const localizedOverview = preferred.localized_overview ?? fallback.localized_overview;
  const merged: SearchResult = {
    ...preferred,
    title_primary: preferred.title_primary || fallback.title_primary,
    title_original: preferred.title_original ?? fallback.title_original,
    poster_url: preferred.poster_url ?? fallback.poster_url,
    overview: preferred.overview ?? fallback.overview,
    air_year: preferred.air_year ?? fallback.air_year,
    air_date: preferred.air_date ?? fallback.air_date ?? null,
    end_date: preferred.end_date ?? fallback.end_date ?? null,
    episode_count: preferred.episode_count ?? fallback.episode_count,
    genres: Array.from(new Set([...(preferred.genres ?? []), ...(fallback.genres ?? [])])),
    has_seasons: preferred.has_seasons || fallback.has_seasons,
    duplicate_hint: left.duplicate_hint || right.duplicate_hint || !isSameExternalResult(left, right),
    matched_people: Array.from(new Set([...(left.matched_people ?? []), ...(right.matched_people ?? [])]))
  };

  if (localizedOverview !== undefined) merged.localized_overview = localizedOverview;
  return merged;
}

function preferSearchResult(left: SearchResult, right: SearchResult): SearchResult {
  const leftScore = sourcePreferenceScore(left);
  const rightScore = sourcePreferenceScore(right);
  if (leftScore !== rightScore) return rightScore > leftScore ? right : left;

  const leftCompleteness = completenessScore(left);
  const rightCompleteness = completenessScore(right);
  return rightCompleteness > leftCompleteness ? right : left;
}

function sourcePreferenceScore(result: SearchResult): number {
  if (result.content_type === "anime") {
    if (result.external_source === "anilist") return 4;
    if (result.external_source === "tmdb") return 3;
    if (result.external_source === "kitsu") return 2;
    return 1;
  }

  if (result.external_source === "tmdb") return 4;
  if (result.external_source === "tvmaze") return 3;
  return 1;
}

function completenessScore(result: SearchResult): number {
  return [
    result.poster_url,
    result.overview,
    result.localized_overview,
    result.air_year,
    result.air_date,
    result.end_date,
    result.episode_count,
    result.title_original
  ].filter(Boolean).length;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1
  },
  partial: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  peopleSection: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  viewToolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  viewButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  viewButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  viewButtonText: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  viewButtonTextSelected: {
    color: colors.surface
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  peopleList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  personChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  personName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  personMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  resultsHeader: {
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  resultsHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  resultsList: {
    paddingBottom: 88
  }
});
