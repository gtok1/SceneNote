import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useAtom } from "jotai";

import { revealedSpoilerPinIdsAtom } from "@/atoms/spoilerAtom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { PinDetailPanel } from "@/components/pins/PinDetailPanel";
import { PinFilterChip, PinFilterPanel } from "@/components/pins/PinFilterPanel";
import { PinListCard } from "@/components/pins/PinListCard";
import { PinShareCard } from "@/components/pins/PinShareCard";
import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useTags } from "@/hooks/useTags";
import { useAllPins, usePinsByTag } from "@/hooks/useTimelinePins";
import type { EmotionType, PinSortMode, TimelinePin } from "@/types/pins";
import { ALL_GENRE_FILTER } from "@/utils/genre";
import { HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";
import {
  createEmotionFilterOptions, createPinGenreOptions, filterPins, getPinCardPressAction,
  getPinFilterSummary, getPinsLayout, PIN_SORT_OPTIONS, PINS_SCREEN_COPY, pinResultSummary
} from "@/utils/pinListUi";
import { sharePinCardImage } from "@/utils/pinShare";
import { sortPins } from "@/utils/pinSort";

export default function PinsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = getPinsLayout(width);
  const [sortMode, setSortMode] = useState<PinSortMode>("latest");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const facetPins = useMemo(
    () => filterPins(activePins ?? [], { query: searchQuery, emotion: "all", genre: genreFilter }),
    [activePins, searchQuery, genreFilter]
  );
  const filteredPins = useMemo(
    () => filterPins(activePins ?? [], { query: searchQuery, emotion: selectedEmotion, genre: genreFilter }),
    [activePins, searchQuery, selectedEmotion, genreFilter]
  );
  const sortedPins = useMemo(() => sortPins(filteredPins, sortMode), [filteredPins, sortMode]);
  const emotionOptions = useMemo(() => createEmotionFilterOptions(facetPins, selectedEmotion), [facetPins, selectedEmotion]);
  const genreOptions = useMemo(() => createPinGenreOptions(activePins ?? [], genreFilter), [activePins, genreFilter]);
  const filterSummary = useMemo(
    () => getPinFilterSummary({ query: searchQuery, emotion: selectedEmotion, genre: genreFilter, tagId: selectedTagId }),
    [searchQuery, selectedEmotion, genreFilter, selectedTagId]
  );
  const pressAction = getPinCardPressAction(layout.showDetailPanel);

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
  const onPressPin = useCallback((id: string) => {
    if (pressAction === "open") router.push({ pathname: "/pins/[id]", params: { id } });
    else setSelectedPinId(id);
  }, [pressAction, router]);
  const resetPanelFilters = useCallback(() => {
    setGenreFilter(ALL_GENRE_FILTER);
    setSelectedTagId(null);
  }, []);
  const showAll = useCallback(() => {
    setSearchQuery("");
    setSelectedEmotion("all");
    resetPanelFilters();
  }, [resetPanelFilters]);
  const retry = () => { void (selectedTagId ? taggedPins.refetch() : allPins.refetch()); };
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


  const filterButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={filterSummary.buttonAccessibilityLabel}
      accessibilityState={{ expanded: filtersOpen }}
      onPress={() => setFiltersOpen((open) => !open)}
      style={({ pressed }) => [
        styles.filterButton, (filtersOpen || filterSummary.panelCount > 0) && styles.filterActive,
        pressed && styles.pressed
      ]}
    >
      <Ionicons accessible={false} color={filtersOpen || filterSummary.panelCount > 0 ? colors.primary : colors.textMuted} name="options-outline" size={18} />
      <Text style={[styles.filterText, (filtersOpen || filterSummary.panelCount > 0) && styles.activeText]}>{filterSummary.buttonLabel}</Text>
    </Pressable>
  );
  const sortControl = (
    <SegmentedControl
      accessibilityLabel={PINS_SCREEN_COPY.sortLabel}
      options={PIN_SORT_OPTIONS}
      value={sortMode}
      onChange={setSortMode}
      stretch={layout.stackTools}
    />
  );
  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>{PINS_SCREEN_COPY.title}</Text>
        <Text style={styles.subtitle}>{PINS_SCREEN_COPY.subtitle}</Text>
      </View>
      <View style={[styles.tools, layout.stackTools && styles.stackTools]}>
        <View style={[styles.searchBox, !layout.stackTools && styles.searchFlex]}>
          <Ionicons accessible={false} color={colors.textMuted} name="search" size={18} />
          <TextInput
            accessibilityLabel={PINS_SCREEN_COPY.searchLabel}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            onSubmitEditing={Keyboard.dismiss}
            placeholder={PINS_SCREEN_COPY.searchPlaceholder}
            placeholderTextColor={colors.textSubtle}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable accessibilityRole="button" accessibilityLabel={PINS_SCREEN_COPY.clearSearch} hitSlop={13}
              onPress={() => setSearchQuery("")} style={({ pressed }) => pressed && styles.pressed}>
              <Ionicons accessible={false} color={colors.textMuted} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
        {layout.stackTools ? (
          <View style={styles.secondaryTools}>
            <View style={styles.sortFlex}>{sortControl}</View>
            {filterButton}
          </View>
        ) : <>{sortControl}{filterButton}</>}
      </View>
      {filtersOpen ? (
        <PinFilterPanel
          genreOptions={genreOptions} selectedGenre={genreFilter} onSelectGenre={setGenreFilter}
          tags={tags.data ?? []} selectedTagId={selectedTagId} onSelectTag={setSelectedTagId}
          showReset={filterSummary.panelCount > 0} onReset={resetPanelFilters}
        />
      ) : null}
      <View accessibilityLabel={PINS_SCREEN_COPY.emotionGroupLabel} style={styles.chips}>
        {emotionOptions.map((option) => (
          <PinFilterChip key={option.value} label={option.text} accessibilityLabel={option.accessibilityLabel}
            selected={selectedEmotion === option.value}
            onPress={() => setSelectedEmotion(selectedEmotion === option.value ? "all" : option.value)} />
        ))}
      </View>
      <View style={styles.results}>
        <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
          {pinResultSummary({ shown: sortedPins.length, total: allPins.data?.length ?? 0, filtered: filterSummary.hasActive })}
        </Text>
        {filterSummary.hasActive ? (
          <Pressable accessibilityRole="button" onPress={showAll} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.textButtonLabel}>{PINS_SCREEN_COPY.showAll}</Text>
          </Pressable>
        ) : null}
      </View>
      {isError && sortedPins.length > 0 ? (
        <View style={styles.noticeRow}>
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{PINS_SCREEN_COPY.partialError}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.textButtonLabel}>{PINS_SCREEN_COPY.retry}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}
      style={[styles.shell, { paddingTop: insets.top }]}>
      <View style={[styles.page, { paddingHorizontal: layout.gutter }]}>
        <View style={[styles.contentGrid, { gap: layout.gap }]}>
          <View style={styles.mainColumn}>
            <FlashList
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  {isLoading ? (
                    <View style={styles.sharedInset}>
                      <LoadingSkeleton variant="pin-item" count={5} />
                    </View>
                  ) : isError ? (
                    <ErrorState onRetry={retry} />
                  ) : filterSummary.hasActive ? (
                    <EmptyState title={PINS_SCREEN_COPY.noResultTitle} description={PINS_SCREEN_COPY.noResultDescription}
                      actionLabel={PINS_SCREEN_COPY.showAll} onAction={showAll} />
                  ) : (
                    <EmptyState title={PINS_SCREEN_COPY.emptyTitle} description={PINS_SCREEN_COPY.emptyDescription}
                      actionLabel={PINS_SCREEN_COPY.emptyAction} onAction={() => router.push("/library")} />
                  )}
                </View>
              }
              ListHeaderComponent={listHeader}
              ItemSeparatorComponent={() => <View style={styles.pinSeparator} />}
              contentContainerStyle={styles.pinFlashContent}
              data={sortedPins}
              drawDistance={520}
              extraData={{
                selectedId: selectedPin?.id ?? null, revealedSpoilers, pressAction, posterWidth: layout.posterWidth
              }}
              keyExtractor={(pin) => pin.id}
              renderItem={({ item: pin }) => (
                <PinListCard
                  pin={pin} selected={selectedPin?.id === pin.id} spoilerRevealed={revealedSpoilers.has(pin.id)}
                  pressAction={pressAction} posterWidth={layout.posterWidth} padding={layout.cardPadding} onPressPin={onPressPin}
                />
              )}
              style={styles.pinFlashList}
            />
          </View>
          {layout.showDetailPanel ? (
            <PinDetailPanel
              width={layout.detailPanelWidth}
              spoilerRevealed={selectedPin ? revealedSpoilers.has(selectedPin.id) : false}
              canShare={EXTENDED_FEATURES_ENABLED && Platform.OS !== "web"}
              onOpenDetail={() => selectedPin && router.push({ pathname: "/pins/[id]", params: { id: selectedPin.id } })}
              onRevealSpoiler={() => selectedPin && revealSpoiler(selectedPin)}
              onShare={() => selectedPin && sharePin(selectedPin)}
              pin={selectedPin}
            />
          ) : null}
        </View>
      </View>
      {EXTENDED_FEATURES_ENABLED && selectedPin ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none" style={styles.captureLayer}>
          <PinShareCard maskMemo={selectedPin.is_spoiler && !revealedSpoilers.has(selectedPin.id)} pin={selectedPin} ref={plainShareRef} />
          <PinShareCard maskMemo pin={selectedPin} ref={maskedShareRef} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: colors.background, flex: 1 },
  page: {
    alignSelf: "center", flex: 1, maxWidth: HOME_CONTENT_MAX_WIDTH, paddingTop: spacing.md, width: "100%"
  },
  contentGrid: { alignSelf: "center", flex: 1, flexDirection: "row", width: "100%" },
  mainColumn: { flex: 1, minWidth: 0 },
  listHeader: { gap: spacing.md, paddingBottom: spacing.lg },
  headerCopy: { gap: spacing.xs },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  tools: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stackTools: { flexDirection: "column", alignItems: "stretch" },
  secondaryTools: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sortFlex: { flex: 1, minWidth: 0 },
  searchBox: {
    alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, flexDirection: "row",
    gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, minWidth: 0
  },
  searchFlex: { flex: 1 },
  searchInput: { ...typography.body, color: colors.text, flex: 1, minWidth: 0, paddingVertical: spacing.sm },
  filterButton: {
    minHeight: 44, borderRadius: radius.pill, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm
  },
  filterActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { ...typography.label, color: colors.textMuted },
  activeText: { color: colors.primary },
  pressed: { opacity: 0.72 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  results: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  resultCount: { ...typography.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  textButton: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  textButtonLabel: { ...typography.label, color: colors.primary },
  noticeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  notice: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  pinFlashList: { flex: 1 },
  pinFlashContent: { paddingBottom: spacing.xxl },
  listEmpty: { paddingTop: spacing.md },
  sharedInset: { marginHorizontal: -spacing.lg },
  pinSeparator: { height: spacing.md },
  captureLayer: {
    left: -1200,
    opacity: 0,
    position: "absolute",
    top: 0
  }
});
