import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FlashList } from "@shopify/flash-list";

import { colors, radius, spacing } from "@/constants/theme";
import type { Episode } from "@/types/content";
import type { EpisodeProgress, LibraryListItem } from "@/types/library";

interface EpisodeSelectorProps {
  episodes: Episode[];
  progress: EpisodeProgress[];
  onToggleProgress: (episode: Episode, watched: boolean) => void;
  onOpenPins: (episode: Episode) => void;
  onAddPin: (episode: Episode) => void;
  libraryItem?: LibraryListItem;
  onOpenProgressSetting: () => void;
  onSetManualProgress: (episode: Episode) => void;
}

export function EpisodeSelector({
  episodes,
  progress,
  onToggleProgress,
  onOpenPins,
  onAddPin,
  libraryItem,
  onOpenProgressSetting,
  onSetManualProgress
}: EpisodeSelectorProps) {
  const watchedIds = new Set(progress.map((item) => item.episode_id));
  const progressSummary = libraryItem ? createProgressSummary(libraryItem) : null;

  return (
    <View style={styles.container}>
      {progressSummary ? (
        <View style={styles.progressBanner}>
          <View style={styles.progressCopy}>
            <Text style={styles.progressSummary}>{progressSummary}</Text>
            <Text style={styles.progressHint}>길게 누르면 그 회차까지 봤음으로 설정됩니다</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onOpenProgressSetting} style={styles.progressButton}>
            <Text style={styles.progressButtonText}>진행 위치 설정</Text>
          </Pressable>
        </View>
      ) : null}
      <FlashList
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            watched={watchedIds.has(item.id)}
            onAddPin={() => onAddPin(item)}
            onLongPress={() => onSetManualProgress(item)}
            onOpenPins={() => onOpenPins(item)}
            onToggle={() => onToggleProgress(item, watchedIds.has(item.id))}
          />
        )}
      />
    </View>
  );
}

interface EpisodeRowProps {
  episode: Episode;
  watched: boolean;
  onToggle: () => void;
  onOpenPins: () => void;
  onAddPin: () => void;
  onLongPress: () => void;
}

const EpisodeRow = memo(function EpisodeRow({
  episode,
  watched,
  onToggle,
  onOpenPins,
  onAddPin,
  onLongPress
}: EpisodeRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: watched }}
        onPress={onToggle}
        style={styles.checkboxButton}
      >
        <View style={[styles.checkbox, watched && styles.checkboxChecked]}>
          <Text style={styles.checkboxText}>{watched ? "✓" : ""}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityHint="길게 누르면 이 회차까지 봤음으로 설정합니다"
        accessibilityRole="button"
        onLongPress={onLongPress}
        onPress={onOpenPins}
        style={styles.info}
      >
        <Text style={styles.title}>
          {episode.episode_number}화 {episode.title ?? ""}
        </Text>
        <Text style={styles.meta}>
          {[episode.air_date, episode.duration_seconds ? `${Math.round(episode.duration_seconds / 60)}분` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAddPin} style={styles.pinButton}>
        <Text style={styles.pinText}>핀</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressBanner: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    margin: spacing.lg,
    padding: spacing.md
  },
  progressCopy: { flex: 1, gap: spacing.xs },
  progressSummary: { color: colors.text, fontSize: 14, fontWeight: "800" },
  progressHint: { color: colors.textMuted, fontSize: 11 },
  progressButton: { justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  progressButtonText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  separator: {
    height: spacing.sm
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  checkboxButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkboxText: {
    color: colors.surface,
    fontWeight: "800"
  },
  info: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12
  },
  pinButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing.sm
  },
  pinText: {
    color: colors.primary,
    fontWeight: "800"
  }
});

function createProgressSummary(item: LibraryListItem): string {
  const watched = item.effective_watched_through;
  if (item.episode_count !== null) {
    return item.next_episode_number === null
      ? `${watched}/${item.episode_count}화 시청 · 모든 화 시청`
      : `${watched}/${item.episode_count}화 시청 · 다음 ${item.next_episode_number}화`;
  }
  return `현재 ${watched}화까지 시청 · 다음 ${item.next_episode_number ?? watched + 1}화`;
}
