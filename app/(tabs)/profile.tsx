import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { GenreStatsSection } from "@/components/stats/GenreStatsSection";
import { TasteReportCard } from "@/components/stats/TasteReportCard";
import { TypeStatsSection } from "@/components/stats/TypeStatsSection";
import { YearStatsSection } from "@/components/stats/YearStatsSection";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useGenreStats } from "@/hooks/useGenreStats";
import { useLibrary, useLibraryStats } from "@/hooks/useLibrary";
import { queryClient, queryKeys } from "@/lib/query";
import { getProfile, updateProfileDisplayName } from "@/services/profile";
import { useRecommendationUiStore } from "@/stores/recommendationUiStore";
import {
  countCurrentYearWatchedItems,
  createContentTypeStats,
  createCurrentYearSummary,
  createDisplayGenreStats,
  displayNameFromEmail
} from "@/utils/profileStats";
import { shareTasteReportImage } from "@/utils/tasteReportShare";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const stats = useLibraryStats();
  const library = useLibrary("all");
  const genreStats = useGenreStats();
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
  const isAccountActionPending = signOut.isPending || deleteAccount.isPending;
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
      Alert.alert("닉네임 저장 실패", error instanceof Error ? error.message : "닉네임을 저장하지 못했습니다.");
    }
  });

  const libraryItems = useMemo(() => library.data ?? [], [library.data]);
  const fallbackDisplayName = displayNameFromEmail(user?.email);
  const displayName = profile.data?.display_name?.trim() || fallbackDisplayName;
  const totalCount = stats.data?.total ?? libraryItems.length;
  const completedCount = stats.data?.completed ?? 0;
  const pinCount = stats.data?.pins ?? 0;
  const currentYearSummary = useMemo(() => createCurrentYearSummary(libraryItems), [libraryItems]);
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

  useEffect(() => {
    setDisplayNameDraft(displayName);
  }, [displayName]);

  const handleDeleteAccount = () => {
    if (deleteAccount.isPending) return;

    Alert.alert(
      "회원 탈퇴",
      "라이브러리, 에피소드 진행률, 핀, 태그, 리뷰, 좋아하는 인물, 공유 링크 등 모든 개인 기록이 영구 삭제됩니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "계속", onPress: confirmDeleteAccount }
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "정말 탈퇴하시겠어요?",
      "이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "탈퇴",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onSuccess: () => router.replace("/sign-in"),
              onError: (error) => {
                Alert.alert("회원 탈퇴 실패", error.message);
              }
            })
        }
      ]
    );
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

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profile}>
          <View style={styles.profileHeader}>
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{user?.email ?? "개인 감상 기록"}</Text>
              {isEditingName ? (
                <View style={styles.nameEditor}>
                  <TextInput
                    accessibilityLabel="닉네임"
                    autoCapitalize="none"
                    maxLength={24}
                    onChangeText={setDisplayNameDraft}
                    onSubmitEditing={saveDisplayName}
                    placeholder="닉네임"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    style={styles.nameInput}
                    value={displayNameDraft}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={updateDisplayName.isPending}
                    onPress={saveDisplayName}
                    style={[styles.nameSaveButton, updateDisplayName.isPending ? styles.actionDisabled : null]}
                  >
                    <Text style={styles.nameSaveText}>{updateDisplayName.isPending ? "저장 중" : "저장"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={updateDisplayName.isPending}
                    onPress={() => {
                      setDisplayNameDraft(displayName);
                      setIsEditingName(false);
                    }}
                    style={styles.nameCancelButton}
                  >
                    <Text style={styles.nameCancelText}>취소</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={startEditingName} style={styles.editNameButton}>
                  <Ionicons color={colors.primary} name="create-outline" size={15} />
                  <Text style={styles.editNameText}>닉네임 변경</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={shareDisabled}
              onPress={openTasteReportPreview}
              style={[styles.shareButton, shareDisabled ? styles.actionDisabled : null]}
            >
              <Ionicons color={colors.primary} name="image-outline" size={18} />
              <Text style={styles.shareButtonText}>취향 카드 공유</Text>
            </Pressable>
          </View>
          {!hasLibraryItems ? (
            <Text style={styles.shareHint}>작품을 추가하면 내 취향 카드를 만들 수 있어요.</Text>
          ) : null}
        </View>

        <View style={styles.stats}>
          <Stat label="등록 작품" value={totalCount} />
          <Stat label="완료" value={completedCount} />
          <Stat label="핀" value={pinCount} />
          <Stat label={currentYearSummary.label} value={currentYearSummary.value} />
        </View>

        <TypeStatsSection />
        <YearStatsSection />
        <GenreStatsSection />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings/excluded-recommendations")}
          style={styles.settingsRow}
        >
          <View style={styles.settingsRowCopy}>
            <Text style={styles.settingsRowTitle}>추천에서 제외한 작품</Text>
            <Text style={styles.settingsRowMeta}>{recommendationExclusionCount}개</Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isAccountActionPending}
          onPress={() => signOut.mutate()}
          style={[styles.logout, isAccountActionPending ? styles.actionDisabled : null]}
        >
          <Text style={styles.logoutText}>{signOut.isPending ? "로그아웃 중" : "로그아웃"}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isAccountActionPending}
          onPress={handleDeleteAccount}
          style={[styles.deleteAccount, isAccountActionPending ? styles.actionDisabled : null]}
        >
          <Text style={styles.danger}>{deleteAccount.isPending ? "탈퇴 처리 중" : "회원 탈퇴"}</Text>
        </Pressable>
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

      {hasLibraryItems ? (
        <View pointerEvents="none" style={styles.captureLayer}>
          {reportCard}
        </View>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? "--"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 104
  },
  profile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  email: {
    color: colors.textMuted,
    fontSize: 13
  },
  editNameButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30
  },
  editNameText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  nameEditor: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  nameInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 40,
    minWidth: 180,
    outlineStyle: "none" as never,
    paddingHorizontal: spacing.md
  },
  nameSaveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  nameSaveText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 40
  },
  nameCancelButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  nameCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 40
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
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  settingsRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: spacing.lg
  },
  settingsRowCopy: {
    gap: 2
  },
  settingsRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  settingsRowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  stat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: 132,
    flexGrow: 1,
    padding: spacing.md
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  logout: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  logoutText: {
    color: colors.surface,
    fontWeight: "800"
  },
  actionDisabled: {
    opacity: 0.5
  },
  deleteAccount: {
    alignItems: "center",
    padding: spacing.md
  },
  danger: {
    color: colors.danger,
    fontWeight: "700",
    textAlign: "center"
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
