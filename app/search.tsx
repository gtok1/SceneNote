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
import { useSearchUiStore } from "@/stores/searchUiStore";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import type { PersonSearchResult } from "@/types/people";
import { filterByYear, normalizeYearFilter, sortByYear } from "@/utils/contentSort";
import { matchesGenreFilter } from "@/utils/genre";

type SearchViewMode = "detail" | "gallery";

export default function SearchScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<SearchViewMode>("detail");
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
  const search = useContentSearch(query, mediaType);
  const personSearch = usePersonContentSearch(query, "all");
  const library = useLibrary("all");
  const addToLibrary = useAddToLibrary();
  const addFavoritePerson = useAddFavoritePerson();
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
    addToLibrary.mutate(
      { result, status: "wishlist" },
      {
        onSuccess: (response) => {
          router.push({ pathname: "/content/[id]", params: { id: response.content_id } });
        },
        onError: (error) => {
          Alert.alert(
            "라이브러리 추가 실패",
            `${error.message}\n\n로그인 상태, Edge Function 배포 상태, 외부 API secret 설정을 확인하세요.`
          );
        }
      }
    );
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

      {isLoading ? <LoadingSkeleton count={5} variant="search-result" /> : null}
      {isError ? <ErrorState message={error?.message ?? "검색 중 오류가 발생했습니다"} onRetry={refetch} /> : null}
      {!isLoading && query.trim().length >= 2 && activeResults.length === 0 ? (
        <EmptyState description="작품명, 배우, 성우 이름을 다른 키워드로 검색해 보세요." title="검색 결과가 없습니다" />
      ) : null}
      {query.trim().length < 2 ? (
        <EmptyState
          description="작품명, 배우, 성우 이름을 두 글자 이상 입력하면 검색이 시작됩니다."
          title="통합 검색"
        />
      ) : null}

      {!isLoading && activeResults.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>검색 결과</Text>
          <Text style={styles.resultsHint}>
            {yearFilter ? `${yearFilter}년 작품만 ` : ""}작품명 검색 결과와 출연자·성우 참여작을 최신순으로 함께 보여줍니다.
          </Text>
        </View>
      ) : null}

      <FlashList
        contentContainerStyle={styles.resultsList}
        ItemSeparatorComponent={isGallery ? undefined : () => <View style={{ height: spacing.md }} />}
        data={activeResults}
        key={viewMode}
        keyExtractor={(item) => `${item.external_source}:${item.external_id}`}
        numColumns={isGallery ? galleryColumns : 1}
        renderItem={({ item }) => (
          isGallery ? (
            <SearchResultGalleryCard
              libraryItem={libraryItemsByExternalKey.get(`${item.external_source}:${item.external_id}`) ?? null}
              onAddToLibrary={() => addResult(item)}
              onPress={() => openResult(item)}
              result={item}
            />
          ) : (
            <SearchResultItem
              libraryItem={libraryItemsByExternalKey.get(`${item.external_source}:${item.external_id}`) ?? null}
              onAddToLibrary={() => addResult(item)}
              onPress={() => openResult(item)}
              result={item}
            />
          )
        )}
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
