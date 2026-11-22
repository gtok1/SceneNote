import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { SHARE_FEATURES_ENABLED } from "@/constants/features";
import { FORM_CONTENT_MAX_WIDTH } from "@/constants/layout";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useDeleteLibraryShare, useMyLibraryShares } from "@/hooks/useLibraryShares";
import { buildLibraryShareUrl, LIBRARY_SHARE_LINKS_AVAILABLE, MY_LIBRARY_SHARE_LIMIT, shareLibraryUrl } from "@/services/libraryShare";
import { useAppUIStore } from "@/stores/appUIStore";
import { useAuthStore } from "@/stores/authStore";
import type { MyLibraryShare } from "@/types/libraryShare";
import { confirmDestructive } from "@/utils/confirmDestructive";
import { getHomeLayout } from "@/utils/homeLayout";
import {
  LIBRARY_SHARE_APP_ONLY_COPY,
  LIBRARY_SHARE_MANAGEMENT_COPY as copy,
  libraryShareRowMeta,
  libraryShareStopConfirm
} from "@/utils/libraryShareManagement";

export default function LibraryShareSettingsScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { gutter } = getHomeLayout(width);
  const narrow = Math.min(width, FORM_CONTENT_MAX_WIDTH) / Math.max(1, fontScale) < 600;
  const shares = useMyLibraryShares();
  const { mutateAsync: deleteShare, pendingIds } = useDeleteLibraryShare();
  const addToast = useAppUIStore(state => state.addToast);
  const userId = useAuthStore(state => state.user?.id);

  if (!SHARE_FEATURES_ENABLED) return <Redirect href="/profile" />;

  const isCurrentUser = () => Boolean(userId) && useAuthStore.getState().user?.id === userId;

  const resend = async ({ id, title }: MyLibraryShare) => {
    if (!isCurrentUser()) return;
    try {
      const delivery = await shareLibraryUrl({ title, url: buildLibraryShareUrl(id) });
      if (delivery === "copied" && isCurrentUser()) addToast(copy.copied, "success");
    } catch {
      if (isCurrentUser()) addToast(copy.resendFailed, "error");
    }
  };

  const stop = ({ id, title }: MyLibraryShare) => {
    confirmDestructive({
      ...libraryShareStopConfirm(title),
      onConfirm: async () => {
        if (!isCurrentUser()) return;
        try {
          await deleteShare(id);
          if (isCurrentUser()) addToast(copy.stopped, "success");
        } catch {
          if (isCurrentUser()) addToast(copy.stopFailed, "error");
        }
      }
    });
  };

  const links = shares.data ?? [];
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={[styles.container, {
        paddingLeft: Math.max(gutter, insets.left),
        paddingRight: Math.max(gutter, insets.right),
        paddingBottom: spacing.xl + insets.bottom
      }]}>
        <DashboardPanel title={copy.screenTitle}>
          <Text style={styles.description}>{copy.description}</Text>
          {!LIBRARY_SHARE_LINKS_AVAILABLE ? (
            <Text style={styles.meta}>{LIBRARY_SHARE_APP_ONLY_COPY.resendUnavailable}</Text>
          ) : null}
          {shares.isPending ? (
            <LoadingSkeleton accessibilityLabel="공유 링크를 불러오는 중이에요." count={3} variant="episode-row" />
          ) : shares.isError ? (
            <ErrorState message={copy.loadFailed} onRetry={() => void shares.refetch()} />
          ) : links.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle}
              description={LIBRARY_SHARE_LINKS_AVAILABLE ? copy.emptyDescription : LIBRARY_SHARE_APP_ONLY_COPY.emptyDescription}
              {...(LIBRARY_SHARE_LINKS_AVAILABLE && {
                actionLabel: copy.emptyAction,
                onAction: () => router.replace("/library")
              })}
            />
          ) : (
            <View>
              {links.map(share => {
                const stopping = pendingIds.has(share.id);
                return (
                  <View key={share.id} style={[styles.row, narrow && styles.narrowRow]}>
                    <View style={styles.details}>
                      <Text numberOfLines={2} style={styles.title}>{share.title}</Text>
                      <Text style={styles.meta}>{libraryShareRowMeta(share)}</Text>
                    </View>
                    <View style={styles.actions}>
                      {LIBRARY_SHARE_LINKS_AVAILABLE ? (
                        <Pressable
                          accessibilityLabel={`${copy.resend}, ${share.title}`}
                          accessibilityRole="button"
                          aria-disabled={stopping}
                          disabled={stopping}
                          onPress={() => void resend(share)}
                          style={({ pressed }) => [styles.button, pressed && styles.pressed, stopping && styles.disabled]}
                        >
                          <Text style={styles.buttonText}>{copy.resend}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityLabel={`${copy.stop}, ${share.title}`}
                        accessibilityRole="button"
                        aria-busy={stopping}
                        aria-disabled={stopping}
                        disabled={stopping}
                        onPress={() => stop(share)}
                        style={({ pressed }) => [styles.button, pressed && styles.pressed, stopping && styles.disabled]}
                      >
                        <Text style={[styles.buttonText, styles.danger]}>{stopping ? copy.stopping : copy.stop}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {links.length === MY_LIBRARY_SHARE_LIMIT ? <Text style={styles.meta}>{copy.tooManyNote}</Text> : null}
            </View>
          )}
        </DashboardPanel>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { alignSelf: "center", maxWidth: FORM_CONTENT_MAX_WIDTH, paddingTop: spacing.lg, width: "100%" },
  description: { ...typography.body, color: colors.textMuted },
  row: {
    alignItems: "center",
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  narrowRow: { alignItems: "stretch", flexDirection: "column" },
  details: { flexShrink: 1, gap: spacing.xs, minWidth: 0 },
  title: { ...typography.headline, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, maxWidth: "100%" },
  button: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  buttonText: { ...typography.label, color: colors.text },
  danger: { color: colors.danger },
  pressed: { backgroundColor: colors.surfaceMuted },
  disabled: { opacity: 0.5 }
});
