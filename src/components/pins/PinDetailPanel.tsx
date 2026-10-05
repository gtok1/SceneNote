import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppImage } from "@/components/common/AppImage";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { createPinCardModel, PINS_SCREEN_COPY } from "@/utils/pinListUi";

interface PinDetailPanelProps {
  pin: TimelinePin | null;
  width: number;
  spoilerRevealed: boolean;
  canShare: boolean;
  onRevealSpoiler: () => void;
  onOpenDetail: () => void;
  onShare: () => void;
}

export function PinDetailPanel({
  pin, width, spoilerRevealed, canShare, onRevealSpoiler, onOpenDetail, onShare
}: PinDetailPanelProps) {
  const model = useMemo(() => pin ? createPinCardModel(pin, { spoilerRevealed }) : null, [pin, spoilerRevealed]);
  return (
    <View style={[styles.panel, { width }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {model ? (
          <>
            <View style={styles.header}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <AppImage contentFit="cover" source={model.posterUrl ? { uri: model.posterUrl } : null} style={styles.poster} />
              </View>
              <View style={styles.headerCopy}>
                <Text numberOfLines={3} style={styles.title}>{model.title}</Text>
                {model.episodeLabel ? <Text style={styles.episode}>{model.episodeLabel}</Text> : null}
              </View>
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>{model.timeLabel}</Text>
              {model.emotionLabel ? <Text style={styles.emotion}>{model.emotionLabel}</Text> : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.caption}>{PINS_SCREEN_COPY.memoSection}</Text>
              {model.memoHidden ? (
                <Pressable accessibilityRole="button" onPress={onRevealSpoiler} style={({ pressed }) => [styles.reveal, pressed && styles.pressed]}>
                  <Ionicons accessible={false} color={colors.textMuted} name="eye-outline" size={16} />
                  <Text style={styles.revealText}>{PINS_SCREEN_COPY.spoilerReveal}</Text>
                </Pressable>
              ) : <Text selectable style={model.memoEmpty ? styles.emptyMemo : styles.memo}>{model.memo}</Text>}
            </View>
            {model.allTags.length ? (
              <View style={styles.section}>
                <Text style={styles.caption}>{PINS_SCREEN_COPY.tagSection}</Text>
                <View style={styles.tags}>
                  {model.allTags.map((tag, index) => <Text key={pin?.tags?.[index]?.id ?? tag} style={styles.tag}>{tag}</Text>)}
                </View>
              </View>
            ) : null}
            {model.dateLabel ? <Text style={styles.savedAt}>{PINS_SCREEN_COPY.savedAtPrefix} {model.dateLabel}</Text> : null}
            <Pressable accessibilityRole="button" onPress={onOpenDetail} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons accessible={false} color={colors.surface} name="open-outline" size={18} />
              <Text style={styles.actionText}>{PINS_SCREEN_COPY.openDetail}</Text>
            </Pressable>
            {canShare ? (
              <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.action, styles.share, pressed && styles.pressed]}>
                <Ionicons accessible={false} color={colors.primary} name="share-social-outline" size={18} />
                <Text style={[styles.actionText, styles.shareText]}>{PINS_SCREEN_COPY.share}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Ionicons accessible={false} color={colors.primary} name="pin-outline" size={24} />
            <Text style={styles.emptyTitle}>{PINS_SCREEN_COPY.previewTitle}</Text>
            <Text style={styles.emptyDescription}>{PINS_SCREEN_COPY.previewDescription}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: "flex-start", maxHeight: "100%", marginBottom: spacing.lg, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, ...elevation.card
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", gap: spacing.md },
  poster: { width: 72, height: 108, borderRadius: radius.sm },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { ...typography.title, color: colors.text },
  episode: { ...typography.label, color: colors.textMuted },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  time: { ...typography.title, color: colors.primary, fontVariant: ["tabular-nums"] },
  emotion: {
    ...typography.micro, color: colors.primary, backgroundColor: colors.primarySoft,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  section: { gap: spacing.sm },
  caption: { ...typography.caption, color: colors.textMuted },
  reveal: {
    minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceMuted,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm
  },
  revealText: { ...typography.label, color: colors.textMuted, flexShrink: 1 },
  emptyMemo: { ...typography.caption, color: colors.textSubtle },
  memo: { ...typography.body, color: colors.text },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    ...typography.caption, color: colors.textMuted, backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2
  },
  savedAt: { ...typography.caption, color: colors.textSubtle },
  action: {
    minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.primary,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm
  },
  actionText: { ...typography.label, color: colors.surface, flexShrink: 1 },
  share: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: StyleSheet.hairlineWidth },
  shareText: { color: colors.primary },
  pressed: { opacity: 0.72 },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.headline, color: colors.text, textAlign: "center" },
  emptyDescription: { ...typography.body, color: colors.textMuted, textAlign: "center" }
});
