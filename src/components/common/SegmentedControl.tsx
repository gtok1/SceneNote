import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, elevation, radius, spacing, typography } from "@/constants/theme";

interface SegmentedControlProps<T extends string> {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  stretch?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  stretch = false
}: SegmentedControlProps<T>) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.item, stretch && styles.stretch, selected && styles.itemSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: "row",
    height: 44,
    padding: 4
  },
  item: {
    alignItems: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 64,
    paddingHorizontal: spacing.lg
  },
  stretch: {
    flex: 1
  },
  itemSelected: {
    backgroundColor: colors.surface,
    ...elevation.card
  },
  text: {
    ...typography.label,
    color: colors.textMuted
  },
  textSelected: {
    color: colors.text
  }
});
