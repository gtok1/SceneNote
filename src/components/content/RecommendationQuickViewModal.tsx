import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalFocus } from "@/hooks/useModalFocus";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { GenreBadgeList } from "@/components/GenreBadge";
import { AppImage as Image } from "@/components/common/AppImage";
import { colors, radius, spacing } from "@/constants/theme";
import { useExternalContentDetail } from "@/hooks/useContentSearch";
import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import { chooseRecommendationOverview, mapRecommendationToCardViewModel, type RecommendationPresentation } from "@/utils/recommendationPresentation";

interface RecommendationQuickViewModalProps {
  item: PersonalizedRecommendation | null;
  presentation: RecommendationPresentation | null;
  addLabel: string;
  isAddDisabled: boolean;
  onClose: () => void;
  onAdd: (item: PersonalizedRecommendation) => void;
  onOpenDetails: (item: PersonalizedRecommendation) => void;
  onNotInterested: (item: PersonalizedRecommendation) => void;
  onMoreLikeThis: (item: PersonalizedRecommendation) => void;
  onReduceTheme?: (item: PersonalizedRecommendation) => void;
}

export function RecommendationQuickViewModal({
  item,
  presentation,
  addLabel,
  isAddDisabled,
  onClose,
  onAdd,
  onOpenDetails,
  onNotInterested,
  onMoreLikeThis,
  onReduceTheme
}: RecommendationQuickViewModalProps) {
  const insets = useSafeAreaInsets();
  const { panelRef, firstRef, focusFirst } = useModalFocus(Boolean(item));
  const detail = useExternalContentDetail(
    item?.external_source,
    item?.external_id,
    item?.content_type === "movie" ? "movie" : "tv"
  );

  if (!item) return null;

  const resolvedPresentation = presentation ?? mapRecommendationToCardViewModel(item);
  const content = detail.data?.content;
  const overview = chooseRecommendationOverview(
    item.content_type,
    content?.localized_overview,
    content?.overview,
    resolvedPresentation.fullOverview
  );
  const genres = content?.genres?.length ? content.genres : item.genres;
  const cast = content?.cast?.slice(0, 6) ?? [];
  const people = Array.from(new Set([...(item.people ?? []), ...cast.map((member) => member.name)])).slice(0, 6);
  const studios = Array.from(new Set(item.studios ?? [])).slice(0, 4);
  const tags = Array.from(new Set(item.keywords ?? [])).slice(0, 6);
  const seasonCount = detail.data?.seasons.length ?? 0;
  const reactionLabels = [resolvedPresentation.ratingLabel, resolvedPresentation.popularityLabel].filter(Boolean);

  return (
    <Modal
      onShow={focusFirst}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <View accessibilityViewIsModal style={[styles.backdrop, {paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16)}]}>
        <Pressable accessibilityLabel="빠른 보기 닫기" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityLabel={`${item.title_primary} 빠른 보기`} ref={panelRef} role="dialog" aria-modal accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Text style={styles.eyebrow}>빠른 보기</Text>
              <Text numberOfLines={2} style={styles.title}>{item.title_primary}</Text>
            </View>
            <Pressable accessibilityLabel="빠른 보기 닫기" accessibilityRole="button" ref={firstRef} onPress={onClose} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={22} />
            </Pressable>
          </View>

          <ScrollView style={{flexShrink: 1}} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Image
                accessibilityLabel={`${item.title_primary} 포스터`}
                contentFit="cover"
                source={item.poster_url ? { uri: item.poster_url } : null}
                style={styles.poster}
              />
              <View style={styles.summary}>
                {resolvedPresentation.statusBadges.length > 0 ? (
                  <View style={styles.badgeRow}>
                    {resolvedPresentation.statusBadges.map((badge) => <Text key={badge} style={styles.statusBadge}>{badge}</Text>)}
                  </View>
                ) : null}
                {reactionLabels.length > 0 ? <Text style={styles.reaction}>{reactionLabels.join(" · ")}</Text> : null}
                {resolvedPresentation.metadataLabel ? <Text style={styles.meta}>{resolvedPresentation.metadataLabel}</Text> : null}
                {seasonCount > 0 ? <Text style={styles.meta}>총 {seasonCount}시즌</Text> : null}
                <GenreBadgeList genres={genres} maxVisible={genres?.length ?? 0} />
              </View>
            </View>

            {detail.isLoading ? (
              <View accessibilityLabel="상세 정보 불러오는 중" style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>상세 정보를 불러오고 있어요.</Text>
              </View>
            ) : null}

            {overview ? <InfoSection title="작품 소개"><Text style={styles.overview}>{overview}</Text></InfoSection> : null}
            {resolvedPresentation.personalizedReason ? (
              <InfoSection icon="sparkles-outline" title={resolvedPresentation.reasonLabel ?? "추천 이유"}>
                <Text style={styles.overview}>{resolvedPresentation.personalizedReason}</Text>
              </InfoSection>
            ) : null}
            {tags.length > 0 ? <InfoSection title="주요 태그"><Text style={styles.value}>{tags.join(" · ")}</Text></InfoSection> : null}
            {people.length > 0 ? <InfoSection title={item.content_type === "anime" ? "주요 참여진" : "주요 출연진"}><Text style={styles.value}>{people.join(", ")}</Text></InfoSection> : null}
            {studios.length > 0 ? <InfoSection title="제작사 · 스튜디오"><Text style={styles.value}>{studios.join(", ")}</Text></InfoSection> : null}
            {item.trailer_url ? (
              <Pressable accessibilityLabel={`${item.title_primary} 예고편 열기`} accessibilityRole="link" onPress={() => void Linking.openURL(item.trailer_url ?? "")} style={styles.trailerButton}>
                <Ionicons color={colors.primary} name="play-circle-outline" size={18} />
                <Text style={styles.trailerText}>예고편 보기</Text>
              </Pressable>
            ) : null}
            {detail.isError ? <Text style={styles.muted}>추가 상세 정보는 현재 불러오지 못했습니다.</Text> : null}
            {resolvedPresentation.sourceLabel ? <Text style={styles.source}>작품 정보 출처: {resolvedPresentation.sourceLabel}</Text> : null}
          <View style={styles.footer}>
            <Pressable accessibilityLabel={`${item.title_primary} 관심 없음`} accessibilityRole="button" onPress={() => onNotInterested(item)} style={styles.feedbackButton}>
              <Ionicons color={colors.textMuted} name="close-circle-outline" size={18} />
              <Text style={styles.feedbackText}>관심 없음</Text>
            </Pressable>
            <Pressable accessibilityLabel={`${item.title_primary} 비슷한 작품 더 보기`} accessibilityRole="button" onPress={() => onMoreLikeThis(item)} style={styles.feedbackButton}>
              <Ionicons color={colors.textMuted} name="git-compare-outline" size={18} />
              <Text style={styles.feedbackText}>비슷한 작품</Text>
            </Pressable>
            {onReduceTheme ? <Pressable accessibilityLabel={`${item.title_primary} 이런 요소 줄이기`} accessibilityRole="button" onPress={() => onReduceTheme(item)} style={styles.feedbackButton}><Ionicons color={colors.textMuted} name="options-outline" size={18} /><Text style={styles.feedbackText}>요소 줄이기</Text></Pressable> : null}
            <Pressable accessibilityLabel={`${item.title_primary} 상세 화면 열기`} accessibilityRole="button" onPress={() => onOpenDetails(item)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>상세 보기</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`${item.title_primary} ${addLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isAddDisabled, busy: addLabel.includes("중") }}
              disabled={isAddDisabled}
              onPress={() => onAdd(item)}
              style={[styles.primaryButton, isAddDisabled ? styles.disabled : null]}
            >
              <Text style={styles.primaryText}>{addLabel}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InfoSection({ children, icon, title }: { children: React.ReactNode; icon?: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        {icon ? <Ionicons color={colors.primary} name={icon} size={15} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(17, 24, 39, 0.58)", flex: 1, justifyContent: "center", padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: "92%", maxWidth: 720, overflow: "hidden", width: "100%" },
  header: { alignItems: "flex-start", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  headerTitle: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  title: { color: colors.text, fontSize: 21, fontWeight: "900", lineHeight: 27 },
  closeButton: { alignItems: "center", borderRadius: 20, height: 44, justifyContent: "center", width: 44 },
  scrollContent: { gap: spacing.lg, padding: spacing.lg },
  hero: { alignItems: "flex-start", flexDirection: "row", gap: spacing.lg },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, height: 132, width: 88 },
  summary: { flex: 1, gap: spacing.sm, minWidth: 0 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusBadge: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, color: colors.text, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  reaction: { color: colors.primary, fontSize: 14, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  loadingRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  overview: { color: colors.text, fontSize: 14, lineHeight: 22 },
  value: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  trailerButton: { minHeight: 44, justifyContent: "center", alignItems: "center", alignSelf: "flex-start", borderColor: colors.primary, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  trailerText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  source: { color: colors.textMuted, fontSize: 11 },
  muted: { color: colors.textMuted, fontSize: 12 },
  footer: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "flex-end", padding: spacing.lg },
  feedbackButton: { minHeight: 44, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  feedbackText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  secondaryButton: { minHeight: 44, justifyContent: "center", borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  primaryButton: { minHeight: 44, justifyContent: "center", backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 }
});
