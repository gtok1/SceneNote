import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

interface RatingInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
}

export function RatingInput({ value, onChange, max = 10 }: RatingInputProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, index) => {
        const rating = index + 1;
        const selected = value === rating;
        return (
          <Pressable
            accessibilityRole="button"
            key={rating}
            onPress={() => onChange(selected ? null : rating)}
            style={[styles.item, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.selectedText]}>{rating}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  item: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 32,
    justifyContent: "center",
    width: 32
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
  }
});
