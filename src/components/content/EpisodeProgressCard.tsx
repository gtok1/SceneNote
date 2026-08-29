import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/constants/theme";
import type { LibraryListItem } from "@/types/library";
import {
  MAX_MANUAL_EPISODE_NUMBER,
  createSeasonOffsetsByNumber,
  normalizeManualEpisodeInput,
  resolveEpisodeProgress,
  toAbsoluteEpisodeNumber,
  toSeasonRelativeEpisodeNumber,
} from "@/utils/episodeProgress";

interface EpisodeProgressCardProps {
  item: LibraryListItem;
  totalEpisodes: number | null;
  isSaving: boolean;
  isUnavailable?: boolean;
  isOffline?: boolean;
  onSave: (progress: { seasonNumber: number | null; episodeNumber: number } | null) => void;
  onOpenEpisodes: () => void;
  highlighted?: boolean;
}

export function EpisodeProgressCard({
  item,
  totalEpisodes,
  isSaving,
  isUnavailable = false,
  isOffline = false,
  onSave,
  onOpenEpisodes,
  highlighted = false,
}: EpisodeProgressCardProps) {
  const seasons = item.season_episode_counts;
  const hasSeasonSelector = seasons.length > 1;
  const initialDraft = useMemo(() => getInitialDraft(item, hasSeasonSelector), [item, hasSeasonSelector]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(initialDraft.seasonNumber);
  const [rawEpisodeNumber, setRawEpisodeNumber] = useState(String(initialDraft.episodeNumber));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSeasonNumber(initialDraft.seasonNumber);
    setRawEpisodeNumber(String(initialDraft.episodeNumber));
    setError(null);
  }, [initialDraft]);

  const selectedSeason = seasons.find((season) => season.season_number === selectedSeasonNumber);
  const upperBound = selectedSeason?.episode_count
    ?? totalEpisodes
    ?? MAX_MANUAL_EPISODE_NUMBER;
  const draftEpisodeNumber = rawEpisodeNumber === "" ? 0 : Number(rawEpisodeNumber);
  const offsets = useMemo(() => createSeasonOffsetsByNumber(seasons), [seasons]);
  const draftAbsolute = toAbsoluteEpisodeNumber(selectedSeasonNumber, draftEpisodeNumber, offsets) ?? 0;
  const draftProgress = resolveEpisodeProgress({
    contentType: item.content_type,
    episodeCount: totalEpisodes,
    watchedEpisodeCount: item.watched_episode_count,
    derivedWatchedThrough: null,
    manualWatchedThrough: draftAbsolute,
  });
  const savedSeasonNumber = hasSeasonSelector ? item.manual_watched_season_number : null;
  const unchanged = item.manual_watched_episode_number !== null
    && savedSeasonNumber === selectedSeasonNumber
    && item.manual_watched_episode_number === draftEpisodeNumber;
  const disabled = isSaving || isUnavailable;
  const saveDisabled = disabled || isOffline || unchanged || rawEpisodeNumber === "";
  const statusLabel = !unchanged
    ? "저장 전"
    : item.progress_source === "manual"
      ? "직접 설정함"
      : item.progress_source === "episode_progress"
        ? "에피소드 체크 기준"
        : null;
  const derivedDiffers = item.progress_source === "manual"
    && item.derived_watched_through !== null
    && item.derived_watched_through !== item.effective_watched_through;

  const changeDraft = (next: number) => {
    setRawEpisodeNumber(String(Math.min(upperBound, Math.max(0, Math.floor(next)))));
    setError(null);
  };

  const selectSeason = (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
    const savedValue = item.manual_watched_episode_number !== null
      && item.manual_watched_season_number === seasonNumber
      ? item.manual_watched_episode_number
      : 0;
    setRawEpisodeNumber(String(savedValue));
    setError(null);
  };

  const save = () => {
    const normalized = normalizeManualEpisodeInput({
      rawEpisodeNumber,
      seasonNumber: selectedSeasonNumber,
      seasons,
      totalEpisodes,
    });
    if (!normalized.ok) {
      setError(getErrorMessage(normalized.reason));
      return;
    }
    onSave({ seasonNumber: selectedSeasonNumber, episodeNumber: normalized.episodeNumber });
  };

  const reset = () => {
    Alert.alert(
      "시청 진행 되돌리기",
      "직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?",
      [
        { text: "취소", style: "cancel" },
        { text: "되돌리기", style: "destructive", onPress: () => onSave(null) },
      ],
    );
  };

  return (
    <View
      style={[
        styles.card,
        item.progress_source === "none" || highlighted ? styles.cardHighlighted : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>시청 진행</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.summary}>
            {totalEpisodes === null
              ? `${draftProgress.watchedThrough}화까지 시청`
              : `${draftProgress.watchedThrough} / ${totalEpisodes}화`}
          </Text>
          {statusLabel ? <Text style={styles.mode}>{statusLabel}</Text> : null}
        </View>
      </View>

      {totalEpisodes !== null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: totalEpisodes, now: draftProgress.watchedThrough }}
          style={styles.progressTrack}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round((draftProgress.progressRatio ?? 0) * 100)}%` },
            ]}
          />
        </View>
      ) : null}

      {hasSeasonSelector ? (
        <View style={styles.section}>
          <Text style={styles.label}>시즌</Text>
          <HorizontalChoiceRail
            contentContainerStyle={styles.seasons}
            disabled={disabled}
            itemStride={84}
            nextLabel="다음 시즌 보기"
            previousLabel="이전 시즌 보기"
            selectedIndex={Math.max(0, seasons.findIndex((season) => season.season_number === selectedSeasonNumber))}
          >
            {seasons.map((season) => {
              const selected = season.season_number === selectedSeasonNumber;
              return (
                <Pressable
                  key={season.season_number}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => selectSeason(season.season_number)}
                  style={[styles.seasonButton, selected ? styles.seasonButtonSelected : null]}
                >
                  <Text style={[styles.seasonText, selected ? styles.seasonTextSelected : null]}>
                    시즌 {season.season_number}
                  </Text>
                </Pressable>
              );
            })}
          </HorizontalChoiceRail>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>여기까지 봤어요</Text>
        {totalEpisodes !== null && upperBound <= 200 ? (
          <View accessibilityRole="radiogroup" style={styles.episodeChoicesSection}>
            <Text style={styles.choiceHint}>회차 빠른 선택</Text>
            <HorizontalChoiceRail
              contentContainerStyle={styles.episodeChoices}
              disabled={disabled}
              itemStride={60}
              nextLabel="다음 회차 보기"
              previousLabel="이전 회차 보기"
              selectedIndex={Math.max(0, draftEpisodeNumber - 1)}
            >
              {Array.from({ length: upperBound }, (_, index) => index + 1).map((episodeNumber) => {
                const selected = episodeNumber === draftEpisodeNumber;
                return (
                  <Pressable
                    key={episodeNumber}
                    accessibilityLabel={`${episodeNumber}화까지 봄`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => changeDraft(episodeNumber)}
                    style={[styles.episodeChoice, selected ? styles.episodeChoiceSelected : null]}
                  >
                    <Text style={[styles.episodeChoiceText, selected ? styles.episodeChoiceTextSelected : null]}>
                      {episodeNumber}화
                    </Text>
                  </Pressable>
                );
              })}
            </HorizontalChoiceRail>
          </View>
        ) : null}
        <View style={styles.stepper}>
          <Pressable
            accessibilityLabel="시청 회차 1 줄이기"
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || draftEpisodeNumber <= 0 }}
            disabled={disabled || draftEpisodeNumber <= 0}
            hitSlop={4}
            onPress={() => changeDraft(draftEpisodeNumber - 1)}
            style={styles.stepButton}
          >
            <Ionicons color={colors.text} name="remove" size={20} />
          </Pressable>
          <TextInput
            accessibilityHint="숫자만 입력합니다. 0은 아직 보지 않음을 뜻합니다."
            accessibilityLabel="여기까지 본 회차 입력"
            editable={!disabled}
            keyboardType="number-pad"
            onChangeText={(value) => {
              const digits = value.replace(/\D/g, "");
              if (!digits) {
                setRawEpisodeNumber("");
              } else {
                setRawEpisodeNumber(String(Math.min(upperBound, Number(digits))));
              }
              setError(null);
            }}
            selectTextOnFocus
            style={styles.input}
            value={rawEpisodeNumber}
          />
          <Text style={styles.unit}>화</Text>
          <Pressable
            accessibilityLabel="시청 회차 1 늘리기"
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || draftEpisodeNumber >= upperBound }}
            disabled={disabled || draftEpisodeNumber >= upperBound}
            hitSlop={4}
            onPress={() => changeDraft(draftEpisodeNumber + 1)}
            style={styles.stepButton}
          >
            <Ionicons color={colors.text} name="add" size={20} />
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.next}>
        {draftProgress.isComplete
          ? "모든 화 시청 완료"
          : `다음에 볼 화 · ${draftProgress.nextEpisodeNumber ?? 1}화`}
      </Text>

      <View style={styles.quickActions}>
        <Pressable disabled={disabled} onPress={() => changeDraft(0)} style={styles.quickButton}>
          <Text style={styles.quickText}>아직 안 봄</Text>
        </Pressable>
        {totalEpisodes !== null ? (
          <Pressable disabled={disabled} onPress={() => changeDraft(upperBound)} style={styles.quickButton}>
            <Text style={styles.quickText}>전부 봤음</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityState={{ disabled: disabled || item.progress_source !== "manual" }}
          disabled={disabled || item.progress_source !== "manual"}
          onPress={reset}
          style={styles.quickButton}
        >
          <Text style={styles.quickText}>되돌리기</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saveDisabled }}
        disabled={saveDisabled}
        onPress={save}
        style={[styles.saveButton, saveDisabled ? styles.buttonDisabled : null]}
      >
        <Text style={styles.saveText}>{isSaving ? "저장 중" : "저장"}</Text>
      </Pressable>

      {isUnavailable ? (
        <Text style={styles.notice}>서버 업데이트 후 사용할 수 있습니다</Text>
      ) : null}
      {isOffline ? <Text style={styles.notice}>오프라인에서는 저장할 수 없습니다</Text> : null}
      {derivedDiffers ? (
        <Text style={styles.notice}>
          에피소드 체크로는 {item.derived_watched_through}화까지 기록되어 있습니다
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onOpenEpisodes}
        style={styles.episodesButton}
      >
        <Text style={styles.episodesText}>에피소드를 하나씩 체크하려면 · 에피소드 보기</Text>
        <Ionicons color={colors.primary} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

function HorizontalChoiceRail({
  children,
  contentContainerStyle,
  disabled,
  itemStride,
  nextLabel,
  previousLabel,
  selectedIndex,
}: {
  children: ReactNode;
  contentContainerStyle: StyleProp<ViewStyle>;
  disabled: boolean;
  itemStride: number;
  nextLabel: string;
  previousLabel: string;
  selectedIndex: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const nextOffset = Math.max(0, selectedIndex * itemStride - itemStride);
      offsetRef.current = nextOffset;
      scrollRef.current?.scrollTo({ x: nextOffset, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [itemStride, selectedIndex]);

  const scrollBy = (direction: -1 | 1) => {
    const nextOffset = Math.max(0, offsetRef.current + direction * itemStride * 4);
    offsetRef.current = nextOffset;
    scrollRef.current?.scrollTo({ x: nextOffset, animated: true });
  };

  return (
    <View style={styles.choiceRail}>
      <Pressable
        accessibilityLabel={previousLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => scrollBy(-1)}
        style={styles.choiceRailButton}
      >
        <Ionicons color={colors.textMuted} name="chevron-back" size={20} />
      </Pressable>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={contentContainerStyle}
        directionalLockEnabled
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onScroll={(event) => {
          offsetRef.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEnabled={!disabled}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator
        style={styles.choiceRailScroll}
      >
        {children}
      </ScrollView>
      <Pressable
        accessibilityLabel={nextLabel}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => scrollBy(1)}
        style={styles.choiceRailButton}
      >
        <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
      </Pressable>
    </View>
  );
}

function getInitialDraft(item: LibraryListItem, hasSeasonSelector: boolean) {
  if (item.manual_watched_episode_number !== null) {
    return {
      seasonNumber: hasSeasonSelector ? item.manual_watched_season_number : null,
      episodeNumber: item.manual_watched_episode_number,
    };
  }

  if (item.progress_source === "episode_progress") {
    const relative = toSeasonRelativeEpisodeNumber(
      item.effective_watched_through,
      item.season_episode_counts,
    );
    return {
      seasonNumber: hasSeasonSelector ? relative.seasonNumber : null,
      episodeNumber: relative.episodeNumber,
    };
  }

  return {
    seasonNumber: hasSeasonSelector ? (item.season_episode_counts[0]?.season_number ?? null) : null,
    episodeNumber: 0,
  };
}

function getErrorMessage(reason: string): string {
  switch (reason) {
    case "empty": return "회차를 입력해 주세요";
    case "not_a_number": return "숫자로 입력해 주세요";
    case "negative": return "0 이상의 회차를 입력해 주세요";
    case "exceeds_season_total": return "선택한 시즌의 총 화수 이하로 입력해 주세요";
    default: return "회차는 9999 이하로 입력해 주세요";
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  cardHighlighted: { borderColor: colors.primary, borderWidth: 2 },
  disabled: { opacity: 0.55 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  headerMeta: { alignItems: "flex-end", gap: spacing.xs },
  summary: { color: colors.text, fontSize: 14, fontWeight: "800" },
  mode: { color: colors.textMuted, fontSize: 12 },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 8, overflow: "hidden" },
  progressFill: { backgroundColor: colors.primary, height: "100%" },
  section: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  episodeChoicesSection: { gap: spacing.xs },
  choiceHint: { color: colors.textMuted, fontSize: 12 },
  choiceRail: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    width: "100%",
  },
  choiceRailButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  choiceRailScroll: {
    flex: 1,
    maxWidth: "100%",
    minWidth: 0,
  },
  episodeChoices: { gap: spacing.sm },
  episodeChoice: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: spacing.sm,
  },
  episodeChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  episodeChoiceText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  episodeChoiceTextSelected: { color: colors.surface },
  seasons: { gap: spacing.sm },
  seasonButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  seasonButtonSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  seasonText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  seasonTextSelected: { color: colors.primary },
  stepper: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  stepButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  input: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    height: 44,
    minWidth: 88,
    paddingHorizontal: spacing.sm,
    textAlign: "center",
  },
  unit: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 12 },
  next: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  quickText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: { backgroundColor: colors.border },
  saveText: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  notice: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  episodesButton: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  episodesText: { color: colors.primary, flex: 1, fontSize: 13, fontWeight: "700" },
});
