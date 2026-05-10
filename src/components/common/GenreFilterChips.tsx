import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import { ALL_GENRE_FILTER, createGenreFilterOptions } from "@/utils/genre";

interface GenreFilterChipsProps {
  value: string;
  onChange: (value: string) => void;
  genres?: string[] | null | undefined;
  label?: string;
}

export function GenreFilterChips({
  value,
  onChange,
  genres,
  label = "장르"
}: GenreFilterChipsProps) {
  const options = createGenreFilterOptions(genres);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
      >
        <GenreChip label="전체" selected={value === ALL_GENRE_FILTER} onPress={() => onChange(ALL_GENRE_FILTER)} />
        {options.map((genre) => (
          <GenreChip
            key={genre}
            label={genre}
            selected={value === genre}
            onPress={() => onChange(genre)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function GenreChip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  options: {
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  chipTextSelected: {
    color: colors.surface
  }
});
