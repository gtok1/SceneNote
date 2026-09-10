import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { KeyboardAvoidingView, Platform, useWindowDimensions , Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useNetworkState } from "expo-network";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentReviewEditor } from "@/components/content/ContentReviewEditor";
import { EpisodeProgressCard } from "@/components/content/EpisodeProgressCard";
import { WatchProviderList } from "@/components/content/WatchProviderList";
import { WatchStatusBadge } from "@/components/content/WatchStatusBadge";
import { normalizeWatchStatuses, WATCH_STATUS_LABEL, WATCH_STATUS_OPTIONS } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import { useExternalContentDetail } from "@/hooks/useContentSearch";
import {
  useAddToLibrary,
  useContent,
  useDeleteLibraryItem,
  useLibrary,
  useSeasons,
  useUpdateLibraryManualProgress,
  useUpdateLibraryWatchCount,
  useUpdateLibraryStatuses
} from "@/hooks/useLibrary";
import { useAddFavoritePerson, useFavoritePeople } from "@/hooks/usePeople";
import { useWatchProviders } from "@/hooks/useWatchProviders";
import { useAppUIStore } from "@/stores/appUIStore";
import type { CastMember, SearchResult } from "@/types/content";
import type { WatchStatus } from "@/types/library";
import { createAirDateLabel, createEpisodeCountLabel, createWatchCountLabel } from "@/utils/contentMetaDisplay";
import { createLibraryRouteParams, parseLibraryRouteParams } from "@/utils/libraryRouteParams";
import { createSeasonOffsetsByNumber, toAbsoluteEpisodeNumber } from "@/utils/episodeProgress";
import { getProgressStatusSuggestion } from "@/utils/progressStatusSuggestion";
import {
  describeWatchCountSaveState,
  resolveWatchCountSaveState
} from "@/utils/watchCountInput";

const PRIMARY_WATCH_STATUSES: WatchStatus[] = ["wishlist", "watching", "dropped", "completed"];
const PRIMARY_WATCH_STATUS_SET = new Set<WatchStatus>(PRIMARY_WATCH_STATUSES);

export default function ContentDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    libraryItemId?: string;
    season?: string;
    source?: SearchResult["external_source"];
    externalId?: string;
    title?: string;
    originalTitle?: string;
    posterUrl?: string;
    overview?: string;
    contentType?: SearchResult["content_type"];
    airYear?: string;
    airDate?: string;
    endDate?: string;
    hasSeasons?: string;
    episodeCount?: string;
    status?: string;
    libraryType?: string;
    genre?: string;
    rating?: string;
    q?: string;
    year?: string;
    sort?: string;
    view?: string;
    focus?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const didFocusProgress = useRef(false);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressHighlighted, setProgressHighlighted] = useState(false);
  const networkState = useNetworkState();
  const libraryRouteState = parseLibraryRouteParams(params);
  const libraryReturnParams = createLibraryRouteParams(libraryRouteState, libraryRouteState.viewMode);
  const isExternal = Boolean(params.source && params.externalId);
  const content = useContent(isExternal ? undefined : params.id);
  const library = useLibrary("all");
  const addToLibrary = useAddToLibrary();
  const updateStatuses = useUpdateLibraryStatuses();
  const deleteLibraryItem = useDeleteLibraryItem();
  const addFavoritePerson = useAddFavoritePerson();
  const favoritePeople = useFavoritePeople();

  const dbContent = content.data;
  const dbDetailSource =
    !isExternal && dbContent?.source_api && dbContent.source_api !== "manual" ? dbContent.source_api : undefined;
  const externalDetail = useExternalContentDetail(
    params.source ?? dbDetailSource,
    params.externalId ?? dbContent?.source_id,
    (params.contentType ?? dbContent?.content_type) === "movie" ? "movie" : "tv"
  );
  const watchProviderSource = params.source ?? dbDetailSource;
  const watchProviderExternalId = params.externalId ?? dbContent?.source_id;
  const watchProviderMediaType =
    (externalDetail.data?.content.content_type ?? params.contentType ?? dbContent?.content_type) === "movie"
      ? "movie"
      : "tv";
  const watchProviderTitle = externalDetail.data?.content.title_primary ?? params.title ?? dbContent?.title_primary;
  const watchProviders = useWatchProviders({
    source: watchProviderSource,
    externalId: watchProviderExternalId,
    mediaType: watchProviderMediaType,
    title: watchProviderTitle
  });
  const resolvedContentId = externalDetail.data?.content.content_id ?? params.id;
  const libraryItem = library.data?.find((item) => item.content_id === resolvedContentId && (params.libraryItemId ? item.library_item_id === params.libraryItemId : item.season_number === (params.season ? Number(params.season) : null)));
  const seasons = useSeasons(libraryItem?.content_id);
  const selectedStatuses = normalizeWatchStatuses(libraryItem?.statuses ?? (libraryItem ? [libraryItem.status] : []));
  const addToast = useAppUIStore((state) => state.addToast);
  const updateWatchCount = useUpdateLibraryWatchCount();
  const updateManualProgress = useUpdateLibraryManualProgress();
  const openLibraryList = () => {
    router.replace({ pathname: "/library", params: libraryReturnParams });
  };

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  const externalResult: SearchResult | null =
    isExternal && params.source && params.externalId
      ? {
          external_source: params.source,
          external_id: params.externalId,
          content_type: params.contentType ?? "other",
          title_primary: params.title ?? "제목 없음",
          title_original: params.originalTitle || null,
          poster_url: params.posterUrl || null,
          overview: params.overview || null,
          air_year: params.airYear ? Number(params.airYear) : null,
          air_date: params.airDate || null,
          end_date: params.endDate || null,
          has_seasons: params.hasSeasons === "true",
          episode_count: params.episodeCount ? Number(params.episodeCount) : null
        }
      : null;

  const rawView = externalResult
    ? {
        title: externalDetail.data?.content.title_primary ?? externalResult.title_primary,
        originalTitle: externalDetail.data?.content.title_original ?? externalResult.title_original,
        posterUrl: externalDetail.data?.content.poster_url ?? externalResult.poster_url,
        overview:
          externalDetail.data?.content.localized_overview ??
          externalDetail.data?.content.overview ??
          externalResult.localized_overview ??
          externalResult.overview,
        contentType: externalDetail.data?.content.content_type ?? externalResult.content_type,
        airYear: externalDetail.data?.content.air_year ?? externalResult.air_year,
        airDate: externalDetail.data?.content.air_date ?? externalResult.air_date ?? null,
        endDate: externalDetail.data?.content.end_date ?? externalResult.end_date ?? null,
        hasSeasons: externalDetail.data?.content.has_seasons ?? externalResult.has_seasons,
        episodeCount: externalDetail.data?.content.episode_count ?? externalResult.episode_count,
        genres: externalDetail.data?.content.genres ?? externalResult.genres ?? [],
        cast: externalDetail.data?.content.cast ?? [],
        fromDb: externalDetail.data?.from_db ?? false
      }
    : dbContent
      ? {
          title: externalDetail.data?.content.title_primary ?? dbContent.title_primary,
          originalTitle: externalDetail.data?.content.title_original ?? dbContent.title_original,
          posterUrl: externalDetail.data?.content.poster_url ?? dbContent.poster_url,
          overview:
            externalDetail.data?.content.localized_overview ??
            externalDetail.data?.content.overview ??
            dbContent.overview,
          contentType: externalDetail.data?.content.content_type ?? dbContent.content_type,
          airYear: externalDetail.data?.content.air_year ?? dbContent.air_year,
          airDate: externalDetail.data?.content.air_date ?? dbContent.air_date,
          endDate: externalDetail.data?.content.end_date ?? dbContent.end_date,
          hasSeasons: externalDetail.data?.content.has_seasons ?? dbContent.content_type !== "movie",
          episodeCount: externalDetail.data?.content.episode_count ?? libraryItem?.episode_count ?? null,
          genres: externalDetail.data?.content.genres ?? dbContent.genres ?? libraryItem?.genres ?? [],
          cast: externalDetail.data?.content.cast ?? [],
          fromDb: externalDetail.data?.from_db ?? true
        }
      : null;
  const view = rawView
    ? {
        ...rawView,
        contentType: normalizeContentTypeFromCast(rawView.contentType, rawView.cast)
      }
    : null;

  const toggleStatus = (status: WatchStatus) => {
    if (libraryItem) {
      const nextStatuses = createNextWatchStatuses(selectedStatuses, status);
      if (areSameWatchStatuses(selectedStatuses, nextStatuses)) return;

      const completedRemoved = selectedStatuses.includes("completed") && !nextStatuses.includes("completed");
      updateStatuses.mutate(
        {
          libraryItemId: libraryItem.library_item_id,
          statuses: nextStatuses,
          ...(completedRemoved ? { watchCount: 0 } : {})
        },
        { onError: (error) => Alert.alert("상태 변경 실패", error.message) }
      );
      return;
    }

    const resultToAdd = externalDetail.data?.content ?? externalResult;
    if (!resultToAdd) return;
    addToLibrary.mutate(
      { result: resultToAdd, status, ...(params.season ? { seasonNumber: Number(params.season) } : {}) },
      {
        onSuccess: (response) => router.replace({ pathname: "/content/[id]", params: { id: response.content_id, ...(params.season ? { season: params.season } : {}) } }),
        onError: (error) => Alert.alert("추가 실패", error.message)
      }
    );
  };

  const removeFromLibrary = () => {
    if (!libraryItem) return;

    deleteLibraryItem.mutate(
      { libraryItemId: libraryItem.library_item_id },
      {
        onSuccess: openLibraryList,
        onError: (error) => Alert.alert("삭제 실패", error.message)
      }
    );
  };

  const addCastMember = (member: CastMember) => {
    if (!view) return;
    const isVoiceActor = view.contentType === "anime";

    addFavoritePerson.mutate(
      {
        source: isVoiceActor ? "anilist" : "tmdb",
        external_id: String(member.id),
        category: isVoiceActor ? "voice_actor" : "actor",
        name: member.name,
        original_name: member.original_name,
        profile_url: member.profile_url,
        known_for: [view.title].filter(Boolean)
      },
      {
        onSuccess: () => Alert.alert("등록 완료", `${member.name}을(를) 좋아하는 인물에 등록했습니다.`),
        onError: (error) => Alert.alert("등록 실패", error.message)
      }
    );
  };

  const openCastMember = (member: CastMember) => {
    if (!view) return;
    const isVoiceActor = view.contentType === "anime";
    const source = isVoiceActor ? "anilist" : "tmdb";
    const category = isVoiceActor ? "voice_actor" : "actor";

    router.push({
      pathname: "/people/[id]",
      params: {
        id: `${source}:${member.id}`,
        source,
        externalId: String(member.id),
        category
      }
    });
  };

  if (content.isLoading) return <LoadingSkeleton />;
  if (content.isError) return <ErrorState message={content.error.message} onRetry={() => content.refetch()} />;
  if (!view) return <EmptyState title="콘텐츠를 찾을 수 없습니다" />;

  const favoritePersonKeys = new Set(
    favoritePeople.data?.map((person) => `${person.source}:${person.external_id}`) ?? []
  );
  const resolvedEpisodeCount = view.episodeCount ?? libraryItem?.episode_count ?? null;
  const seasonEpisodeCounts = seasons.data?.map((season) => ({
    season_number: season.season_number,
    episode_count: season.episode_count,
  })) ?? libraryItem?.season_episode_counts ?? [];
  const progressLibraryItem = libraryItem
    ? { ...libraryItem, season_episode_counts: seasonEpisodeCounts }
    : null;
  const airDateLabel = createAirDateLabel(view.airDate, view.airYear);
  const episodeLabel = createEpisodeCountLabel(resolvedEpisodeCount);
  const watchCountLabel = createWatchCountLabel(libraryItem?.watch_count, {
    includeZero: Boolean(libraryItem)
  });

  const saveWatchCount = (watchCount: number) => {
    if (!libraryItem) return;
    updateWatchCount.mutate(
      { libraryItemId: libraryItem.library_item_id, watchCount },
      {
        // Alert.alert is an empty function on react-native-web, so failures here used to
        // be completely invisible on the web build. Toasts render on every platform.
        onError: (error) => addToast(error.message || "본 횟수를 저장하지 못했습니다.", "error"),
        onSuccess: () => addToast(`본 횟수를 ${watchCount}회로 저장했어요.`, "success")
      }
    );
  };

  const openEpisodes = () => {
    if (!libraryItem) return;
    router.push({ pathname: "/content/[id]/episodes", params: { id: libraryItem.content_id, libraryItemId: libraryItem.library_item_id, ...(libraryItem.season_number != null ? { season: String(libraryItem.season_number) } : {}) } });
  };

  const saveManualProgress = (
    progress: { seasonNumber: number | null; episodeNumber: number } | null,
  ) => {
    if (!libraryItem) return;
    updateManualProgress.mutate(
      { libraryItemId: libraryItem.library_item_id, progress },
      {
        onSuccess: () => {
          if (!progress) return;
          const absolute = toAbsoluteEpisodeNumber(
            progress.seasonNumber,
            progress.episodeNumber,
            createSeasonOffsetsByNumber(seasonEpisodeCounts),
          ) ?? progress.episodeNumber;
          const suggestion = getProgressStatusSuggestion({
            statuses: libraryItem.statuses,
            absoluteWatchedThrough: absolute,
            totalEpisodes: resolvedEpisodeCount,
          });
          if (suggestion === "mark_completed") {
            Alert.alert("모든 화를 시청했습니다", "완료로 표시할까요?", [
              { text: "나중에", style: "cancel" },
              { text: "완료로 표시", onPress: () => toggleStatus("completed") },
            ]);
          } else if (suggestion === "mark_watching") {
            Alert.alert("시청을 시작했습니다", "보는 중으로 바꿀까요?", [
              { text: "유지", style: "cancel" },
              { text: "보는 중으로 변경", onPress: () => toggleStatus("watching") },
            ]);
          }
        },
        onError: (error) => Alert.alert("시청 진행 저장 실패", error.message),
      },
    );
  };

  const focusProgressCard = (y: number) => {
    if (params.focus !== "progress" || didFocusProgress.current) return;
    didFocusProgress.current = true;
    setProgressHighlighted(true);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - spacing.xl), animated: true });
    });
    highlightTimer.current = setTimeout(() => setProgressHighlighted(false), 1500);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]} ref={scrollViewRef}>
      <Image source={view.posterUrl ? { uri: view.posterUrl } : null} style={[styles.poster, width < 768 ? { height: 144 } : null]} contentFit="cover" />
      <View style={styles.body}>
        <Text style={styles.title}>{view.title}</Text>
        {view.originalTitle ? <Text style={styles.original}>{view.originalTitle}</Text> : null}
        <Text style={styles.meta}>
          {[airDateLabel, view.contentType, episodeLabel, watchCountLabel].filter(Boolean).join(" · ")}
        </Text>
        {externalDetail.isError ? (
          <Text style={styles.warning}>상세 정보 일부를 불러오지 못해 검색 결과 기준으로 표시합니다.</Text>
        ) : null}

        {selectedStatuses.length > 0 ? (
          <View style={styles.badgeRow}>
            {selectedStatuses.map((status) => (
              <WatchStatusBadge key={status} status={status} />
            ))}
          </View>
        ) : null}

        {!externalResult || libraryItem ? (
          <View style={styles.actions}>
            {view.contentType !== "movie" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/content/[id]/episodes",
                    params: { id: libraryItem?.content_id ?? params.id, ...(libraryItem ? { libraryItemId: libraryItem.library_item_id } : {}), ...(params.season ? { season: params.season } : {}) }
                  })
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>에피소드 보기</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/pins/new",
                    params: { contentId: libraryItem?.content_id ?? params.id }
                  })
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>영화 핀 추가</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/content/[id]/pins",
                  params: { id: libraryItem?.content_id ?? params.id, ...(libraryItem ? { libraryItemId: libraryItem.library_item_id } : {}), ...(params.season ? { season: params.season } : {}) }
                })
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>핀 목록</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openLibraryList}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>목록</Text>
            </Pressable>
          </View>
        ) : null}
        <GenreBadgeList genres={view.genres} maxVisible={view.genres.length} />

        {libraryItem ? (
          <WatchCountInput
            isCompleted={selectedStatuses.includes("completed")}
            isSaving={updateWatchCount.isPending}
            onSave={saveWatchCount}
            watchCount={libraryItem.watch_count}
          />
        ) : null}

        {libraryItem && view.contentType !== "movie" ? (
          <View onLayout={(event) => focusProgressCard(event.nativeEvent.layout.y)}>
            <EpisodeProgressCard
              highlighted={progressHighlighted}
              isOffline={networkState.isConnected === false || networkState.isInternetReachable === false}
              isSaving={updateManualProgress.isPending}
              isUnavailable={!libraryItem.manual_progress_available}
              item={progressLibraryItem ?? libraryItem}
              onOpenEpisodes={openEpisodes}
              onSave={saveManualProgress}
              totalEpisodes={resolvedEpisodeCount}
            />
          </View>
        ) : null}

        <Text numberOfLines={overviewExpanded ? undefined : 3} style={styles.overview}>{view.overview || "줄거리 정보가 없습니다."}</Text>
        {view.overview ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: overviewExpanded }} onPress={() => setOverviewExpanded(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primary }}>{overviewExpanded ? "줄거리 접기" : "줄거리 더보기"}</Text></Pressable> : null}

        <WatchProviderList
          error={watchProviders.error}
          isLoading={watchProviders.isLoading}
          providers={watchProviders.data.providers}
        />

        {EXTENDED_FEATURES_ENABLED && view.cast.length ? (
          <View style={styles.castSection}>
            <Text style={styles.sectionTitle}>{view.contentType === "anime" ? "성우" : "출연 배우"}</Text>
            <Text style={styles.castHint}>처음 누르면 좋아하는 인물에 등록되고, 등록된 인물은 상세 화면으로 이동합니다.</Text>
            <View style={styles.castGrid}>
              {view.cast.slice(0, 8).map((member) => {
                const source = view.contentType === "anime" ? "anilist" : "tmdb";
                const registered = favoritePersonKeys.has(`${source}:${member.id}`);

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: registered }}
                    disabled={addFavoritePerson.isPending}
                    key={`${member.id}:${member.character ?? ""}`}
                    onPress={() => (registered ? openCastMember(member) : addCastMember(member))}
                    style={[
                      styles.castCard,
                      registered ? styles.castCardRegistered : null,
                      addFavoritePerson.isPending ? styles.statusButtonDisabled : null
                    ]}
                  >
                    <Image
                      contentFit="cover"
                      source={member.profile_url ? { uri: member.profile_url } : null}
                      style={styles.castImage}
                    />
                    <View style={styles.castTextBox}>
                      <View style={styles.castNameRow}>
                        <Text numberOfLines={1} style={styles.castName}>
                          {member.name}
                        </Text>
                        {registered ? <Text style={styles.registeredBadge}>등록됨</Text> : null}
                      </View>
                      {member.original_name && member.original_name !== member.name ? (
                        <Text numberOfLines={1} style={styles.castOriginalName}>
                          {member.original_name}
                        </Text>
                      ) : null}
                      {member.character ? (
                        <Text numberOfLines={1} style={styles.castCharacter}>
                          {member.character}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {externalResult || libraryItem ? (
          <View style={styles.addPanel}>
            <Text style={styles.addTitle}>
              {libraryItem ? "내 목록 상태" : "내 목록에 추가"}
            </Text>
            <View style={styles.statusGrid}>
              {WATCH_STATUS_OPTIONS.map((status) => {
                const active = selectedStatuses.includes(status);
                const pending = addToLibrary.isPending || updateStatuses.isPending || deleteLibraryItem.isPending;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ checked: active }}
                    disabled={pending}
                    key={status}
                    onPress={() => toggleStatus(status)}
                    style={[
                      styles.statusButton,
                      active ? styles.statusButtonActive : null,
                      pending ? styles.statusButtonDisabled : null
                    ]}
                  >
                    <Text style={[styles.statusButtonText, active ? styles.statusButtonTextActive : null]}>
                      {pending ? "저장 중" : WATCH_STATUS_LABEL[status]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {libraryItem ? (
              <Pressable
                accessibilityRole="button"
                disabled={deleteLibraryItem.isPending}
                onPress={removeFromLibrary}
                style={[styles.deleteButton, deleteLibraryItem.isPending ? styles.statusButtonDisabled : null]}
              >
                <Text style={styles.deleteButtonText}>
                  {deleteLibraryItem.isPending ? "삭제 중" : "삭제"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {EXTENDED_FEATURES_ENABLED && libraryItem ? (
          <ContentReviewEditor
            contentId={libraryItem.content_id}
            contentAirDate={view.airDate}
            contentEndDate={view.endDate}
            contentAirYear={view.airYear}
            firstWatchedAt={libraryItem.first_watched_at}
            lastWatchedAt={libraryItem.last_watched_at}
            libraryItemId={libraryItem.library_item_id}
            onSaved={openLibraryList}
          />
        ) : null}


      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function normalizeContentTypeFromCast(
  contentType: SearchResult["content_type"],
  cast: CastMember[]
): SearchResult["content_type"] {
  if (contentType === "movie" || contentType === "anime") return contentType;

  const voiceCastCount = cast.filter((member) => /\bvoice\b/i.test(member.character ?? "")).length;
  if (voiceCastCount >= 2) return "anime";

  return contentType;
}

function createNextWatchStatuses(currentStatuses: WatchStatus[], targetStatus: WatchStatus): WatchStatus[] {
  const current = normalizeWatchStatuses(currentStatuses);
  const active = current.includes(targetStatus);

  if (PRIMARY_WATCH_STATUS_SET.has(targetStatus)) {
    if (active) return current;
    return normalizeWatchStatuses([
      targetStatus,
      ...current.filter((status) => !PRIMARY_WATCH_STATUS_SET.has(status))
    ]);
  }

  if (active) {
    const next = current.filter((status) => status !== targetStatus);
    return next.length ? normalizeWatchStatuses(next) : current;
  }

  return normalizeWatchStatuses([...current, targetStatus]);
}

function areSameWatchStatuses(left: WatchStatus[], right: WatchStatus[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((status) => rightSet.has(status));
}

function WatchCountInput({
  watchCount,
  isCompleted,
  isSaving,
  onSave
}: {
  watchCount: number;
  isCompleted: boolean;
  isSaving: boolean;
  onSave: (watchCount: number) => void;
}) {
  const [value, setValue] = useState(String(watchCount));
  const saveState = resolveWatchCountSaveState(value, watchCount, isCompleted);
  const blockedReason = describeWatchCountSaveState(saveState);
  const canSave = saveState.kind === "savable";

  useEffect(() => {
    setValue(String(watchCount));
  }, [watchCount]);

  const submit = () => {
    if (saveState.kind !== "savable") return;
    onSave(saveState.value);
  };

  return (
    <View style={styles.progressPanel}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>본 횟수</Text>
        <Text style={styles.progressMeta}>
          {watchCount}회
        </Text>
      </View>
      <View style={styles.progressInputRow}>
        <TextInput
          accessibilityLabel="작품을 본 횟수 입력"
          editable={!isSaving}
          inputMode="numeric"
          keyboardType="number-pad"
          onChangeText={(text) => setValue(text.replace(/\D/g, ""))}
          onSubmitEditing={submit}
          selectTextOnFocus
          style={styles.progressInput}
          value={value}
        />
        <Text style={styles.progressDivider}>회</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving || !canSave}
          onPress={submit}
          style={[
            styles.progressSaveButton,
            isSaving || !canSave ? styles.progressSaveButtonDisabled : null
          ]}
        >
          <Text style={styles.progressSaveText}>{isSaving ? "저장 중" : "저장"}</Text>
        </Pressable>
      </View>
      {blockedReason ? (
        <Text style={styles.progressHint}>{blockedReason}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingBottom: 24
  },
  poster: {
    alignSelf: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 300,
    marginTop: spacing.lg,
    width: 200
  },
  body: {
    gap: spacing.md,
    padding: spacing.lg
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  original: {
    color: colors.textMuted,
    fontSize: 14
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  warning: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700"
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  progressPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  progressMeta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  progressInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  progressInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    minWidth: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: "center"
  },
  progressDivider: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  progressSaveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginLeft: "auto",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  progressSaveButtonDisabled: {
    opacity: 0.5
  },
  progressHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs
  },
  progressSaveText: {
    color: colors.surface,
    fontWeight: "900"
  },
  overview: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22
  },
  castSection: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  castHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  castGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  castCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 220,
    padding: spacing.sm
  },
  castCardRegistered: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  castImage: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 48,
    width: 36
  },
  castTextBox: {
    flex: 1
  },
  castNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  castName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  registeredBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    color: colors.surface,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  castOriginalName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  castCharacter: {
    color: colors.textMuted,
    fontSize: 12
  },
  actions: {
    gap: spacing.md
  },
  addPanel: {
    gap: spacing.sm
  },
  addTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    flexGrow: 1,
    minWidth: 140,
    padding: spacing.md
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: StyleSheet.hairlineWidth
  },
  statusButtonDisabled: {
    opacity: 0.6
  },
  statusButtonText: {
    color: colors.text,
    fontWeight: "800"
  },
  statusButtonTextActive: {
    color: colors.surface
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: "900"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  primaryText: {
    color: colors.surface,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg
  },
  secondaryText: {
    color: colors.text,
    fontWeight: "800"
  }
});
