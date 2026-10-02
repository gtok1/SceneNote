import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { AccountSection } from "@/components/profile/AccountSection";
import { GenreRankingPanel } from "@/components/profile/GenreRankingPanel";
import { MetricTile } from "@/components/profile/MetricTile";
import { ProfileHeaderCard } from "@/components/profile/ProfileHeaderCard";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { TypeDistributionPanel } from "@/components/profile/TypeDistributionPanel";
import { YearComparisonPanel } from "@/components/profile/YearComparisonPanel";
import { TasteReportCard } from "@/components/stats/TasteReportCard";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useGenreStats } from "@/hooks/useGenreStats";
import { useLibrary, useLibraryStats } from "@/hooks/useLibrary";
import { queryClient, queryKeys } from "@/lib/query";
import { getProfile, updateProfileDisplayName } from "@/services/profile";
import { useAppUIStore } from "@/stores/appUIStore";
import { useRecommendationUiStore } from "@/stores/recommendationUiStore";
import { confirmDestructive } from "@/utils/confirmDestructive";
import { HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";
import {
  YEAR_CHART_MAX_BARS,
  YEAR_CHART_MAX_BARS_WIDE,
  createGenreRanking,
  createProfileMetrics,
  getProfileLayout,
  userFacingErrorMessage
} from "@/utils/profileDashboard";
import {
  countCurrentYearWatchedItems,
  createContentTypeStats,
  createDisplayGenreStats,
  createLibraryStatusSummary,
  displayNameFromEmail
} from "@/utils/profileStats";
import { shareTasteReportImage } from "@/utils/tasteReportShare";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const stats = useLibraryStats();
  const library = useLibrary("all");
  const genreStats = useGenreStats();
  const { width } = useWindowDimensions();
  const layout = getProfileLayout(width);
  const insets = useSafeAreaInsets();
  const addToast = useAppUIStore((state) => state.addToast);
  const recommendationExclusionCount = useRecommendationUiStore(
    (state) => state.excludedRecommendations.length
  );
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [shareFeedback, setShareFeedback] = useState<{
    status: "error" | "loading" | "success";
    message: string;
  } | null>(null);
  const tasteReportRef = useRef<View | null>(null);
  const userId = user?.id ?? "anonymous";
  const profile = useQuery({
    queryKey: queryKeys.profile.detail(userId),
    queryFn: () => getProfile(userId),
    enabled: Boolean(user?.id)
  });
  const updateDisplayName = useMutation({
    mutationFn: (displayName: string) => updateProfileDisplayName({ displayName, userId }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(queryKeys.profile.detail(userId), updatedProfile);
      setIsEditingName(false);
    },
    onError: (error) => {
      addToast(
        userFacingErrorMessage(error, "닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."),
        "error"
      );
    }
  });

  const libraryItems = useMemo(() => library.data ?? [], [library.data]);
  const fallbackDisplayName = displayNameFromEmail(user?.email);
  const displayName = profile.data?.display_name?.trim() || fallbackDisplayName;
  // 숫자 카드·분포·연도 그래프가 모두 같은 라이브러리 목록에서 세어져야 서로 맞는다. 핀 수만 DB 집계를 쓴다.
  const statusSummary = useMemo(() => createLibraryStatusSummary(libraryItems), [libraryItems]);
  const totalCount = statusSummary.total;
  const completedCount = statusSummary.completed;
  const pinCount = stats.data?.pins ?? 0;
  const currentYearWatchedCount = useMemo(() => countCurrentYearWatchedItems(libraryItems), [libraryItems]);
  const typeStats = useMemo(() => createContentTypeStats(libraryItems), [libraryItems]);
  const reportGenreStats = useMemo(
    () => createDisplayGenreStats(genreStats.data ?? []),
    [genreStats.data]
  );
  const hasLibraryItems = totalCount > 0;
  const shareDisabled =
    !hasLibraryItems ||
    library.isLoading ||
    stats.isLoading ||
    genreStats.isLoading ||
    deleteAccount.isPending ||
    signOut.isPending;


  const metrics = useMemo(
    () => createProfileMetrics({ summary: library.data ? statusSummary : null, pins: stats.data?.pins }),
    [library.data, statusSummary, stats.data?.pins]
  );
  const genreRanking = useMemo(() => createGenreRanking(libraryItems), [libraryItems]);

  useEffect(() => {
    setDisplayNameDraft(displayName);
  }, [displayName]);

  const handleDeleteAccount = () => {
    if (deleteAccount.isPending) return;
    confirmDestructive({
      title: "회원 탈퇴",
      message: "라이브러리, 에피소드 진행률, 핀, 태그, 리뷰, 좋아하는 인물, 공유 링크 등 모든 개인 기록이 영구 삭제됩니다.",
      confirmLabel: "계속",
      onConfirm: () =>
        confirmDestructive({
          title: "정말 탈퇴하시겠어요?",
          message: "이 작업은 되돌릴 수 없습니다.",
          confirmLabel: "탈퇴",
          onConfirm: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => router.replace("/sign-in"),
              onError: (error) =>
                addToast(
                  userFacingErrorMessage(error, "회원 탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
                  "error"
                )
            })
        })
    });
  };

  const startEditingName = () => {
    setDisplayNameDraft(displayName);
    setIsEditingName(true);
  };

  const saveDisplayName = () => {
    if (!user?.id || updateDisplayName.isPending) return;
    updateDisplayName.mutate(displayNameDraft);
  };

  const openTasteReportPreview = () => {
    if (shareDisabled) return;
    setShareFeedback(null);
    setPreviewVisible(true);
  };

  const shareTasteReport = async () => {
    setShareFeedback({ status: "loading", message: "취향 카드 이미지를 만들고 있습니다." });
    try {
      const result = await shareTasteReportImage(tasteReportRef);
      if (result === "downloaded") {
        setShareFeedback({ status: "success", message: "이미지 다운로드를 시작했습니다." });
        return;
      }
      setShareFeedback({ status: "success", message: "공유가 완료되었습니다." });
      setPreviewVisible(false);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") {
        setShareFeedback(null);
        return;
      }
      setShareFeedback({
        status: "error",
        message: error instanceof Error ? error.message : "취향 카드를 공유하지 못했습니다."
      });
      Alert.alert("공유 실패", error instanceof Error ? error.message : "취향 카드를 공유하지 못했습니다.");
    }
  };

  const reportCard = (
    <TasteReportCard
      completedCount={completedCount}
      currentYearWatchedCount={currentYearWatchedCount}
      displayName={displayName}
      genreStats={reportGenreStats}
      pinCount={pinCount}
      ref={tasteReportRef}
      totalCount={totalCount}
      typeStats={typeStats}
    />
  );


  const shareButton = (
    <Pressable
      accessibilityRole="button"
      disabled={shareDisabled}
      onPress={openTasteReportPreview}
      style={[styles.shareButton, shareDisabled ? styles.actionDisabled : null]}
    >
      <Ionicons color={colors.primary} name="image-outline" size={18} />
      <Text style={styles.shareButtonText}>취향 카드 공유</Text>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <View
          style={{
            alignSelf: "center",
            gap: layout.gap,
            maxWidth: HOME_CONTENT_MAX_WIDTH,
            paddingHorizontal: layout.gutter,
            width: "100%"
          }}
        >
          <View style={{ paddingTop: insets.top + 12 }}>
            <Text style={styles.screenTitle}>프로필</Text>
          </View>
          <ProfileHeaderCard
            accessory={EXTENDED_FEATURES_ENABLED ? shareButton : undefined}
            displayName={displayName}
            draft={displayNameDraft}
            email={user?.email ?? null}
            isEditing={isEditingName}
            onCancel={() => {
              setDisplayNameDraft(displayName);
              setIsEditingName(false);
            }}
            onChangeDraft={setDisplayNameDraft}
            onSave={saveDisplayName}
            onStartEdit={startEditingName}
            saving={updateDisplayName.isPending}
          />
          {EXTENDED_FEATURES_ENABLED && !hasLibraryItems ? (
            <Text style={styles.shareHint}>작품을 추가하면 내 취향 카드를 만들 수 있어요.</Text>
          ) : null}
          {library.isLoading && !library.data ? (
            <ProfileSkeleton layout={layout} />
          ) : library.isError && !library.data ? (
            <ErrorState message="통계를 불러오지 못했어요." onRetry={() => library.refetch()} />
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: layout.gap }}>
                {metrics.map((metric) => (
                  <MetricTile key={metric.key} metric={metric} width={layout.metricWidth} />
                ))}
              </View>
              {totalCount === 0 ? (
                <EmptyState
                  actionLabel="작품 검색하기"
                  description="작품을 라이브러리에 추가하면 취향 통계가 여기에 모여요."
                  onAction={() => router.push("/search")}
                  title="아직 통계가 없어요"
                />
              ) : (
                <View style={{ alignItems: "stretch", flexDirection: "row", flexWrap: "wrap", gap: layout.gap }}>
                  <TypeDistributionPanel
                    stats={typeStats}
                    totalCount={libraryItems.length}
                    wide={layout.panelWide}
                    width={layout.panelWidth}
                  />
                  <GenreRankingPanel ranking={genreRanking} width={layout.panelWidth} />
                  <YearComparisonPanel
                    items={libraryItems}
                    maxBars={layout.contentWidth >= 600 ? YEAR_CHART_MAX_BARS_WIDE : YEAR_CHART_MAX_BARS}
                    width={layout.contentWidth}
                  />
                </View>
              )}
            </>
          )}
          <AccountSection
            deleting={deleteAccount.isPending}
            exclusionCount={recommendationExclusionCount}
            onDeleteAccount={handleDeleteAccount}
            onOpenExclusions={
              EXTENDED_FEATURES_ENABLED ? () => router.push("/settings/excluded-recommendations") : undefined
            }
            onSignOut={() => signOut.mutate()}
            signingOut={signOut.isPending}
            width={layout.panelWidth}
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
        transparent
        visible={previewVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>취향 카드 미리보기</Text>
              <Pressable
                accessibilityLabel="미리보기 닫기"
                accessibilityRole="button"
                onPress={() => setPreviewVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons color={colors.textMuted} name="close" size={20} />
              </Pressable>
            </View>
            <View style={styles.previewFrame}>
              <TasteReportCard
                completedCount={completedCount}
                currentYearWatchedCount={currentYearWatchedCount}
                displayName={displayName}
                genreStats={reportGenreStats}
                pinCount={pinCount}
                preview
                totalCount={totalCount}
                typeStats={typeStats}
              />
            </View>
            {shareFeedback ? (
              <Text
                style={[
                  styles.shareFeedback,
                  shareFeedback.status === "error" ? styles.shareFeedbackError : null,
                  shareFeedback.status === "success" ? styles.shareFeedbackSuccess : null
                ]}
              >
                {shareFeedback.message}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={shareFeedback?.status === "loading"}
                onPress={() => {
                  setShareFeedback(null);
                  setPreviewVisible(false);
                }}
                style={[styles.secondaryButton, shareFeedback?.status === "loading" ? styles.actionDisabled : null]}
              >
                <Text style={styles.secondaryButtonText}>닫기</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={shareFeedback?.status === "loading"}
                onPress={shareTasteReport}
                style={[styles.primaryButton, shareFeedback?.status === "loading" ? styles.actionDisabled : null]}
              >
                <Text style={styles.primaryButtonText}>
                  {shareFeedback?.status === "loading" ? "공유 준비 중" : "공유하기"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {EXTENDED_FEATURES_ENABLED && hasLibraryItems ? (
        <View pointerEvents="none" style={styles.captureLayer}>
          {reportCard}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    ...typography.display,
    color: colors.text
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  shareHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  actionDisabled: {
    opacity: 0.5
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.48)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    maxWidth: 460,
    padding: spacing.lg,
    width: "100%"
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  closeButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36
  },
  previewFrame: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: "hidden",
    padding: spacing.md
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  shareFeedback: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    padding: spacing.md,
    textAlign: "center"
  },
  shareFeedbackError: {
    backgroundColor: colors.dangerSoft,
    color: colors.danger
  },
  shareFeedbackSuccess: {
    backgroundColor: colors.successSoft,
    color: colors.success
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    padding: spacing.md
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "900"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flex: 1,
    padding: spacing.md
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: "900"
  },
  captureLayer: {
    left: -10000,
    position: "absolute",
    top: 0
  }
});
