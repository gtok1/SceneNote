import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import type { Season } from "@/types/content";

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
}

export function SeasonSelector({ seasons, selectedSeasonId, onSelect }: SeasonSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const selectedIndex = Math.max(
    0,
    seasons.findIndex((season) => season.id === selectedSeasonId)
  );
  const selectedSeason = seasons[selectedIndex] ?? seasons[0];
  const compact = seasons.length > 8;
  const label = selectedSeason ? createSeasonLabel(selectedSeason) : "시즌 선택";
  const visibleSeasons = useMemo(
    () => (compact && !expanded ? [] : seasons),
    [compact, expanded, seasons]
  );

  if (seasons.length <= 1) return null;

  const selectSeason = (seasonId: string) => {
    onSelect(seasonId);
    if (compact) setExpanded(false);
  };

  const selectOffset = (offset: number) => {
    const nextSeason = seasons[selectedIndex + offset];
    if (nextSeason) onSelect(nextSeason.id);
  };

  return (
    <View style={styles.wrapper}>
      {compact ? (
        <View style={styles.compactRow}>
          <Pressable
            accessibilityRole="button"
            disabled={selectedIndex <= 0}
            onPress={() => selectOffset(-1)}
            style={[styles.navButton, selectedIndex <= 0 ? styles.disabled : null]}
          >
            <Text style={styles.navText}>이전</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            style={styles.currentButton}
          >
            <Text style={styles.currentText}>{label}</Text>
            <Text style={styles.countText}>{selectedIndex + 1}/{seasons.length}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={selectedIndex >= seasons.length - 1}
            onPress={() => selectOffset(1)}
            style={[styles.navButton, selectedIndex >= seasons.length - 1 ? styles.disabled : null]}
          >
            <Text style={styles.navText}>다음</Text>
          </Pressable>
        </View>
      ) : null}

      {visibleSeasons.length ? (
        <View style={styles.container}>
          {visibleSeasons.map((season) => {
            const selected = season.id === selectedSeasonId;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={season.id}
                onPress={() => selectSeason(season.id)}
                style={[styles.item, selected && styles.selected]}
              >
                <Text style={[styles.text, selected && styles.selectedText]}>
                  {createSeasonLabel(season)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function createSeasonLabel(season: Season): string {
  return season.title?.trim() || `시즌 ${season.season_number}`;
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    maxHeight: 116,
    overflow: "hidden"
  },
  compactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  navText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  currentButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  currentText: {
    color: colors.surface,
    flexShrink: 1,
    fontWeight: "900"
  },
  countText: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: "900"
  },
  item: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    minWidth: 72
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  text: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  selectedText: {
    color: colors.surface
  },
  disabled: {
    opacity: 0.4
  }
});
