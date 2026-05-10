import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

interface PinMarkerProps {
  active?: boolean;
}

export function PinMarker({ active = false }: PinMarkerProps) {
  return <View style={[styles.marker, active && styles.active]} />;
}

const styles = StyleSheet.create({
  marker: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 10,
    width: 10
  },
  active: {
    backgroundColor: colors.primary
  }
});
