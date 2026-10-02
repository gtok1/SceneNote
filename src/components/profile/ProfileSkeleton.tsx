import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import type { ProfileLayout } from "@/utils/profileDashboard";

export function ProfileSkeleton({ layout }: { layout: ProfileLayout }) {
  return (
    <View
      accessibilityLabel="프로필 통계를 불러오는 중입니다"
      accessibilityState={{ busy: true }}
      accessible
      style={{ gap: layout.gap }}
    >
      <View style={[styles.grid, { gap: layout.gap }]}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.block, { height: 112, width: layout.metricWidth }]} />
        ))}
      </View>
      <View style={[styles.grid, { gap: layout.gap }]}>
        {[0, 1].map((index) => (
          <View key={index} style={[styles.block, { height: 220, width: layout.panelWidth }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  block: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg
  }
});
