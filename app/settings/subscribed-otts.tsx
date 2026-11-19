import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { SUBSCRIBED_OTT_FEATURES_ENABLED } from "@/constants/features";
import { FORM_CONTENT_MAX_WIDTH } from "@/constants/layout";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useSubscribedOtts } from "@/hooks/useSubscribedOtts";
import { getHomeLayout } from "@/utils/homeLayout";
import {
  SUBSCRIBABLE_OTTS,
  SUBSCRIBED_OTT_COPY,
  subscribedOttSaveStatusText,
  toggleSubscribedOtt
} from "@/utils/subscribedOtt";

export default function SubscribedOttSettingsScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { gutter } = getHomeLayout(width);
  const subscribedOtts = useSubscribedOtts();
  const statusText = subscribedOttSaveStatusText(subscribedOtts.saveState);

  if (!SUBSCRIBED_OTT_FEATURES_ENABLED) return <Redirect href="/profile" />;

  const loading = subscribedOtts.isLoading || (!subscribedOtts.isReady && !subscribedOtts.isError);

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View
        style={[
          styles.container,
          {
            paddingLeft: Math.max(gutter, insets.left),
            paddingRight: Math.max(gutter, insets.right),
            paddingBottom: spacing.xl + insets.bottom
          }
        ]}
      >
        <DashboardPanel title={SUBSCRIBED_OTT_COPY.screenTitle}>
          <Text style={styles.description}>{SUBSCRIBED_OTT_COPY.description}</Text>
          {loading ? (
            <LoadingSkeleton accessibilityLabel="구독 OTT 설정을 불러오는 중이에요." count={2} variant="episode-row" />
          ) : subscribedOtts.isError ? (
            <ErrorState message={SUBSCRIBED_OTT_COPY.loadFailed} onRetry={subscribedOtts.refetch} />
          ) : (
            <>
              <View style={styles.chips}>
                {SUBSCRIBABLE_OTTS.map(({ group, name }) => {
                  const checked = subscribedOtts.groups.includes(group);
                  return (
                    <Pressable
                      key={group}
                      accessibilityLabel={name}
                      accessibilityRole="checkbox"
                      aria-checked={checked}
                      onPress={() => subscribedOtts.setGroups(toggleSubscribedOtt(subscribedOtts.groups, group))}
                      style={({ pressed }) => [styles.chip, checked ? styles.selectedChip : null, pressed ? styles.pressed : null]}
                    >
                      {checked ? <Ionicons accessible={false} color={colors.primary} name="checkmark" size={16} /> : null}
                      <Text style={[styles.chipLabel, checked ? styles.selectedChipLabel : null]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.statusLine}>
                {statusText ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.statusText, subscribedOtts.saveState === "error" ? styles.saveError : null]}
                  >
                    {statusText}
                  </Text>
                ) : null}
              </View>
            </>
          )}
          <Text style={styles.note}>{SUBSCRIBED_OTT_COPY.laftelNote}</Text>
        </DashboardPanel>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  container: {
    alignSelf: "center",
    maxWidth: FORM_CONTENT_MAX_WIDTH,
    paddingTop: spacing.lg,
    width: "100%"
  },
  description: { ...typography.body, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  selectedChip: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipLabel: { ...typography.label, color: colors.text, flexShrink: 1, minWidth: 0 },
  selectedChipLabel: { color: colors.primary },
  pressed: { opacity: 0.72 },
  statusLine: { minHeight: typography.caption.lineHeight },
  statusText: { ...typography.caption, color: colors.textMuted },
  saveError: { color: colors.danger },
  note: { ...typography.caption, color: colors.textSubtle }
});
