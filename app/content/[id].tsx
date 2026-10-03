import { PEOPLE_FEATURES_ENABLED } from "@/constants/features";
import { KeyboardAvoidingView, Platform, useWindowDimensions, ScrollView, View } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useNetworkState } from "expo-network";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ScreenStateFrame } from "@/components/common/ScreenStateFrame";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ContentReviewEditor } from "@/components/content/ContentReviewEditor";
import { EpisodeProgressCard } from "@/components/content/EpisodeProgressCard";
import { WatchProviderList } from "@/components/content/WatchProviderList";
import { normalizeWatchStatuses } from "@/constants/status";
import { colors, spacing } from "@/constants/theme";
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
import { createAirDateLabel, createEpisodeCountLabel } from "@/utils/contentMetaDisplay";
import { createLibraryRouteParams, parseLibraryRouteParams } from "@/utils/libraryRouteParams";
import { createSeasonOffsetsByNumber, toAbsoluteEpisodeNumber } from "@/utils/episodeProgress";
import { resolveContentLibraryItem } from "@/utils/seasonLibraryMatch";
import { getProgressStatusSuggestion } from "@/utils/progressStatusSuggestion";
import { HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";
import { getContentDetailLayout, createContentDetailMetaItems, createWatchStatusControlModel, contentDetailSections, type ContentDetailSection } from "@/utils/contentDetailView";
import { createNextWatchStatuses, areSameWatchStatuses } from "@/utils/watchStatusSelection";
import { createLibraryDeleteConfirmCopy, LIBRARY_DELETE_ZONE_COPY } from "@/utils/libraryFeedbackCopy";
import { userFacingErrorMessage } from "@/utils/profileDashboard";
import { confirmDestructive } from "@/utils/confirmDestructive";
import { ContentDetailHero } from "@/components/content/ContentDetailHero";
import { WatchStatusControl } from "@/components/content/WatchStatusControl";
import { ContentActionBar } from "@/components/content/ContentActionBar";
import { WatchCountCard } from "@/components/content/WatchCountCard";
import { ContentOverviewCard } from "@/components/content/ContentOverviewCard";
import { CastSection } from "@/components/content/CastSection";
import { LibraryDangerZone } from "@/components/content/LibraryDangerZone";

function parseSeasonParam(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const layout = getContentDetailLayout(width);
  const [columnsY, setColumnsY] = useState<number | null>(null);
  const [progressY, setProgressY] = useState<number | null>(null);
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
    title: watchProviderTitle,
    originalTitle: externalDetail.data?.content.title_original ?? params.originalTitle ?? dbContent?.title_original ?? null,
    airYear: externalDetail.data?.content.air_year ?? (params.airYear ? Number(params.airYear) : null) ?? dbContent?.air_year ?? null
  });
  const resolvedContentId = externalDetail.data?.content.content_id ?? params.id;
  const requestedSeason = parseSeasonParam(params.season);
  const libraryMatch = resolveContentLibraryItem(library.data ?? [], {
    contentId: resolvedContentId,
    libraryItemId: params.libraryItemId ?? null,
    seasonNumber: requestedSeason
  });
  const libraryItem = libraryMatch.kind === "none" ? undefined : libraryMatch.item;
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
        { onError: () => addToast("상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", "error") }
      );
      return;
    }

    const resultToAdd = externalDetail.data?.content ?? externalResult;
    if (!resultToAdd) return;
    addToLibrary.mutate(
      { result: resultToAdd, status, ...(requestedSeason !== null ? { seasonNumber: requestedSeason } : {}) },
      {
        onSuccess: (response) => router.replace({ pathname: "/content/[id]", params: { id: response.content_id, ...(params.season ? { season: params.season } : {}) } }),
        onError: () => addToast("내 목록에 추가하지 못했어요. 잠시 후 다시 시도해 주세요.", "error")
      }
    );
  };

  const removeFromLibrary = () => {
    if (!libraryItem) return;

    deleteLibraryItem.mutate(
      { libraryItemId: libraryItem.library_item_id },
      {
        onSuccess: () => { addToast("내 목록에서 삭제했어요.", "success"); openLibraryList(); },
        onError: (error) => addToast(userFacingErrorMessage(error, LIBRARY_DELETE_ZONE_COPY.errorFallback), "error")
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
        onSuccess: () => addToast(`${member.name}을(를) 좋아하는 인물에 등록했어요.`, "success", { actionLabel: "보기", onAction: () => openCastMember(member) }),
        onError: (error) => addToast(error.message || "등록하지 못했어요.", "error")
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

  const focusProgressCard = useCallback((y: number) => {
    if (params.focus !== "progress" || didFocusProgress.current) return;
    didFocusProgress.current = true;
    setProgressHighlighted(true);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - spacing.xl), animated: true });
    });
    highlightTimer.current = setTimeout(() => setProgressHighlighted(false), 1500);
  }, [params.focus]);

  useEffect(() => {
    if (columnsY !== null && progressY !== null) focusProgressCard(columnsY + progressY);
  }, [columnsY, progressY, focusProgressCard]);

  if (content.isLoading) return <ScreenStateFrame><LoadingSkeleton /></ScreenStateFrame>;
  if (content.isError) return <ScreenStateFrame><ErrorState message={content.error.message} onRetry={() => content.refetch()} /></ScreenStateFrame>;
  if (!view) return <ScreenStateFrame><EmptyState title="콘텐츠를 찾을 수 없습니다" /></ScreenStateFrame>;

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

  const saveWatchCount = (watchCount: number) => {
    if (!libraryItem) return;
    updateWatchCount.mutate(
      { libraryItemId: libraryItem.library_item_id, watchCount },
      {
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
            addToast("모든 화를 봤어요. 완료로 표시할까요?", "info", { actionLabel: "완료로 표시", onAction: () => toggleStatus("completed"), durationMs: 8000 });
          } else if (suggestion === "mark_watching") {
            toggleStatus("watching");
          }
        },
        onError: () => addToast("시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.", "error"),
      },
    );
  };



  const confirmRemoveFromLibrary = () => {
    if (!libraryItem || deleteLibraryItem.isPending) return;
    const copy = createLibraryDeleteConfirmCopy(view.title);
    confirmDestructive({ title: copy.title, message: copy.message, confirmLabel: copy.confirmLabel, onConfirm: removeFromLibrary });
  };
  const statusPending = addToLibrary.isPending || updateStatuses.isPending || deleteLibraryItem.isPending;
  const sections = contentDetailSections({ columns: layout.columns, inLibrary: Boolean(libraryItem), isSeries: view.contentType !== "movie", hasCast: view.cast.length > 0, peopleEnabled: PEOPLE_FEATURES_ENABLED });
  const renderSection = (key: ContentDetailSection) => {
    switch (key) {
      case "progress": return libraryItem ? <View key={key} onLayout={event => setProgressY(event.nativeEvent.layout.y)}>
        <EpisodeProgressCard highlighted={progressHighlighted}
          isOffline={networkState.isConnected === false || networkState.isInternetReachable === false}
          isSaving={updateManualProgress.isPending} isUnavailable={!libraryItem.manual_progress_available}
          item={progressLibraryItem ?? libraryItem} onOpenEpisodes={openEpisodes} onSave={saveManualProgress} totalEpisodes={resolvedEpisodeCount} />
      </View> : null;
      case "watchCount": return libraryItem ? <WatchCountCard key={key} watchCount={libraryItem.watch_count} isCompleted={selectedStatuses.includes("completed")} isSaving={updateWatchCount.isPending} onSave={saveWatchCount} /> : null;
      case "providers": return <WatchProviderList key={key} error={watchProviders.error} isLoading={watchProviders.isLoading} providers={watchProviders.data.providers} otherRegions={watchProviders.data.other_regions ?? []} />;
      case "review": return libraryItem ? <ContentReviewEditor key={key} contentId={libraryItem.content_id} contentAirDate={view.airDate} contentEndDate={view.endDate} contentAirYear={view.airYear} firstWatchedAt={libraryItem.first_watched_at} lastWatchedAt={libraryItem.last_watched_at} libraryItemId={libraryItem.library_item_id} onSaved={() => addToast("내 감상을 저장했어요.", "success")} /> : null;
      case "overview": return <ContentOverviewCard key={key} overview={view.overview} />;
      case "cast": return <CastSection key={key} cast={view.cast} isAnime={view.contentType === "anime"} favoriteKeys={favoritePersonKeys} pending={addFavoritePerson.isPending} columns={layout.mainWidth >= 520 ? 2 : 1} onAdd={addCastMember} onOpen={openCastMember} />;
      case "danger": return <LibraryDangerZone key={key} pending={deleteLibraryItem.isPending} onDelete={confirmRemoveFromLibrary} />;
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" ref={scrollViewRef} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <View style={{ width: "100%", maxWidth: HOME_CONTENT_MAX_WIDTH, alignSelf: "center", paddingLeft: Math.max(layout.gutter, insets.left), paddingRight: Math.max(layout.gutter, insets.right), paddingTop: spacing.lg, gap: layout.gap }}>
          <ContentDetailHero title={view.title} originalTitle={view.originalTitle} posterUrl={view.posterUrl}
            metaItems={createContentDetailMetaItems({ contentType: view.contentType, airDateLabel, episodeLabel })}
            genres={view.genres} poster={layout.poster} warning={externalDetail.isError ? "상세 정보 일부를 불러오지 못해 검색 결과 기준으로 표시합니다." : null}>
            {externalResult || libraryItem ? <WatchStatusControl model={createWatchStatusControlModel(selectedStatuses, Boolean(libraryItem))} pending={statusPending} onSelect={toggleStatus} /> : null}
            {!externalResult || libraryItem ? <ContentActionBar isMovie={view.contentType === "movie"} pinCount={libraryItem?.pin_count}
              onOpenEpisodes={() => router.push({ pathname: "/content/[id]/episodes", params: { id: libraryItem?.content_id ?? params.id, ...(libraryItem ? { libraryItemId: libraryItem.library_item_id } : {}), ...(params.season ? { season: params.season } : {}) } })}
              onAddMoviePin={() => router.push({ pathname: "/pins/new", params: { contentId: libraryItem?.content_id ?? params.id } })}
              onOpenPins={() => router.push({ pathname: "/content/[id]/pins", params: { id: libraryItem?.content_id ?? params.id, ...(libraryItem ? { libraryItemId: libraryItem.library_item_id } : {}), ...(params.season ? { season: params.season } : {}) } })}
              onOpenList={openLibraryList} /> : null}
          </ContentDetailHero>
          <View onLayout={event => setColumnsY(event.nativeEvent.layout.y)} style={{ flexDirection: layout.columns === 2 ? "row" : "column", alignItems: layout.columns === 2 ? "flex-start" : "stretch", gap: layout.gap }}>
            <View style={{ width: layout.mainWidth, gap: layout.gap }}>{sections.main.map(renderSection)}</View>
            {sections.side.length ? <View style={{ width: layout.sideWidth, gap: layout.gap }}>{sections.side.map(renderSection)}</View> : null}
          </View>
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
