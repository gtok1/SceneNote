import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppImage } from "@/components/common/AppImage";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { TimelinePin } from "@/types/pins";
import { createCrewSummary } from "@/utils/contentCrew";
import { createPinCardModel, getPinAddAccessibilityLabel, PIN_CONTEXT_COPY, PINS_SCREEN_COPY, type PinPanelTimeline } from "@/utils/pinListUi";

interface PinDetailPanelProps {
  pin: TimelinePin | null;
  width: number;
  spoilerRevealed: boolean;
  canShare: boolean;
  onRevealSpoiler: () => void;
  onOpenDetail: () => void;
  onShare: () => void;
  timeline: PinPanelTimeline | null;
  onSelectTimelinePin: (id: string) => void;
  onOpenContent: () => void;
  onAddPin: () => void;
  onOpenAllPins: () => void;
}

export function PinDetailPanel({
  pin, width, spoilerRevealed, canShare, onRevealSpoiler, onOpenDetail, onShare,
  timeline, onSelectTimelinePin, onOpenContent, onAddPin, onOpenAllPins
}: PinDetailPanelProps) {
  const crew = createCrewSummary(pin?.content_crew, 2);
  const model = useMemo(() => pin ? createPinCardModel(pin, { spoilerRevealed }) : null, [pin, spoilerRevealed]);
  return (
    <View style={[styles.panel, { width }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {model && pin ? (
          <>
            <View style={styles.header}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <AppImage contentFit="cover" source={model.posterUrl ? { uri: model.posterUrl } : null} style={styles.poster} />
              </View>
              <View style={styles.headerCopy}>
                <Text numberOfLines={3} style={styles.title}>{model.title}</Text>
                {model.episodeLabel ? <Text style={styles.episode}>{model.episodeLabel}</Text> : null}
                {crew.text ? <Text accessibilityLabel={crew.accessibilityLabel} numberOfLines={2} style={styles.caption}>{crew.text}</Text> : null}
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
            <View style={styles.secondaryActions}>
              <Pressable accessibilityRole="button" onPress={onOpenContent}
                style={({ pressed }) => [styles.action, styles.share, styles.secondaryAction, pressed && styles.pressed]}>
                <Ionicons accessible={false} color={colors.primary} name="film-outline" size={18} />
                <Text style={[styles.actionText, styles.shareText]}>{PIN_CONTEXT_COPY.openContent}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={getPinAddAccessibilityLabel(pin)} onPress={onAddPin}
                style={({ pressed }) => [styles.action, styles.share, styles.secondaryAction, pressed && styles.pressed]}>
                <Ionicons accessible={false} color={colors.primary} name="add-circle-outline" size={18} />
                <Text style={[styles.actionText, styles.shareText]}>{PIN_CONTEXT_COPY.addPin}</Text>
              </Pressable>
            </View>
            {canShare ? (
              <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.action, styles.share, pressed && styles.pressed]}>
                <Ionicons accessible={false} color={colors.primary} name="share-social-outline" size={18} />
                <Text style={[styles.actionText, styles.shareText]}>{PINS_SCREEN_COPY.share}</Text>
              </Pressable>
            ) : null}
            {timeline ? (
              <>
                <View style={styles.divider} />
                <View style={styles.timelineSection}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>{timeline.title}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={PIN_CONTEXT_COPY.showAllPinsLabel}
                      onPress={onOpenAllPins} style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}>
                      <Text style={styles.shareTextLabel}>{PIN_CONTEXT_COPY.showAllPins}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.timelineRows}>
                    {timeline.items.map(item => {
                      const content = (
                        <>
                          <View style={[styles.timelineDot, item.current && styles.currentDot]} />
                          <View style={styles.timelineCopy}>
                            <Text style={styles.timelineLabel}>{item.label}</Text>
                            <Text numberOfLines={1} style={[styles.caption, item.memoEmpty && styles.emptyMemo]}>{item.memo}</Text>
                          </View>
                        </>
                      );
                      return item.current ? (
                        <View key={item.id} accessible accessibilityLabel={item.accessibilityLabel} accessibilityState={{ selected: true }}
                          style={[styles.timelineRow, styles.currentRow]}>{content}</View>
                      ) : (
                        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.accessibilityLabel}
                          accessibilityHint={PIN_CONTEXT_COPY.timelineSelectHint} onPress={() => onSelectTimelinePin(item.id)}
                          style={({ pressed }) => [styles.timelineRow, pressed && styles.pressed]}>{content}</Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
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
  secondaryActions: { flexDirection: "row", gap: spacing.sm },
  secondaryAction: { flex: 1, minWidth: 0 },
  timelineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  timelineTitle: { ...typography.label, color: colors.text, fontVariant: ["tabular-nums"], flexShrink: 1 },
  showAll: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  shareTextLabel: { ...typography.label, color: colors.primary },
  timelineSection: { gap: spacing.xs },
  timelineRows: { gap: spacing.xs },
  timelineRow: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center", minHeight: 44,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md
  },
  timelineDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  currentDot: { backgroundColor: colors.primary },
  currentRow: { backgroundColor: colors.primarySoft },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineLabel: { ...typography.label, color: colors.text, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.72 },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.headline, color: colors.text, textAlign: "center" },
  emptyDescription: { ...typography.body, color: colors.textMuted, textAlign: "center" }
});
