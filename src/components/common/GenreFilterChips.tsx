import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import { ALL_GENRE_FILTER, createGenreFilterOptions } from "@/utils/genre";
import { parseGenreFilters, serializeGenreFilters } from "@/utils/libraryFilters";

interface GenreFilterChipsProps {
  value: string;
  onChange: (value: string) => void;
  genres?: string[] | null | undefined;
  label?: string;
  multiple?: boolean;
}

export function GenreFilterChips({
  value,
  onChange,
  genres,
  label = "장르",
  multiple = false
}: GenreFilterChipsProps) {
  const options = createGenreFilterOptions(genres);
  const selectedGenres = multiple ? parseGenreFilters(value) : value === ALL_GENRE_FILTER ? [] : [value];
  const changeGenre = (genre: string) => {
    if (!multiple) {
      onChange(genre);
      return;
    }
    const nextGenres = selectedGenres.includes(genre)
      ? selectedGenres.filter((item) => item !== genre)
      : [...selectedGenres, genre];
    onChange(serializeGenreFilters(nextGenres));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.options}
        style={styles.scroller}
      >
        <GenreChip label="전체" selected={!selectedGenres.length} onPress={() => onChange(ALL_GENRE_FILTER)} />
        {options.map((genre) => (
          <GenreChip
            key={genre}
            label={genre}
            selected={selectedGenres.includes(genre)}
            onPress={() => changeGenre(genre)}
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
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  scroller: {
    flexGrow: 0,
    minHeight: 44
  },
  chip: {
    minHeight: 44,
    minWidth: 44,
    alignSelf: "flex-start",
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
