import { Pressable, StyleSheet, Text, View } from "react-native";

import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { ALL_GENRE_FILTER } from "@/utils/genre";
import { PINS_SCREEN_COPY } from "@/utils/pinListUi";

interface PinFilterChipProps {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
}

export function PinFilterChip({ label, accessibilityLabel, selected, onPress }: PinFilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

interface PinFilterPanelProps {
  genreOptions: string[];
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
  tags: { id: string; name: string }[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  showReset: boolean;
  onReset: () => void;
}

export function PinFilterPanel({
  genreOptions, selectedGenre, onSelectGenre, tags, selectedTagId, onSelectTag, showReset, onReset
}: PinFilterPanelProps) {
  return (
    <DashboardPanel
      title={PINS_SCREEN_COPY.filterPanelTitle}
      accessory={showReset ? (
        <Pressable accessibilityRole="button" onPress={onReset} style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
          <Text style={styles.resetText}>{PINS_SCREEN_COPY.filterPanelReset}</Text>
        </Pressable>
      ) : null}
    >
      {genreOptions.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{PINS_SCREEN_COPY.genreGroup}</Text>
          <View style={styles.chips}>
            <PinFilterChip label={PINS_SCREEN_COPY.allOption} selected={selectedGenre === ALL_GENRE_FILTER} onPress={() => onSelectGenre(ALL_GENRE_FILTER)} />
            {genreOptions.map((genre) => (
              <PinFilterChip key={genre} label={genre} selected={selectedGenre === genre} onPress={() => onSelectGenre(selectedGenre === genre ? ALL_GENRE_FILTER : genre)} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.group}>
        <Text style={styles.groupLabel}>{PINS_SCREEN_COPY.tagGroup}</Text>
        {tags.length ? (
          <View style={styles.chips}>
            <PinFilterChip label={PINS_SCREEN_COPY.allOption} selected={selectedTagId === null} onPress={() => onSelectTag(null)} />
            {tags.map((tag) => (
              <PinFilterChip key={tag.id} label={`#${tag.name}`} selected={selectedTagId === tag.id} onPress={() => onSelectTag(selectedTagId === tag.id ? null : tag.id)} />
            ))}
          </View>
        ) : <Text style={styles.groupLabel}>{PINS_SCREEN_COPY.noTags}</Text>}
      </View>
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36, minWidth: 44, maxWidth: "100%", justifyContent: "center", paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.label, color: colors.textMuted },
  chipTextSelected: { color: colors.surface },
  pressed: { opacity: 0.72 },
  reset: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  resetText: { ...typography.label, color: colors.primary },
  group: { gap: spacing.sm },
  groupLabel: { ...typography.caption, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }
});
