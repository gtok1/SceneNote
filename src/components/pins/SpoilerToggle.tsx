import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

interface SpoilerToggleProps {
  isSpoiler: boolean;
  onToggle: (value: boolean) => void;
}

export function SpoilerToggle({ isSpoiler, onToggle }: SpoilerToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isSpoiler }}
      onPress={() => onToggle(!isSpoiler)}
      style={styles.row}
    >
      <View style={[styles.track, isSpoiler && styles.trackOn]}>
        <View style={[styles.thumb, isSpoiler && styles.thumbOn]} />
      </View>
      <Text style={styles.label}>스포일러 포함</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    padding: 3,
    width: 48
  },
  trackOn: {
    backgroundColor: colors.primary
  },
  thumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 22,
    width: 22
  },
  thumbOn: {
    transform: [{ translateX: 20 }]
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
