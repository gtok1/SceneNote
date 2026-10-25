import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius } from "@/constants/theme";
import type { PinViewMode } from "@/types/pins";
import { PIN_VIEW_COPY, PIN_VIEW_OPTIONS } from "@/utils/pinListUi";

interface PinViewToggleProps {
  value: PinViewMode;
  onChange: (value: PinViewMode) => void;
}

export function PinViewToggle({ value, onChange }: PinViewToggleProps) {
  return (
    <View accessibilityLabel={PIN_VIEW_COPY.toggleLabel} style={styles.group}>
      {PIN_VIEW_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.button, selected && styles.selected, pressed && styles.pressed]}
          >
            <Ionicons accessible={false} color={selected ? colors.surface : colors.textMuted} name={option.icon} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row", borderRadius: radius.pill, borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth, backgroundColor: colors.surface
  },
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  selected: { backgroundColor: colors.primary },
  pressed: { opacity: 0.72 }
});
