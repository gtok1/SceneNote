import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppImage } from "@/components/common/AppImage";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { createPinCardModel, PINS_SCREEN_COPY } from "@/utils/pinListUi";

interface PinListCardProps {
  pin: TimelinePin;
  spoilerRevealed: boolean;
  selected: boolean;
  pressAction: "select" | "open";
  posterWidth: number;
  padding: number;
  onPressPin: (id: string) => void;
}

export const PinListCard = memo(function PinListCard({
  pin, spoilerRevealed, selected, pressAction, posterWidth, padding, onPressPin
}: PinListCardProps) {
  const model = useMemo(() => createPinCardModel(pin, { spoilerRevealed }), [pin, spoilerRevealed]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={model.accessibilityLabel}
      accessibilityHint={pressAction === "select" ? PINS_SCREEN_COPY.selectHint : PINS_SCREEN_COPY.openHint}
      {...(pressAction === "select" ? { accessibilityState: { selected } } : {})}
      onPress={() => onPressPin(pin.id)}
      style={({ pressed }) => [
        styles.card, { padding },
        pressAction === "select" && selected && styles.selected,
        pressed && styles.pressed
      ]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <AppImage
          contentFit="cover"
          source={model.posterUrl ? { uri: model.posterUrl } : null}
          style={[styles.poster, { width: posterWidth, height: posterWidth * 1.5 }]}
        />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>{model.title}</Text>
        {model.subtitle ? <Text numberOfLines={1} style={styles.caption}>{model.subtitle}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.time}>{model.timeLabel}</Text>
          {model.emotionLabel ? <Text style={styles.emotion}>{model.emotionLabel}</Text> : null}
        </View>
        {model.memoHidden ? (
          <View style={styles.maskedMemo}>
            <Ionicons accessible={false} color={colors.textMuted} name="eye-off-outline" size={16} />
            <Text style={[styles.caption, styles.maskedText]}>{model.memo}</Text>
          </View>
        ) : <Text numberOfLines={3} style={model.memoEmpty ? styles.emptyMemo : styles.memo}>{model.memo}</Text>}
        {model.tags.length > 0 ? (
          <View style={styles.tags}>
            {model.tags.map((tag, index) => <Text key={pin.tags?.[index]?.id ?? tag} style={styles.tag}>{tag}</Text>)}
            {model.extraTagCount > 0 ? <Text style={styles.tag}>+{model.extraTagCount}</Text> : null}
          </View>
        ) : null}
      </View>
      {pressAction === "open" ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.chevron}>
          <Ionicons accessible={false} color={colors.textSubtle} name="chevron-forward" size={18} />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg, flexDirection: "row", gap: spacing.md, ...elevation.card
  },
  selected: { borderColor: colors.primary, borderWidth: 1 },
  pressed: { opacity: 0.72 },
  poster: { borderRadius: radius.sm },
  body: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.headline, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  time: {
    ...typography.label, color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, fontVariant: ["tabular-nums"]
  },
  emotion: {
    ...typography.micro, color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3
  },
  maskedMemo: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  maskedText: { flex: 1, minWidth: 0 },
  emptyMemo: { ...typography.caption, color: colors.textSubtle },
  memo: { ...typography.body, color: colors.text },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    ...typography.caption, color: colors.textMuted, backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2
  },
  chevron: { alignSelf: "center" }
});
