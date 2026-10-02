import { StyleSheet, Text, View } from "react-native";

import { AppImage } from "@/components/common/AppImage";
import { colors, typography } from "@/constants/theme";
import { personInitial } from "@/utils/peopleScreen";

interface PersonAvatarProps {
  name: string;
  profileUrl: string | null;
  size: number;
}

export function PersonAvatar({ name, profileUrl, size }: PersonAvatarProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { borderRadius: size / 2, height: size, width: size }]}
    >
      {profileUrl ? (
        <AppImage contentFit="cover" source={{ uri: profileUrl }} style={{ height: size, width: size }} />
      ) : (
        <Text style={styles.initial}>{personInitial(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden"
  },
  initial: {
    ...typography.headline,
    color: colors.textMuted
  }
});
