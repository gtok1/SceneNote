import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppImage } from "@/components/common/AppImage";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import {
  createPinGalleryCardModel, PIN_GALLERY_MEMO_LINES, PIN_SCENE_MEMO_LINES, PINS_SCREEN_COPY,
  type PinGalleryCardModel
} from "@/utils/pinListUi";

interface PinGalleryCardProps {
  pin: TimelinePin;
  spoilerRevealed: boolean;
  variant: "poster" | "scene";
  onPressPin: (id: string) => void;
}

export const PinGalleryCard = memo(function PinGalleryCard({ pin, spoilerRevealed, variant, onPressPin }: PinGalleryCardProps) {
  const { fontScale } = useWindowDimensions();
  const model = useMemo(() => createPinGalleryCardModel(pin, { spoilerRevealed }), [pin, spoilerRevealed]);
  const poster = variant === "poster";
  const memoLines = poster ? PIN_GALLERY_MEMO_LINES : PIN_SCENE_MEMO_LINES;
  return (
    <View style={styles.cell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={model.accessibilityLabel}
        accessibilityHint={PINS_SCREEN_COPY.openHint}
        onPress={() => onPressPin(pin.id)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {poster ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <AppImage contentFit="cover" source={model.posterUrl ? { uri: model.posterUrl } : null} style={styles.poster} />
            <View style={styles.posterChips}><SceneChips model={model} /></View>
          </View>
        ) : null}
        <View style={[styles.body, !poster && styles.sceneBody]}>
          {poster ? (
            <Text numberOfLines={1} style={[styles.title, { minHeight: typography.label.lineHeight * fontScale }]}>{model.title}</Text>
          ) : null}
          <Text numberOfLines={1} style={[
            poster ? styles.sceneLabel : styles.sceneTitle,
            { minHeight: (poster ? typography.micro.lineHeight : typography.label.lineHeight) * fontScale }
          ]}>
            {model.sceneLabel}
          </Text>
          {poster ? null : (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.chips}>
              <SceneChips model={model} />
            </View>
          )}
          <View style={{ minHeight: typography.caption.lineHeight * memoLines * fontScale }}>
            {model.memoHidden ? (
              <View style={styles.maskedMemo}>
                <Ionicons accessible={false} color={colors.textMuted} name="eye-off-outline" size={16} />
                <Text numberOfLines={memoLines} style={[styles.memo, styles.maskedText]}>{model.memo}</Text>
              </View>
            ) : (
              <Text numberOfLines={memoLines} style={[styles.memo, model.memoEmpty && styles.emptyMemo]}>{model.memo}</Text>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.date, { minHeight: typography.micro.lineHeight * fontScale }]}>
            {model.relativeDateLabel}
          </Text>
        </View>
      </Pressable>
    </View>
  );
});

function SceneChips({ model }: { model: PinGalleryCardModel }) {
  return (
    <>
      <Text style={styles.time}>{model.timeLabel}</Text>
      {model.emotionLabel ? <Text style={styles.emotion}>{model.emotionLabel}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignSelf: "stretch", minWidth: 0, padding: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, flexGrow: 1
  },
  pressed: { opacity: 0.72 },
  poster: {
    aspectRatio: 2 / 3, width: "100%", backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg
  },
  posterChips: {
    position: "absolute", left: spacing.sm, right: spacing.sm, bottom: spacing.sm,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs
  },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  body: { padding: spacing.sm, gap: spacing.xs, minWidth: 0 },
  sceneBody: { padding: spacing.md },
  title: { ...typography.label, color: colors.text },
  sceneLabel: { ...typography.micro, color: colors.textMuted },
  sceneTitle: { ...typography.label, color: colors.text },
  time: {
    ...typography.label, color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, fontVariant: ["tabular-nums"]
  },
  emotion: {
    ...typography.micro, color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3
  },
  maskedMemo: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  maskedText: { flex: 1, minWidth: 0, color: colors.textMuted },
  memo: { ...typography.caption, color: colors.text },
  emptyMemo: { color: colors.textSubtle },
  date: { ...typography.micro, color: colors.textSubtle, fontVariant: ["tabular-nums"] }
});
