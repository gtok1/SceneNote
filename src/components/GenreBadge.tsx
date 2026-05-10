import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import { createDisplayGenreNames } from "@/utils/genre";

interface GenreBadgeProps {
  name: string;
}

interface GenreBadgeListProps {
  genres?: string[] | null | undefined;
  maxVisible?: number | undefined;
}

export function GenreBadge({ name }: GenreBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text numberOfLines={1} style={styles.text}>
        {name}
      </Text>
    </View>
  );
}

export function GenreBadgeList({ genres, maxVisible = 2 }: GenreBadgeListProps) {
  if (!genres?.length) return null;

  const displayGenres = createDisplayGenreNames(genres);
  if (displayGenres.length === 0) return null;

  const visibleGenres = displayGenres.slice(0, maxVisible);
  const restCount = displayGenres.length - visibleGenres.length;

  return (
    <View style={styles.list}>
      {visibleGenres.map((genre) => (
        <GenreBadge key={genre} name={genre} />
      ))}
      {restCount > 0 ? <Text style={styles.rest}>외 {restCount}개</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  text: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  rest: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  }
});
