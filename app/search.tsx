import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentSearchBar } from "@/components/content/ContentSearchBar";
import { PersonalizedRecommendationGalleryCard } from "@/components/content/PersonalizedRecommendationGalleryCard";
import { PersonalizedRecommendationListItem } from "@/components/content/PersonalizedRecommendationListItem";
import { RecommendationQuickViewModal } from "@/components/content/RecommendationQuickViewModal";
import { SearchResultGalleryCard } from "@/components/content/SearchResultGalleryCard";
import { SearchResultItem } from "@/components/content/SearchResultItem";
import { SimilarContentQuickViewModal } from "@/components/content/SimilarContentQuickViewModal";
import { ThemeReductionSheet } from "@/components/content/ThemeReductionSheet";
import { colors, radius, spacing } from "@/constants/theme";
import { useContentSearch } from "@/hooks/useContentSearch";
import { useAddToLibrary, useLibrary } from "@/hooks/useLibrary";
import { useAddFavoritePerson, usePersonContentSearch } from "@/hooks/usePeople";
import { usePersonalizedRecommendations } from "@/hooks/usePersonalizedRecommendations";
import { useSimilarContent } from "@/hooks/useSimilarContent";
import { resolveSimilarityAnchors, shouldAutoSelectAnchor, type SimilarContentResult } from "@/services/similarContent";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import type { ContentTheme } from "../supabase/functions/_shared/recommendationThemes";
import { useAppUIStore } from "@/stores/appUIStore";
import { useSearchUiStore } from "@/stores/searchUiStore";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import type { LibraryListItem, LibraryStatusFilter } from "@/types/library";
import type { PersonSearchResult } from "@/types/people";
import { filterByYear, normalizeYearFilter, sortByYear } from "@/utils/contentSort";
import { matchesGenreFilter } from "@/utils/genre";
import { shouldShowRecommendationFeed } from "@/utils/recommendationFeed";
import { getResponsiveRecommendationColumns } from "@/utils/recommendationLayout";
import { mapRecommendationToCardViewModel } from "@/utils/recommendationPresentation";
import { parseSearchIntent, SIMILAR_SEARCH_EXAMPLES, type ParsedSearchIntent, type SimilarityFocus, type SimilaritySort } from "@/utils/similarSearchIntent";

const PERSONALIZED_RECOMMENDATION_LIMIT = 12;

export default function SearchScreen() {
  const router = useRouter();
  const urlParams = useLocalSearchParams<Record<string, string | string[]>>();
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
  const personalizedRecommendations = usePersonalizedRecommendations(
    mediaType,
    library.data ?? [],
    { enabled: !library.isLoading && !library.isError }
  );
  const addToLibrary = useAddToLibrary();
  const addFavoritePerson = useAddFavoritePerson();
  const addToast = useAppUIStore((state) => state.addToast);
  const [addedSearchKeys, setAddedSearchKeys] = useState<Set<string>>(() => new Set());
  const [addedRecommendationKeys, setAddedRecommendationKeys] = useState<Set<string>>(() => new Set());
  const [pendingSearchKey, setPendingSearchKey] = useState<string | null>(null);
  const [pendingAddIds, setPendingAddIds] = useState<Set<string>>(() => new Set());
  const [selectedRecommendation, setSelectedRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [themeReductionTarget, setThemeReductionTarget] = useState<PersonalizedRecommendation | null>(null);
  const [submittingThemeKey, setSubmittingThemeKey] = useState<string | null>(null);
  const [similarIntent, setSimilarIntent] = useState<Extract<ParsedSearchIntent, { mode: "similarity" }> | null>(null);
  const [similarAnchor, setSimilarAnchor] = useState<SearchResult | null>(null);
  const [anchorCandidates, setAnchorCandidates] = useState<SearchResult[]>([]);
  const [isResolvingAnchor, setIsResolvingAnchor] = useState(false);
  const [anchorResolutionError, setAnchorResolutionError] = useState<string | null>(null);
  const [selectedSimilar, setSelectedSimilar] = useState<SimilarContentResult | null>(null);
  const similarSearch = useSimilarContent(
    similarAnchor,
    similarIntent?.targetMediaType ?? "all",
    similarIntent?.focus ?? "balanced",
    similarIntent?.sort ?? "similarity",
    similarIntent?.modifiers ?? []
  );

  useEffect(() => {
    if (urlParams.mode !== "similar" || typeof urlParams.anchorSource !== "string" || typeof urlParams.anchorId !== "string" || typeof urlParams.anchorTitle !== "string") return;
    const restoredQuery = typeof urlParams.q === "string" ? urlParams.q : `${urlParams.anchorTitle} 같은 작품`;
    const restoredIntent = parseSearchIntent(restoredQuery);
    const focus = typeof urlParams.focus === "string" ? urlParams.focus as SimilarityFocus : "balanced";
    const sort = typeof urlParams.similarSort === "string" ? urlParams.similarSort as SimilaritySort : "similarity";
    const targetMediaType = typeof urlParams.target === "string" ? urlParams.target as MediaTypeFilter : "all";
    setQuery(restoredQuery);
    setSimilarIntent(restoredIntent.mode === "similarity" ? { ...restoredIntent, focus, sort, targetMediaType } : { mode:"similarity", normalizedQuery:restoredQuery, anchorText:urlParams.anchorTitle, focus, sort, targetMediaType, modifiers:[] });
    setSimilarAnchor({external_source:urlParams.anchorSource as SearchResult["external_source"],external_id:urlParams.anchorId,content_type:(typeof urlParams.anchorType==="string"?urlParams.anchorType:"other") as SearchResult["content_type"],title_primary:urlParams.anchorTitle,title_original:null,poster_url:null,overview:null,air_year:null,has_seasons:false,episode_count:null});
    // URL restoration intentionally runs once; subsequent changes are handled by explicit navigation actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const isSimilarityMode = similarIntent !== null;
  const isLoading = isSimilarityMode ? isResolvingAnchor || similarSearch.isLoading : search.isLoading || personSearch.isLoading || (statusFilter !== "all" && library.isLoading);
  const isError = isSimilarityMode ? similarSearch.isError : search.isError && personSearch.isError;
  const error = isSimilarityMode ? similarSearch.error : search.error ?? personSearch.error;
  const isGallery = viewMode === "gallery";
  const galleryColumns = getResponsiveRecommendationColumns(width);
  const showRecommendationFeed = !isSimilarityMode && shouldShowRecommendationFeed(query);
  const hasSearchInput = !showRecommendationFeed;
  const hasSearchQuery = query.trim().length >= 2;
  const activeRecommendations = useMemo(
    () =>
      personalizedRecommendations.recommendations.filter(
        (item) =>
          !addedRecommendationKeys.has(createExternalKey(item)) &&
          !isRegisteredRecommendation(item, library.data ?? [])
      ),
    [addedRecommendationKeys, library.data, personalizedRecommendations.recommendations]
  );
  const recommendationIsLoading =
    showRecommendationFeed &&
    (personalizedRecommendations.isInitialLoading || library.isLoading);
  const recommendationNeedsContinuation =
    showRecommendationFeed &&
    !recommendationIsLoading &&
    !personalizedRecommendations.isError &&
    activeRecommendations.length === 0 &&
    !personalizedRecommendations.isExhausted;
  const recommendationIsContinuing =
    recommendationNeedsContinuation && personalizedRecommendations.isLoadingMore;
  const recommendationLoadingMessage = personalizedRecommendations.isRefreshing
    ? "새 추천 12개를 불러오는 중이에요. 한국어 제목을 확인하고 있어 잠시 걸릴 수 있어요."
    : personalizedRecommendations.isRefilling
      ? "빈자리에 표시할 새 추천을 찾고 있어요."
      : recommendationIsLoading || recommendationIsContinuing
        ? "내 취향에 맞는 최신 작품을 찾는 중이에요. 잠시만 기다려 주세요."
        : null;
  const displayedResults: SearchResult[] = isSimilarityMode ? similarSearch.data?.items ?? [] : hasSearchInput ? activeResults : activeRecommendations;
  const recommendationPresentations = useMemo(
    () => new Map(activeRecommendations.map((item) => [item.canonical_id, mapRecommendationToCardViewModel(item)])),
    [activeRecommendations]
  );
  const displayedAsGallery = isGallery;
  const refetch = () => {
    if (!hasSearchQuery) return;
    const intent = parseSearchIntent(query);
    if (intent.mode === "similarity") { void resolveAndStartSimilarity(intent); return; }
    setSimilarIntent(null); setSimilarAnchor(null); setAnchorCandidates([]); setAnchorResolutionError(null);
    void search.refetch(); void personSearch.refetch();
  };

  const resolveAndStartSimilarity = async (intent: Extract<ParsedSearchIntent, { mode: "similarity" }>) => {
    setSimilarIntent(intent); setSimilarAnchor(null); setAnchorCandidates([]); setAnchorResolutionError(null); setIsResolvingAnchor(true);
    try {
      const candidates = await resolveSimilarityAnchors(intent.anchorText, "all");
      if (candidates.length === 0) { setAnchorResolutionError("기준 작품을 찾지 못했어요. 작품명을 확인하거나 일반 검색으로 전환해 주세요."); return; }
      if (shouldAutoSelectAnchor(intent.anchorText, candidates)) { startSimilarity(candidates[0] as SearchResult, intent); return; }
      setAnchorCandidates(candidates);
    } catch (resolveError) { setAnchorResolutionError(resolveError instanceof Error ? resolveError.message : "기준 작품을 찾지 못했습니다"); }
    finally { setIsResolvingAnchor(false); }
  };

  const startSimilarity = (anchor: SearchResult, intent: Extract<ParsedSearchIntent, { mode: "similarity" }>, pushHistory = true) => {
    setSimilarIntent(intent); setSimilarAnchor(anchor); setAnchorCandidates([]); setAnchorResolutionError(null); setIsResolvingAnchor(false);
    if (pushHistory) router.push({pathname:"/search",params:{mode:"similar",q:intent.normalizedQuery,anchorSource:anchor.external_source,anchorId:anchor.external_id,anchorTitle:anchor.title_primary,anchorType:anchor.content_type,focus:intent.focus,target:intent.targetMediaType,similarSort:intent.sort}});
  };

  const findSimilarFromCard = (anchor: SearchResult) => {
    const naturalQuery = `${anchor.title_primary} 같은 작품`;
    const parsed = parseSearchIntent(naturalQuery);
    if (parsed.mode !== "similarity") return;
    setQuery(naturalQuery); startSimilarity(anchor, parsed);
  };

  const handleQueryChange = (value: string) => { setQuery(value); if (isSimilarityMode && value !== similarIntent?.normalizedQuery) { setSimilarIntent(null); setSimilarAnchor(null); setAnchorCandidates([]); setAnchorResolutionError(null); } };

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

  const addRecommendationResult = (result: PersonalizedRecommendation) => {
    const key = createExternalKey(result);
    if (
      pendingAddIds.has(result.canonical_id) ||
      isResultAlreadyAdded(result, libraryItemsByExternalKey, addedSearchKeys, addedRecommendationKeys)
    ) {
      return;
    }

    const removed = personalizedRecommendations.removeOptimistically(result.canonical_id);
    if (!removed) return;
    setPendingAddIds((current) => new Set(current).add(result.canonical_id));

    addToLibrary.mutate(
      { result, status: "wishlist" },
      {
        onSuccess: () => {
          setAddedRecommendationKeys((previous) => new Set(previous).add(key));
          void personalizedRecommendations.refill(removed).then((refillResult) => {
            if (refillResult === "refilled") {
              addToast("라이브러리에 추가했어요. 새로운 추천을 불러왔습니다.", "success");
              return;
            }

            if (refillResult === "failed") {
              addToast("라이브러리에 추가했어요. 새 추천은 다시 시도해 주세요.", "success");
              return;
            }

            addToast("라이브러리에 추가했어요.", "success");
          });
        },
        onError: (error) => {
          personalizedRecommendations.restore(removed);
          addToast(error.message || "라이브러리에 추가하지 못했습니다.", "error");
        },
        onSettled: () => {
          setPendingAddIds((current) => {
            const next = new Set(current);
            next.delete(result.canonical_id);
            return next;
          });
        }
      }
    );
  };

  const getSearchAddState = (result: SearchResult) => {
    const key = createExternalKey(result);
    const isPending = pendingSearchKey === key;
    const isAdded = isResultAlreadyAdded(result, libraryItemsByExternalKey, addedSearchKeys, addedRecommendationKeys);

    return {
      label: isPending ? "추가 중" : isAdded ? "추가됨" : "추가",
      disabled: isAdded || pendingSearchKey !== null || pendingAddIds.size > 0
    };
  };

  const getRecommendationAddState = (result: PersonalizedRecommendation) => {
    const isPending = pendingAddIds.has(result.canonical_id);
    const isAdded = isResultAlreadyAdded(
      result,
      libraryItemsByExternalKey,
      addedSearchKeys,
      addedRecommendationKeys
    );

    return {
      label: isPending ? "추가 중" : isAdded ? "추가됨" : "추가",
      disabled:
        isAdded ||
        pendingAddIds.size > 0 ||
        pendingSearchKey !== null ||
        personalizedRecommendations.isRefreshing ||
        personalizedRecommendations.isRefilling ||
        personalizedRecommendations.isLoadingMore
    };
  };

  const refreshRecommendations = async () => {
    const refreshed = await personalizedRecommendations.refresh();
    if (!refreshed) {
      addToast("새 추천을 불러오지 못했습니다. 다시 시도해 주세요.", "error");
    }
  };

  const markRecommendationNotInterested = async (item: PersonalizedRecommendation) => {
    try {
      const result = await personalizedRecommendations.submitFeedback(item, {
        targetType: "content",
        targetKey: item.canonical_id,
        action: "not_interested",
        remove: true
      });
      if (selectedRecommendation?.canonical_id === item.canonical_id) setSelectedRecommendation(null);
      addToast(result === "refilled" ? "관심 없음으로 반영하고 새 추천을 채웠어요." : "관심 없음으로 반영했어요.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "피드백을 저장하지 못했습니다.", "error");
    }
  };

  const findMoreLikeRecommendation = async (item: PersonalizedRecommendation) => {
    try {
      await personalizedRecommendations.submitFeedback(item, {
        targetType: "content",
        targetKey: item.canonical_id,
        action: "more",
        remove: false
      });
      setSelectedRecommendation(null);
      findSimilarFromCard(item);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "피드백을 저장하지 못했습니다.", "error");
    }
  };

  const chooseThemeToReduce = (item: PersonalizedRecommendation) => {
    const themes = (item.themes ?? []).filter((theme) => theme.centrality >= 0.4).slice(0, 3);
    if (themes.length === 0) {
      addToast("줄일 수 있는 구체적 테마 정보가 없는 작품입니다.", "error");
      return;
    }
    setThemeReductionTarget({ ...item, themes });
  };

  const reduceRecommendationTheme = async (theme: ContentTheme) => {
    if (!themeReductionTarget || submittingThemeKey) return;
    const themeKey = `${theme.family}:${theme.key}`;
    setSubmittingThemeKey(themeKey);
    try {
      await personalizedRecommendations.submitFeedback(themeReductionTarget, {
        targetType: "theme",
        targetKey: themeKey,
        action: "less",
        remove: true
      });
      if (selectedRecommendation?.canonical_id === themeReductionTarget.canonical_id) {
        setSelectedRecommendation(null);
      }
      setThemeReductionTarget(null);
      addToast(`${theme.label} 요소를 줄이도록 반영했어요.`, "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "피드백을 저장하지 못했습니다.", "error");
    } finally {
      setSubmittingThemeKey(null);
    }
  };

  const retryRecommendationRefill = async () => {
    const result = await personalizedRecommendations.retryRefill();
    if (result === "refilled") {
      addToast("새로운 추천을 불러왔습니다.", "success");
    } else if (result === "failed") {
      addToast("새 추천을 다시 불러오지 못했습니다.", "error");
    }
  };

  const recommendationActionsDisabled =
    personalizedRecommendations.isRefreshing ||
    personalizedRecommendations.isRefilling ||
    personalizedRecommendations.isLoadingMore ||
    pendingAddIds.size > 0 ||
    recommendationIsLoading ||
    library.isError;

  return (
    <View style={styles.container}>
      <ContentSearchBar
        autoFocus
        examples={showRecommendationFeed ? SIMILAR_SEARCH_EXAMPLES : []}
        mediaTypeFilter={mediaType}
        onChangeText={handleQueryChange}
        onExamplePress={(example) => { setQuery(example); const parsed=parseSearchIntent(example); if(parsed.mode==="similarity") void resolveAndStartSimilarity(parsed); }}
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

      {!isSimilarityMode && hasSearchQuery && personSearch.data?.people.length ? (
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

      {!isSimilarityMode && hasSearchQuery && (search.data?.partial || personSearch.data?.failedSources.length) ? (
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

      {isSimilarityMode ? (
        <View style={styles.similarHeader}>
          <Text style={styles.recommendationTitle}>비슷한 작품 찾기</Text>
          {similarAnchor ? <Text style={styles.resultsHint}>기준 작품: {similarAnchor.title_primary} · {focusLabel(similarIntent.focus)} 중심</Text> : null}
          <View style={styles.similarFilters}>
            {(["similarity","latest","popular"] as const).map((value)=><Pressable accessibilityRole="button" accessibilityState={{selected:similarIntent.sort===value}} key={value} onPress={()=>{setSimilarIntent((current)=>current?{...current,sort:value}:current);router.setParams({similarSort:value});}} style={[styles.similarChip,similarIntent.sort===value&&styles.similarChipSelected]}><Text style={[styles.similarChipText,similarIntent.sort===value&&styles.similarChipTextSelected]}>{value==="similarity"?"유사도순":value==="latest"?"최신순":"인기순"}</Text></Pressable>)}
            {(["balanced","mood","story","genre"] as const).map((value)=><Pressable accessibilityRole="button" accessibilityState={{selected:similarIntent.focus===value}} key={value} onPress={()=>{setSimilarIntent((current)=>current?{...current,focus:value}:current);router.setParams({focus:value});}} style={[styles.similarChip,similarIntent.focus===value&&styles.similarChipSelected]}><Text style={[styles.similarChipText,similarIntent.focus===value&&styles.similarChipTextSelected]}>{focusLabel(value)}</Text></Pressable>)}
            {similarIntent.modifiers.map((modifier)=><Pressable accessibilityLabel={`${modifier.label} 필터 제거`} accessibilityRole="button" key={`${modifier.direction}:${modifier.key}`} onPress={()=>setSimilarIntent((current)=>current?{...current,modifiers:current.modifiers.filter((item)=>item!==modifier)}:current)} style={styles.appliedChip}><Text style={styles.appliedChipText}>{modifier.label} ×</Text></Pressable>)}
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.liveStatus}>{isResolvingAnchor?"기준 작품을 찾고 있습니다.":similarSearch.isLoading?"비슷한 작품을 찾고 있습니다.":similarAnchor?`비슷한 작품 ${similarSearch.data?.items.length??0}개가 표시되었습니다.`:"기준 작품을 선택해 주세요."}</Text>
          {similarSearch.data?.warnings[0] ? <Text style={styles.recommendationNotice}>{similarSearch.data.warnings[0]}</Text> : null}
        </View>
      ) : null}
      {anchorCandidates.length>0 ? <View accessibilityLabel="기준 작품 선택" accessibilityRole="summary" style={styles.anchorDialog}><Text style={styles.sectionTitle}>어떤 작품을 기준으로 찾을까요?</Text><View style={styles.anchorOptions}>{anchorCandidates.map((candidate)=><Pressable accessibilityRole="button" key={createExternalKey(candidate)} onPress={()=>startSimilarity(candidate,similarIntent as Extract<ParsedSearchIntent,{mode:"similarity"}>)} style={styles.anchorOption}><Text style={styles.anchorTitle}>{candidate.title_primary}</Text><Text style={styles.resultsHint}>{[candidate.air_year,candidate.content_type,candidate.external_source.toUpperCase()].filter(Boolean).join(" · ")}</Text></Pressable>)}</View></View>:null}
      {anchorResolutionError ? <View style={styles.inlineError}><Text style={styles.inlineErrorText}>{anchorResolutionError}</Text><Pressable accessibilityRole="button" onPress={()=>{setSimilarIntent(null);setAnchorResolutionError(null);void search.refetch();}} style={styles.inlineRetryButton}><Text style={styles.inlineRetryText}>일반 검색으로 보기</Text></Pressable></View>:null}

      {showRecommendationFeed ? (
        <View style={styles.resultsHeader}>
          <View style={styles.recommendationHeaderRow}>
            <View style={styles.recommendationHeaderText}>
              <Text style={styles.recommendationTitle}>내 취향 최신 추천</Text>
              <Text style={styles.resultsHint}>
                추가한 작품을 분석해 아직 등록하지 않은 최신 드라마·애니 12개를 보여드려요.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="새 추천 12개 불러오기"
              accessibilityRole="button"
              accessibilityState={{
                busy: personalizedRecommendations.isRefreshing,
                disabled: recommendationActionsDisabled
              }}
              disabled={recommendationActionsDisabled}
              onPress={() => void refreshRecommendations()}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed ? styles.refreshButtonPressed : null,
                recommendationActionsDisabled ? styles.refreshButtonDisabled : null
              ]}
            >
              {personalizedRecommendations.isRefreshing ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons color={colors.primary} name="refresh-outline" size={17} />
              )}
              <Text style={styles.refreshButtonText}>새 추천 12개</Text>
            </Pressable>
          </View>
          {personalizedRecommendations.data?.profile_mode === "cold_start" ? (
            <Text style={styles.recommendationNotice}>
              작품을 추가하면 취향에 맞는 추천이 더 정확해져요.
            </Text>
          ) : null}
          <Text accessibilityLiveRegion="polite" style={styles.liveStatus}>
            {recommendationIsLoading || recommendationIsContinuing
              ? "최신 작품부터 이전 공개작까지 새로운 추천을 찾고 있어요."
              : personalizedRecommendations.isRefreshing
              ? "새 추천 12개를 불러오는 중입니다."
              : personalizedRecommendations.isRefilling
                ? "빈 자리에 표시할 새 추천을 불러오는 중입니다."
                : `추천 작품 ${activeRecommendations.length}개가 표시되었습니다.`}
          </Text>
        </View>
      ) : null}

      {hasSearchQuery && isLoading ? <LoadingSkeleton count={5} variant="search-result" /> : null}
      {hasSearchQuery && isError ? <ErrorState message={error?.message ?? "검색 중 오류가 발생했습니다"} onRetry={refetch} /> : null}
      {showRecommendationFeed && recommendationLoadingMessage ? (
        <View
          accessibilityLabel={recommendationLoadingMessage}
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
          style={styles.recommendationLoadingBanner}
        >
          <ActivityIndicator color={colors.primary} size="small" />
          <View style={styles.recommendationLoadingText}>
            <Text accessibilityLiveRegion="polite" style={styles.recommendationLoadingTitle}>
              추천 작품 로딩 중
            </Text>
            <Text style={styles.recommendationLoadingDescription}>{recommendationLoadingMessage}</Text>
          </View>
        </View>
      ) : null}
      {recommendationIsLoading || recommendationIsContinuing ? (
        <LoadingSkeleton
          columns={displayedAsGallery ? galleryColumns : 1}
          count={PERSONALIZED_RECOMMENDATION_LIMIT}
          variant="recommendation-card"
        />
      ) : null}
      {showRecommendationFeed && library.isError ? (
        <ErrorState
          message="라이브러리 정보를 불러오지 못해 취향을 분석할 수 없습니다"
          onRetry={() => void library.refetch()}
        />
      ) : null}
      {showRecommendationFeed && personalizedRecommendations.isError && activeRecommendations.length === 0 ? (
        <ErrorState
          message={personalizedRecommendations.error?.message ?? "추천 데이터를 불러오지 못했습니다. 다시 시도해 주세요."}
          onRetry={() => void personalizedRecommendations.refetch()}
        />
      ) : null}
      {showRecommendationFeed &&
      recommendationNeedsContinuation &&
      personalizedRecommendations.emptyContinuationStopped &&
      !personalizedRecommendations.isError ? (
        <ErrorState
          message={
            personalizedRecommendations.loadMoreError ??
            "새 추천을 찾지 못했습니다. 다시 조회해 주세요."
          }
          onRetry={() => void personalizedRecommendations.retryEmptyContinuation()}
        />
      ) : null}
      {showRecommendationFeed && personalizedRecommendations.refreshError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{personalizedRecommendations.refreshError}</Text>
          <Pressable
            accessibilityLabel="새 추천 12개 다시 시도"
            accessibilityRole="button"
            onPress={() => void refreshRecommendations()}
            style={styles.inlineRetryButton}
          >
            <Text style={styles.inlineRetryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
      {showRecommendationFeed && personalizedRecommendations.refillError ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{personalizedRecommendations.refillError}</Text>
          <Pressable
            accessibilityLabel="빈 추천 자리 다시 채우기"
            accessibilityRole="button"
            disabled={personalizedRecommendations.isRefilling}
            onPress={() => void retryRecommendationRefill()}
            style={styles.inlineRetryButton}
          >
            <Text style={styles.inlineRetryText}>1개 다시 불러오기</Text>
          </Pressable>
        </View>
      ) : null}
      {hasSearchInput && !hasSearchQuery ? (
        <EmptyState description="검색어를 한 글자 더 입력해 주세요." title="두 글자 이상 입력해 주세요" />
      ) : null}
      {!isSimilarityMode && !isLoading && hasSearchQuery && activeResults.length === 0 ? (
        <EmptyState description="작품명, 배우, 성우 이름을 다른 키워드로 검색해 보세요." title="검색 결과가 없습니다" />
      ) : null}
      {isSimilarityMode && similarAnchor && !isLoading && !isError && (similarSearch.data?.items.length ?? 0) === 0 ? (
        <EmptyState description="분위기나 장르 기준으로 바꾸거나 콘텐츠 유형 제한을 해제해 보세요." title="이 작품과 비슷한 결과를 찾지 못했어요" />
      ) : null}
      {showRecommendationFeed &&
      !recommendationIsLoading &&
      !library.isError &&
      !personalizedRecommendations.isError &&
      personalizedRecommendations.isExhausted &&
      activeRecommendations.length === 0 ? (
        <EmptyState
          description="새 작품이 데이터 소스에 추가되면 다시 추천을 시작합니다."
          title="현재 제공되는 모든 작품을 확인했어요"
        />
      ) : null}

      {!isSimilarityMode && hasSearchQuery && !isLoading && activeResults.length > 0 ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>검색 결과</Text>
          <Text style={styles.resultsHint}>
            {yearFilter ? `${yearFilter}년 작품만 ` : ""}작품명 검색 결과와 출연자·성우 참여작을 최신순으로 함께 보여줍니다.
          </Text>
        </View>
      ) : null}

      <View
        accessibilityState={{
          busy:
            personalizedRecommendations.isRefreshing ||
            personalizedRecommendations.isRefilling ||
            personalizedRecommendations.isLoadingMore
        }}
        style={styles.listContainer}
      >
        <FlashList
          contentContainerStyle={styles.resultsList}
          data={displayedResults}
          extraData={`${pendingSearchKey ?? ""}:${Array.from(pendingAddIds).join(",")}:${library.data?.length ?? 0}:${personalizedRecommendations.isLoadingMore}`}
          ItemSeparatorComponent={displayedAsGallery ? undefined : () => <View style={{ height: spacing.md }} />}
          key={`${hasSearchInput ? "search" : "recommendations"}-${mediaType}-${viewMode}`}
          keyExtractor={(item) => `${item.external_source}:${item.external_id}`}
          numColumns={displayedAsGallery ? galleryColumns : 1}
          onEndReached={() => {
            if (
              showRecommendationFeed &&
              !personalizedRecommendations.isExhausted &&
              !personalizedRecommendations.isInitialLoading &&
              !personalizedRecommendations.isLoadingMore &&
              !personalizedRecommendations.isRefreshing &&
              !personalizedRecommendations.isRefilling &&
              !personalizedRecommendations.isError
            ) {
              void personalizedRecommendations.loadMore();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={showRecommendationFeed ? (
            personalizedRecommendations.isLoadingMore ? (
              <View accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.loadMoreFooter}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text accessibilityLiveRegion="polite" style={styles.loadMoreText}>
                  다음 추천 12개를 불러오는 중이에요.
                </Text>
              </View>
            ) : personalizedRecommendations.loadMoreError ? (
              <View style={styles.loadMoreFooter}>
                <Text style={styles.loadMoreErrorText}>{personalizedRecommendations.loadMoreError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void personalizedRecommendations.loadMore()} style={styles.inlineRetryButton}>
                  <Text style={styles.inlineRetryText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : personalizedRecommendations.isExhausted && activeRecommendations.length > 0 ? (
              <Text accessibilityLiveRegion="polite" style={styles.exhaustedFooterText}>
                현재 제공되는 추천 작품을 모두 확인했어요.
              </Text>
            ) : null
          ) : null}
          renderItem={({ item }) => {
            const similarResult = isSimilarContentResult(item) ? item : null;
            const recommendation = isPersonalizedRecommendation(item) ? item : null;
            const addState = recommendation
              ? getRecommendationAddState(recommendation)
              : getSearchAddState(item);

            if (similarResult) {
              return displayedAsGallery ? (
                <SearchResultGalleryCard addLabel={addState.label} isAddDisabled={addState.disabled} libraryItem={libraryItemsByExternalKey.get(createExternalKey(item))??null} onAddToLibrary={()=>addResult(item)} onFindSimilar={()=>findSimilarFromCard(item)} onPress={()=>setSelectedSimilar(similarResult)} recommendationReason={similarResult.similarity_reason} result={item}/>
              ) : (
                <SearchResultItem addLabel={addState.label} isAddDisabled={addState.disabled} libraryItem={libraryItemsByExternalKey.get(createExternalKey(item))??null} onAddToLibrary={()=>addResult(item)} onFindSimilar={()=>findSimilarFromCard(item)} onPress={()=>setSelectedSimilar(similarResult)} recommendationReason={similarResult.similarity_reason} result={item}/>
              );
            }

            if (recommendation) {
              const presentation = recommendationPresentations.get(recommendation.canonical_id) ??
                mapRecommendationToCardViewModel(recommendation);
              return displayedAsGallery ? (
                <PersonalizedRecommendationGalleryCard
                  addLabel={addState.label}
                  isAddDisabled={addState.disabled}
                  onAddToLibrary={() => addRecommendationResult(recommendation)}
                  onOpenQuickView={() => setSelectedRecommendation(recommendation)}
                  onNotInterested={() => void markRecommendationNotInterested(recommendation)}
                  onMoreLikeThis={() => void findMoreLikeRecommendation(recommendation)}
                  {...((recommendation.themes?.length ?? 0) > 0 ? { onReduceTheme: () => chooseThemeToReduce(recommendation) } : {})}
                  presentation={presentation}
                  result={recommendation}
                />
              ) : (
                <PersonalizedRecommendationListItem
                  addLabel={addState.label}
                  isAddDisabled={addState.disabled}
                  onAddToLibrary={() => addRecommendationResult(recommendation)}
                  onOpenQuickView={() => setSelectedRecommendation(recommendation)}
                  onNotInterested={() => void markRecommendationNotInterested(recommendation)}
                  onMoreLikeThis={() => void findMoreLikeRecommendation(recommendation)}
                  {...((recommendation.themes?.length ?? 0) > 0 ? { onReduceTheme: () => chooseThemeToReduce(recommendation) } : {})}
                  presentation={presentation}
                  result={recommendation}
                />
              );
            }

            return displayedAsGallery ? (
              <SearchResultGalleryCard
                addLabel={addState.label}
                isAddDisabled={addState.disabled}
                libraryItem={libraryItemsByExternalKey.get(createExternalKey(item)) ?? null}
                onAddToLibrary={() => addResult(item)}
                onFindSimilar={() => findSimilarFromCard(item)}
                onPress={() => openResult(item)}
                result={item}
              />
            ) : (
              <SearchResultItem
                addLabel={addState.label}
                isAddDisabled={addState.disabled}
                libraryItem={libraryItemsByExternalKey.get(createExternalKey(item)) ?? null}
                onAddToLibrary={() => addResult(item)}
                onFindSimilar={() => findSimilarFromCard(item)}
                onPress={() => openResult(item)}
                result={item}
              />
            );
          }}
        />
      </View>
      <RecommendationQuickViewModal
        addLabel={selectedRecommendation ? getRecommendationAddState(selectedRecommendation).label : "추가"}
        isAddDisabled={selectedRecommendation ? getRecommendationAddState(selectedRecommendation).disabled : true}
        item={selectedRecommendation}
        onAdd={(item) => {
          setSelectedRecommendation(null);
          addRecommendationResult(item);
        }}
        onClose={() => setSelectedRecommendation(null)}
        onNotInterested={(item) => void markRecommendationNotInterested(item)}
        onMoreLikeThis={(item) => void findMoreLikeRecommendation(item)}
        onOpenDetails={(item) => {
          setSelectedRecommendation(null);
          openResult(item);
        }}
        {...(selectedRecommendation?.themes?.length ? { onReduceTheme: chooseThemeToReduce } : {})}
        presentation={selectedRecommendation
          ? recommendationPresentations.get(selectedRecommendation.canonical_id) ?? mapRecommendationToCardViewModel(selectedRecommendation)
          : null}
      />
      <ThemeReductionSheet
        onClose={() => setThemeReductionTarget(null)}
        onSelect={(theme) => void reduceRecommendationTheme(theme)}
        submittingThemeKey={submittingThemeKey}
        themes={themeReductionTarget?.themes ?? []}
        visible={themeReductionTarget !== null}
      />
      <SimilarContentQuickViewModal addLabel={selectedSimilar?getSearchAddState(selectedSimilar).label:"추가"} isAddDisabled={selectedSimilar?getSearchAddState(selectedSimilar).disabled:true} item={selectedSimilar} onAdd={(item)=>{setSelectedSimilar(null);addResult(item);}} onClose={()=>setSelectedSimilar(null)} onFindSimilar={(item)=>{setSelectedSimilar(null);findSimilarFromCard(item);}} onOpenDetails={(item)=>{setSelectedSimilar(null);openResult(item);}} />
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

function isPersonalizedRecommendation(
  result: SearchResult
): result is PersonalizedRecommendation {
  return "canonical_id" in result && typeof result.canonical_id === "string";
}

function isSimilarContentResult(result: SearchResult): result is SimilarContentResult {
  return "similarity_reason" in result && typeof result.similarity_reason === "string";
}

function focusLabel(focus: SimilarityFocus): string {
  return ({balanced:"균형",mood:"분위기",story:"스토리",setting:"세계관",relationship:"관계성",genre:"장르",character:"캐릭터"})[focus];
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  similarHeader: { gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  similarFilters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  similarChip: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  similarChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  similarChipText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  similarChipTextSelected: { color: colors.surface },
  appliedChip: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  appliedChipText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  anchorDialog: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, marginBottom: spacing.sm, marginHorizontal: spacing.lg, padding: spacing.md },
  anchorOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  anchorOption: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, minWidth: 180, padding: spacing.sm },
  anchorTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  recommendationHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  recommendationHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 240
  },
  recommendationTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  refreshButtonPressed: {
    backgroundColor: colors.primarySoft
  },
  refreshButtonDisabled: {
    opacity: 0.55
  },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  recommendationNotice: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  recommendationLoadingBanner: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  recommendationLoadingText: {
    flex: 1,
    gap: 2
  },
  recommendationLoadingTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  recommendationLoadingDescription: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17
  },
  liveStatus: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1
  },
  inlineError: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.sm
  },
  inlineErrorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  inlineRetryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  inlineRetryText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900"
  },
  resultsHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  listContainer: {
    flex: 1
  },
  resultsList: {
    paddingBottom: 88
  },
  loadMoreFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  loadMoreText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  loadMoreErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700"
  },
  exhaustedFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    padding: spacing.lg,
    textAlign: "center"
  }
});
