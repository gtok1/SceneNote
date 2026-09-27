import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PosterTile } from "@/components/home/PosterTile";
import { colors, radius, typography } from "@/constants/theme";
import { useAiringAvailability } from "@/hooks/useAiringAvailability";
import type { LibraryListItem } from "@/types/library";
import { createContinueTileModel } from "@/utils/continueTile";

interface ContinueWatchingTileProps {
  item: LibraryListItem;
  width: number;
  onPress: () => void;
  onOpenEpisodes: () => void;
  onOpenProgressSetting: () => void;
}

const ctaIcons = { play: "play", flag: "flag-outline", check: "checkmark" } as const;

export const ContinueWatchingTile = memo(function ContinueWatchingTile({
  item,
  width,
  onPress,
  onOpenEpisodes,
  onOpenProgressSetting
}: ContinueWatchingTileProps) {
  const airing = useAiringAvailability(item);
  const model = createContinueTileModel(item, airing);

  return (
    <PosterTile
      accessibilityLabel={`${model.title} 상세 보기`}
      badge={model.badge}
      caption={model.caption}
      footer={
        model.cta ? (
          <Pressable
            accessibilityLabel={`${model.title} ${model.cta.accessibilityLabel}`}
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={model.cta.action === "open_progress_setting" ? onOpenProgressSetting : onOpenEpisodes}
            style={styles.ctaTouchTarget}
          >
            <View style={styles.ctaPill}>
              <Ionicons color={colors.primary} name={ctaIcons[model.cta.icon]} size={13} />
              <Text numberOfLines={1} style={styles.ctaText}>
                {model.cta.text}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.ctaTouchTarget}>
            <View style={styles.emptyCta} />
          </View>
        )
      }
      onPress={onPress}
      posterUrl={item.poster_url}
      progress={model.progress}
      title={model.title}
      width={width}
    />
  );
});

const styles = StyleSheet.create({
  // The pill stays 32pt; the parent supplies real 44pt bounds on web and native.
  ctaTouchTarget: {
    height: 44,
    justifyContent: "center",
    minWidth: 44
  },
  ctaPill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 4,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 4
  },
  ctaText: {
    ...typography.label,
    color: colors.primary,
    flexShrink: 1
  },
  emptyCta: {
    height: 32
  }
});
