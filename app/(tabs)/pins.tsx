import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { useCallback , useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect , useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PinShareCard } from "@/components/pins/PinShareCard";
import { EMOTION_LABELS, EMOTION_OPTIONS } from "@/constants/emotions";
import { colors, spacing } from "@/constants/theme";
import { useTags } from "@/hooks/useTags";
import { useAllPins, usePinsByTag } from "@/hooks/useTimelinePins";
import type { EmotionType, PinSortMode, TimelinePin } from "@/types/pins";
import { ALL_GENRE_FILTER, createGenreFilterOptions, matchesGenreFilter } from "@/utils/genre";
import { sharePinCardImage } from "@/utils/pinShare";
import { shouldShowPinDetailPanel } from "@/utils/pinResponsive";
import { formatSecondsToTimecode } from "@/utils/timecode";

const DETAIL_PANEL_WIDTH = 360;
const MAIN_CONTENT_MAX_WIDTH = 860;

const emotionFilterOptions = EMOTION_OPTIONS.map((value) => ({
  label: EMOTION_LABELS[value],
  value
}));

type ViewMode = "list" | "timeline";

export default function PinsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showDetailPanel = shouldShowPinDetailPanel(width, width - spacing.xl * 3);
  const [sortMode, setSortMode] = useState<PinSortMode>("latest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | "all">("all");
  const [genreFilter, setGenreFilter] = useState(ALL_GENRE_FILTER);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useAtom(revealedSpoilerPinIdsAtom);
  useFocusEffect(useCallback(() => () => setRevealedSpoilers(new Set()), [setRevealedSpoilers]));
  const plainShareRef = useRef<View | null>(null);
  const maskedShareRef = useRef<View | null>(null);
  const allPins = useAllPins();
  const taggedPins = usePinsByTag(selectedTagId ?? undefined);
  const tags = useTags();
  const router = useRouter();

  const activePins = selectedTagId ? taggedPins.data : allPins.data;
  const allPinsForSummary = allPins.data ?? [];
  const genreOptions = useMemo(() => createGenreFilterOptions((activePins ?? []).flatMap((pin) => pin.genres ?? [])), [activePins]);

  const filteredPins = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return (activePins ?? [])
      .filter((pin) => matchesGenreFilter(pin.genres, genreFilter))
      .filter((pin) => (selectedEmotion === "all" ? true : pin.emotion === selectedEmotion))
      .filter((pin) => {
        if (!normalizedQuery) return true;

        const fields = [
          pin.content_title,
          pin.episode_title,
          pin.memo,
          pin.display_time_label,
          pin.emotion ? EMOTION_LABELS[pin.emotion] : null,
          ...(pin.genres ?? []),
          ...(pin.tags?.map((tag) => tag.name) ?? [])
        ];

        return fields.some((field) => field?.toLocaleLowerCase().includes(normalizedQuery));
      });
  }, [activePins, genreFilter, searchQuery, selectedEmotion]);

  const sortedPins = useMemo(() => {
    const pins = [...filteredPins];
    if (sortMode === "timeline") {
      return pins.sort((a, b) => {
        const titleCompare = (a.content_title ?? "").localeCompare(b.content_title ?? "", "ko");
        if (titleCompare !== 0) return titleCompare;
        const aTime = a.timestamp_seconds ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timestamp_seconds ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime || a.created_at.localeCompare(b.created_at);
      });
    }
    return pins.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [filteredPins, sortMode]);

  const selectedPin = useMemo(
    () => sortedPins.find((pin) => pin.id === selectedPinId) ?? sortedPins[0] ?? null,
    [selectedPinId, sortedPins]
  );

  useEffect(() => {
    if (!sortedPins.length) {
      setSelectedPinId(null);
      return;
    }
    if (!selectedPinId || !sortedPins.some((pin) => pin.id === selectedPinId)) {
      setSelectedPinId(sortedPins[0]?.id ?? null);
    }
  }, [selectedPinId, sortedPins]);

  const isLoading = selectedTagId ? taggedPins.isLoading : allPins.isLoading;
  const isError = selectedTagId ? taggedPins.isError : allPins.isError;
  const hasActiveFilter =
    Boolean(searchQuery.trim()) ||
    Boolean(selectedTagId) ||
    selectedEmotion !== "all" ||
    genreFilter !== ALL_GENRE_FILTER;

  const revealSpoiler = (pin: TimelinePin) => {
    setRevealedSpoilers((previous) => new Set([...previous, pin.id]));
  };

  const sharePin = (pinToShare: TimelinePin) => {
    if (Platform.OS === "web") return;

    const capture = async (maskMemo: boolean) => {
      try {
        await sharePinCardImage(maskMemo ? maskedShareRef : plainShareRef);
      } catch (error) {
        console.error("Pin share failed:", error);
        Alert.alert("공유 실패", error instanceof Error ? error.message : "핀 이미지를 공유하지 못했습니다.");
      }
    };

    if (!pinToShare.is_spoiler) {
      void capture(false);
      return;
    }

    Alert.alert("스포일러 핀입니다", "메모를 가린 카드로 공유할까요?", [
      { text: "취소", style: "cancel" },
      { text: "가리고 공유", onPress: () => void capture(true) },
      { text: "그대로 공유", onPress: () => void capture(false) }
    ]);
  };

  const listData = sortedPins;
  const emptyTitle = hasActiveFilter ? "검색 결과가 없어요" : "아직 저장된 핀이 없어요";
  const emptyDescription = hasActiveFilter ? "다른 키워드나 필터를 사용해보세요." : "감동적인 장면을 발견하면 핀으로 남겨보세요.";
  const listHeader = (
    <View style={styles.listHeader}>
      {isError && sortedPins.length ? <ErrorState message="저장된 기록을 표시합니다. 연결 후 다시 시도해 주세요." onRetry={() => selectedTagId ? taggedPins.refetch() : allPins.refetch()} /> : null}
      <View style={[styles.header, width < 768 ? { flexDirection: "column", alignItems: "stretch" } : null]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>핀</Text>
          <Text style={styles.subtitle}>감동적인 장면과 기억하고 싶은 대사를 모아보세요.</Text>
        </View>
        <View style={[styles.headerTools, { maxWidth: "100%" }]}>
          <View style={styles.searchBox}>
            <Ionicons color={colors.textMuted} name="search-outline" size={18} />
            <TextInput
              accessibilityLabel="핀 검색"
              onChangeText={setSearchQuery}
              placeholder="작품명, 핀 메모, 태그 검색"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="button" onPress={() => setSearchQuery("")}>
                <Ionicons color={colors.textMuted} name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </View>
          <ToolbarIconButton icon="filter-outline" label="필터" />
          <ToolbarIconButton
            icon={viewMode === "list" ? "list-outline" : "git-branch-outline"}
            label="보기 방식"
            onPress={() => setViewMode((current) => (current === "list" ? "timeline" : "list"))}
            selected={viewMode === "timeline"}
          />
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.segmentGroup}>
          <SegmentButton label="최신순" selected={sortMode === "latest"} onPress={() => setSortMode("latest")} />
          <SegmentButton label="시간순" selected={sortMode === "timeline"} onPress={() => setSortMode("timeline")} />
        </View>
        <Text style={styles.resultCount}>{sortedPins.length}개의 핀</Text>
      </View>

      <FilterRow
        label="장르"
        options={genreOptions.map((genre) => ({ id: genre, label: genre }))}
        selectedId={genreFilter}
        allLabel="전체"
        onSelect={setGenreFilter}
      />
      <FilterRow
        label="감정"
        options={emotionFilterOptions.map((emotion) => ({ id: emotion.value, label: emotion.label }))}
        selectedId={selectedEmotion}
        allLabel="전체"
        onSelect={(value) => setSelectedEmotion(value as EmotionType | "all")}
      />
      <FilterRow
        label="태그"
        options={(tags.data ?? []).map((tag) => ({ id: tag.id, label: `#${tag.name}` }))}
        selectedId={selectedTagId ?? "all"}
        allLabel="전체"
        onSelect={(value) => setSelectedTagId(value === "all" ? null : value)}
      />

      <SummaryCards
        pins={allPinsForSummary}
        selectedEmotion={selectedEmotion}
        onSelectEmotion={setSelectedEmotion}
        onSelectAll={() => {
          setSelectedTagId(null);
          setSelectedEmotion("all");
          setGenreFilter(ALL_GENRE_FILTER);
        }}
      />
    </View>
  );

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <View style={styles.page}>
        <View style={styles.contentGrid}>
          <View style={styles.mainColumn}>
            <FlashList
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  {isLoading ? (
                    <LoadingSkeleton variant="pin-item" count={5} />
                  ) : isError ? (
                    <ErrorState onRetry={() => (selectedTagId ? taggedPins.refetch() : allPins.refetch())} />
                  ) : (
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  )}
                </View>
              }
              ListHeaderComponent={listHeader}
              ItemSeparatorComponent={() => <View style={viewMode === "timeline" ? styles.timelineSeparator : styles.pinSeparator} />}
              contentContainerStyle={styles.pinFlashContent}
              data={listData}
              drawDistance={520}
              extraData={{
                selectedPinId: selectedPin?.id ?? null,
                revealedSpoilers,
                viewMode
              }}
              keyExtractor={(pin) => pin.id}
              renderItem={({ item: pin }) =>
                viewMode === "timeline" ? (
                  <PinTimelineItem
                    isSpoilerRevealed={revealedSpoilers.has(pin.id)}
                    onRevealSpoiler={() => revealSpoiler(pin)}
                    pin={pin}
                    selectedPinId={selectedPin?.id ?? null}
                    onSelectPin={setSelectedPinId}
                  />
                ) : (
                  <PinCard
                    isSelected={selectedPin?.id === pin.id}
                    isSpoilerRevealed={revealedSpoilers.has(pin.id)}
                    onOpen={() => router.push({ pathname: "/pins/[id]", params: { id: pin.id } })}
                    onRevealSpoiler={() => revealSpoiler(pin)}
                    onSelect={() => setSelectedPinId(pin.id)}
                    pin={pin}
                  />
                )
              }
              style={styles.pinFlashList}
            />
          </View>

          {showDetailPanel ? <PinDetailPanel
            isSpoilerRevealed={selectedPin ? revealedSpoilers.has(selectedPin.id) : false}
            onOpenDetail={() => selectedPin && router.push({ pathname: "/pins/[id]", params: { id: selectedPin.id } })}
            onRevealSpoiler={() => selectedPin && revealSpoiler(selectedPin)}
            onShare={() => selectedPin && sharePin(selectedPin)}
            pin={selectedPin}
          /> : null}
        </View>
      </View>
      {EXTENDED_FEATURES_ENABLED && selectedPin ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none" style={styles.captureLayer}>
          <PinShareCard maskMemo={selectedPin.is_spoiler && !revealedSpoilers.has(selectedPin.id)} pin={selectedPin} ref={plainShareRef} />
          <PinShareCard maskMemo pin={selectedPin} ref={maskedShareRef} />
        </View>
      ) : null}
    </View>
  );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segment, selected ? styles.segmentSelected : null]}
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function ToolbarIconButton({
  icon,
  label,
  onPress,
  selected = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, selected ? styles.iconButtonSelected : null]}
    >
      <Ionicons color={selected ? colors.primary : colors.textMuted} name={icon} size={20} />
    </Pressable>
  );
}

function FilterRow({
  label,
  options,
  selectedId,
  allLabel,
  onSelect
}: {
  label: string;
  options: { id: string; label: string }[];
  selectedId: string;
  allLabel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
        <FilterChip label={allLabel} selected={selectedId === "all"} onPress={() => onSelect("all")} />
        {options.map((option) => (
          <FilterChip key={option.id} label={option.label} selected={selectedId === option.id} onPress={() => onSelect(option.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
    >
      <Text numberOfLines={1} style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCards({
  pins,
  selectedEmotion,
  onSelectAll,
  onSelectEmotion
}: {
  pins: TimelinePin[];
  selectedEmotion: EmotionType | "all";
  onSelectAll: () => void;
  onSelectEmotion: (emotion: EmotionType | "all") => void;
}) {
  const emotionCounts = pins.reduce(
    (counts, pin) => {
      if (pin.emotion && pin.emotion !== "none") counts[pin.emotion] += 1;
      return counts;
    },
    Object.fromEntries(EMOTION_OPTIONS.map((emotion) => [emotion, 0])) as Record<EmotionType, number>
  );
  const emotionCards = EMOTION_OPTIONS.map((emotion) => ({
    emotion,
    label: EMOTION_LABELS[emotion],
    value: emotionCounts[emotion]
  }))
    .filter((card) => card.emotion !== "none" && card.value > 0)
    .sort((a, b) => b.value - a.value || EMOTION_OPTIONS.indexOf(a.emotion) - EMOTION_OPTIONS.indexOf(b.emotion));

  return (
    <ScrollView contentContainerStyle={styles.summaryGrid} horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroller}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selectedEmotion === "all" }}
        onPress={onSelectAll}
        style={[styles.summaryCard, selectedEmotion === "all" ? styles.summaryCardSelected : null]}
      >
        <View style={[styles.summaryIcon, styles.summaryIconBlue]}>
          <Ionicons color={colors.primary} name="bookmark" size={20} />
        </View>
        <View>
          <Text style={styles.summaryLabel}>전체 핀</Text>
          <Text style={styles.summaryValue}>{pins.length}</Text>
        </View>
      </Pressable>

      {emotionCards.map((card) => {
        const selected = selectedEmotion === card.emotion;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={card.emotion}
            onPress={() => onSelectEmotion(selected ? "all" : card.emotion)}
            style={[styles.summaryCard, selected ? styles.summaryCardSelected : null]}
          >
            <View style={[styles.summaryIcon, getEmotionSummaryTone(card.emotion)]}>
              <Ionicons color={colors.primary} name={getEmotionSummaryIcon(card.emotion)} size={20} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={styles.summaryValue}>{card.value}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getEmotionSummaryIcon(emotion: EmotionType): keyof typeof Ionicons.glyphMap {
  switch (emotion) {
    case "moved":
    case "love":
      return "heart";
    case "excited":
      return "sparkles";
    case "funny":
      return "happy";
    case "sad":
      return "rainy";
    case "surprised":
      return "alert-circle";
    case "angry":
      return "flame";
    case "scared":
      return "skull";
    case "boring":
      return "remove-circle";
    case "none":
      return "ellipse-outline";
  }
}

function getEmotionSummaryTone(emotion: EmotionType) {
  switch (emotion) {
    case "moved":
    case "love":
      return styles.summaryIconRose;
    case "excited":
    case "surprised":
      return styles.summaryIconAmber;
    case "funny":
      return styles.summaryIconGreen;
    case "sad":
    case "scared":
      return styles.summaryIconBlue;
    case "angry":
      return styles.summaryIconRed;
    case "boring":
    case "none":
      return styles.summaryIconSlate;
  }
}

function PinTimelineItem({
  pin,
  selectedPinId,
  onSelectPin,
  isSpoilerRevealed,
  onRevealSpoiler
}: {
  pin: TimelinePin;
  selectedPinId: string | null;
  onSelectPin: (id: string) => void;
  isSpoilerRevealed: boolean;
  onRevealSpoiler: () => void;
}) {
  const shouldHideMemo = pin.is_spoiler && !isSpoilerRevealed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selectedPinId === pin.id }}
      onPress={() => onSelectPin(pin.id)}
      style={[styles.timelineItem, selectedPinId === pin.id ? styles.timelineItemSelected : null]}
    >
      <View style={styles.timelineDot} />
      <View style={styles.timelineBody}>
        <Text style={styles.timelineDate}>{formatDate(pin.created_at)}</Text>
        <Text numberOfLines={1} style={styles.timelineTitle}>{getPinContextLabel(pin)}</Text>
        <View style={styles.pinMetaRow}>
          <Text style={styles.timeCode}>{getPinTimeLabel(pin)}</Text>
          {pin.emotion && pin.emotion !== "none" ? (
            <Text style={styles.emotionBadge}>{EMOTION_LABELS[pin.emotion]}</Text>
          ) : null}
        </View>
        {shouldHideMemo ? (
          <Pressable accessibilityRole="button" onPress={onRevealSpoiler} style={styles.spoilerInline}>
            <Text style={styles.spoilerInlineText}>스포일러 포함 · 보기</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={2} style={styles.pinMemo}>{pin.memo?.trim() || "메모 없음"}</Text>
        )}
      </View>
    </Pressable>
  );
}

function PinCard({
  pin,
  isSelected,
  isSpoilerRevealed,
  onSelect,
  onOpen,
  onRevealSpoiler
}: {
  pin: TimelinePin;
  isSelected: boolean;
  isSpoilerRevealed: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRevealSpoiler: () => void;
}) {
  const timeLabel = getPinTimeLabel(pin);
  const contextLabel = getPinContextLabel(pin);
  const shouldHideMemo = pin.is_spoiler && !isSpoilerRevealed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onSelect}
      style={[styles.pinCard, isSelected ? styles.pinCardSelected : null]}
    >
      <PinPoster pin={pin} />
      <View style={styles.pinCardBody}>
        <Text numberOfLines={2} style={styles.pinTitle}>{contextLabel}</Text>
        {shouldHideMemo ? (
          <Pressable accessibilityRole="button" onPress={onRevealSpoiler} style={styles.spoilerInline}>
            <Text style={styles.spoilerInlineText}>스포일러 포함 · 보기</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={2} style={styles.pinMemo}>{pin.memo?.trim() || "메모 없음"}</Text>
        )}
        <View style={styles.pinMetaRow}>
          <Text style={styles.timeCode}>{timeLabel}</Text>
          {pin.emotion && pin.emotion !== "none" ? (
            <Text style={styles.emotionBadge}>{EMOTION_LABELS[pin.emotion]}</Text>
          ) : null}
        </View>
        {pin.tags?.length ? (
          <View style={styles.tagRow}>
            {pin.tags.slice(0, 4).map((tag) => (
              <Text key={tag.id} style={styles.tagPill}>#{tag.name}</Text>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.pinCardAside}>
        <Text style={styles.dateText}>{formatDate(pin.created_at)}</Text>
        <Pressable accessibilityLabel="핀 상세 열기" accessibilityRole="button" onPress={onOpen} style={styles.moreButton}>
          <Ionicons color={colors.textMuted} name="ellipsis-vertical" size={19} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function PinDetailPanel({
  pin,
  isSpoilerRevealed,
  onRevealSpoiler,
  onOpenDetail,
  onShare
}: {
  pin: TimelinePin | null;
  isSpoilerRevealed: boolean;
  onRevealSpoiler: () => void;
  onOpenDetail: () => void;
  onShare: () => void;
}) {
  if (!pin) {
    return (
      <View style={[styles.detailPanel, styles.detailEmpty]}>
        <Ionicons color={colors.primary} name="pin" size={28} />
        <Text style={styles.detailEmptyTitle}>핀을 선택하세요</Text>
        <Text style={styles.detailEmptyText}>목록에서 핀을 선택하면 상세 내용을 바로 볼 수 있어요.</Text>
      </View>
    );
  }

  const shouldHideMemo = pin.is_spoiler && !isSpoilerRevealed;

  return (
    <View style={styles.detailPanel}>
      <PinPoster large pin={pin} />
      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>{pin.content_title ?? "제목 없음"}</Text>
        {pin.episode_number || pin.episode_title ? <Text style={styles.detailEpisode}>{getEpisodeLabel(pin)}</Text> : null}
      </View>
      <View style={styles.detailMetaRow}>
        <Text style={styles.detailTime}>{getPinTimeLabel(pin)}</Text>
        {pin.emotion && pin.emotion !== "none" ? <Text style={styles.emotionBadge}>{EMOTION_LABELS[pin.emotion]}</Text> : null}
      </View>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionLabel}>메모</Text>
        {shouldHideMemo ? (
          <Pressable accessibilityRole="button" onPress={onRevealSpoiler} style={styles.spoilerBox}>
            <Text style={styles.spoilerInlineText}>스포일러 포함 · 보기</Text>
          </Pressable>
        ) : (
          <Text style={styles.detailMemo}>{pin.memo?.trim() || "메모 없음"}</Text>
        )}
      </View>
      {pin.tags?.length ? (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionLabel}>태그</Text>
          <View style={styles.tagRow}>
            {pin.tags.map((tag) => (
              <Text key={tag.id} style={styles.tagPill}>#{tag.name}</Text>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={styles.createdAt}>저장일 {formatDate(pin.created_at)}</Text>
      <Pressable accessibilityRole="button" onPress={onOpenDetail} style={styles.primaryAction}>
        <Ionicons color={colors.surface} name="open-outline" size={18} />
        <Text style={styles.primaryActionText}>핀 상세 열기</Text>
      </Pressable>
      {EXTENDED_FEATURES_ENABLED && Platform.OS !== "web" ? (
        <Pressable accessibilityRole="button" onPress={onShare} style={styles.secondaryAction}>
          <Ionicons color={colors.primary} name="share-social-outline" size={18} />
          <Text style={styles.secondaryActionText}>공유</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PinPoster({ pin, large = false }: { pin: TimelinePin; large?: boolean }) {
  const initial = (pin.content_title?.trim()[0] ?? "핀").toLocaleUpperCase();
  return (
    <View style={[styles.poster, large ? styles.posterLarge : null]}>
      <View style={styles.posterPinBadge}>
        <Ionicons color={colors.surface} name="pin" size={large ? 17 : 13} />
      </View>
      <Text style={[styles.posterInitial, large ? styles.posterInitialLarge : null]}>{initial}</Text>
      <Text numberOfLines={2} style={[styles.posterTitle, large ? styles.posterTitleLarge : null]}>
        {pin.content_title ?? "SceneNote"}
      </Text>
    </View>
  );
}

function getPinTimeLabel(pin: TimelinePin): string {
  return pin.display_time_label ?? (pin.timestamp_seconds === null ? "시간 미지정" : formatSecondsToTimecode(pin.timestamp_seconds));
}

function getEpisodeLabel(pin: TimelinePin): string | null {
  if (!pin.episode_number && !pin.episode_title) return null;
  return [pin.episode_number ? `${pin.episode_number}화` : null, pin.episode_title].filter(Boolean).join(" · ");
}

function getPinContextLabel(pin: TimelinePin): string {
  return [pin.content_title ?? "제목 없음", getEpisodeLabel(pin)].filter(Boolean).join(" · ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", year: "numeric" }).replace(/\.$/, "");
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#F8FAFC",
    flex: 1
  },
  page: {
    flex: 1,
    paddingBottom: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl
  },
  contentGrid: {
    alignSelf: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xl,
    maxWidth: 1260,
    width: "100%"
  },
  mainColumn: {
    flex: 1,
    gap: spacing.lg,
    maxWidth: MAIN_CONTENT_MAX_WIDTH,
    minWidth: 0
  },
  listHeader: {
    gap: spacing.lg,
    paddingBottom: spacing.lg
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    color: "#0F172A",
    fontSize: 30,
    fontWeight: "900"
  },
  subtitle: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600"
  },
  headerTools: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    flex: 1,
    minWidth: 0,
    maxWidth: 320
  },
  searchInput: {
    color: "#0F172A",
    flex: 1,
    fontSize: 14,
    outlineStyle: "none" as never,
    padding: 0
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  iconButtonSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  segmentGroup: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    padding: 3
  },
  segment: {
    alignItems: "center",
    borderRadius: 11,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  segmentSelected: {
    backgroundColor: colors.primary
  },
  segmentText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "900"
  },
  segmentTextSelected: {
    color: colors.surface
  },
  resultCount: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800"
  },
  filterGroup: {
    gap: spacing.sm
  },
  filterLabel: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "900"
  },
  chipScroller: {
    flexGrow: 0,
    minHeight: 44
  },
  chipRow: {
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "900"
  },
  filterChipTextSelected: {
    color: colors.surface
  },
  summaryScroller: {
    flexGrow: 0,
    maxHeight: 96
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.md,
    paddingRight: spacing.lg
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minWidth: 166,
    minHeight: 86,
    padding: spacing.lg,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2
  },
  summaryCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: colors.primary
  },
  summaryIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  summaryIconBlue: {
    backgroundColor: "#DBEAFE"
  },
  summaryIconRose: {
    backgroundColor: "#FFE4E6"
  },
  summaryIconAmber: {
    backgroundColor: "#FFEDD5"
  },
  summaryIconPurple: {
    backgroundColor: "#EDE9FE"
  },
  summaryIconGreen: {
    backgroundColor: "#DCFCE7"
  },
  summaryIconRed: {
    backgroundColor: "#FEE2E2"
  },
  summaryIconSlate: {
    backgroundColor: "#E2E8F0"
  },
  summaryLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800"
  },
  summaryValue: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30
  },
  pinFlashList: {
    flex: 1
  },
  pinFlashContent: {
    paddingBottom: 24
  },
  listEmpty: {
    paddingTop: spacing.md
  },
  pinSeparator: {
    height: spacing.md
  },
  timelineSeparator: {
    height: spacing.md
  },
  pinCard: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 18,
    minHeight: 182,
    padding: spacing.lg,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2
  },
  pinCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: colors.primary
  },
  poster: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    height: 150,
    justifyContent: "center",
    overflow: "hidden",
    padding: spacing.sm,
    width: 112
  },
  posterLarge: {
    alignSelf: "center",
    height: 220,
    width: "100%"
  },
  posterPinBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    left: spacing.sm,
    position: "absolute",
    top: spacing.sm,
    width: 28
  },
  posterInitial: {
    color: "#0F172A",
    fontSize: 32,
    fontWeight: "900"
  },
  posterInitialLarge: {
    fontSize: 48
  },
  posterTitle: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "900",
    marginTop: spacing.sm,
    textAlign: "center"
  },
  posterTitleLarge: {
    fontSize: 15
  },
  pinCardBody: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0
  },
  pinTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  pinMemo: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22
  },
  pinMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  timeCode: {
    color: colors.primary,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "900"
  },
  emotionBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tagPill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: 5
  },
  pinCardAside: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: 96
  },
  dateText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },
  moreButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    width: 44
  },
  spoilerInline: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  spoilerInlineText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "900"
  },
  detailPanel: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    maxHeight: 760,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    width: DETAIL_PANEL_WIDTH
  },
  detailEmpty: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 380
  },
  detailEmptyTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900"
  },
  detailEmptyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  detailHeader: {
    gap: spacing.xs
  },
  detailTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  detailEpisode: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800"
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  detailTime: {
    color: colors.primary,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    fontWeight: "900"
  },
  detailSection: {
    gap: spacing.sm
  },
  detailSectionLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900"
  },
  detailMemo: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 23
  },
  spoilerBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: spacing.lg
  },
  createdAt: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.sm,
    height: 46,
    justifyContent: "center"
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    height: 46,
    justifyContent: "center"
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  captureLayer: {
    left: -1200,
    opacity: 0,
    position: "absolute",
    top: 0
  },
  timelineList: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg
  },
  timelineItem: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderLeftColor: "#CBD5E1",
    borderLeftWidth: 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    paddingLeft: spacing.xl
  },
  timelineItemSelected: {
    borderLeftColor: colors.primary
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 12,
    marginLeft: -23,
    marginTop: 4,
    width: 12
  },
  timelineBody: {
    flex: 1,
    gap: spacing.xs
  },
  timelineDate: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900"
  },
  timelineTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900"
  }
});
