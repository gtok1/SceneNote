import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppImage } from "@/components/common/AppImage";
import { colors, elevation, radius, typography } from "@/constants/theme";

interface PosterTileProps {
  title: string;
  posterUrl: string | null;
  width: number;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: { tone: "new" | "upcoming" | "today"; text: string } | null;
  progress?: number | null;
  caption?: string | null;
  footer?: ReactNode;
}

export const PosterTile = memo(function PosterTile({
  title,
  posterUrl,
  width,
  onPress,
  accessibilityLabel,
  badge,
  progress,
  caption,
  footer
}: PosterTileProps) {
  return (
    <View style={{ width }}>
      <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress}>
        <View style={styles.poster}>
          <AppImage
            contentFit="cover"
            source={posterUrl ? { uri: posterUrl } : null}
            style={[StyleSheet.absoluteFill, styles.posterImage]}
          />
          {badge ? (
            <Text
              numberOfLines={1}
              style={[styles.badge, badgeStyles[badge.tone]]}
            >
              {badge.text}
            </Text>
          ) : null}
          {progress != null ? (
            <View
              accessibilityElementsHidden
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }
                ]}
              />
            </View>
          ) : null}
        </View>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.caption}>
          {caption ?? ""}
        </Text>
      </Pressable>
      {footer != null ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  poster: {
    ...elevation.card,
    aspectRatio: 2 / 3,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: "hidden",
    width: "100%"
  },
  posterImage: {
    height: "100%",
    width: "100%"
  },
  badge: {
    ...typography.micro,
    borderRadius: radius.pill,
    left: 6,
    maxWidth: "90%",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
    top: 6
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.35)",
    bottom: 0,
    height: 4,
    left: 0,
    position: "absolute",
    right: 0
  },
  progressFill: {
    backgroundColor: "#FFFFFF",
    height: "100%"
  },
  title: {
    ...typography.label,
    color: colors.text,
    height: 36,
    marginTop: 8
  },
  caption: {
    ...typography.caption,
    color: colors.textSubtle,
    height: 16
  },
  footer: {
    marginTop: 8
  }
});

const badgeStyles = StyleSheet.create({
  new: { backgroundColor: colors.successSoft, color: colors.success },
  upcoming: { backgroundColor: "rgba(255,255,255,0.92)", color: colors.text },
  today: { backgroundColor: colors.primary, color: colors.surface }
});
