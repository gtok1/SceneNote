import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FlashList } from "@shopify/flash-list";

import { colors, radius, spacing } from "@/constants/theme";
import type { Episode } from "@/types/content";
import type { EpisodeProgress } from "@/types/library";

interface EpisodeSelectorProps {
  episodes: Episode[];
  progress: EpisodeProgress[];
  onToggleProgress: (episode: Episode, watched: boolean) => void;
  onOpenPins: (episode: Episode) => void;
  onAddPin: (episode: Episode) => void;
}

export function EpisodeSelector({
  episodes,
  progress,
  onToggleProgress,
  onOpenPins,
  onAddPin
}: EpisodeSelectorProps) {
  const watchedIds = new Set(progress.map((item) => item.episode_id));

  return (
    <FlashList
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      data={episodes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <EpisodeRow
          episode={item}
          watched={watchedIds.has(item.id)}
          onAddPin={() => onAddPin(item)}
          onOpenPins={() => onOpenPins(item)}
          onToggle={() => onToggleProgress(item, watchedIds.has(item.id))}
        />
      )}
    />
  );
}

interface EpisodeRowProps {
  episode: Episode;
  watched: boolean;
  onToggle: () => void;
  onOpenPins: () => void;
  onAddPin: () => void;
}

const EpisodeRow = memo(function EpisodeRow({
  episode,
  watched,
  onToggle,
  onOpenPins,
  onAddPin
}: EpisodeRowProps) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: watched }} onPress={onToggle}>
        <View style={[styles.checkbox, watched && styles.checkboxChecked]}>
          <Text style={styles.checkboxText}>{watched ? "✓" : ""}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onOpenPins} style={styles.info}>
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
    paddingVertical: spacing.sm
  },
  pinText: {
    color: colors.primary,
    fontWeight: "800"
  }
});
