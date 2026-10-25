import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/constants/theme";
import { useExternalContentDetail } from "@/hooks/useContentSearch";
import type { CastMember, ContentType, ExternalSource } from "@/types/content";
import { recommendationCastLabel, recommendationCastNames, recommendationCastMediaType } from "@/utils/recommendationCast";

interface ContentCastProps {
  source: ExternalSource;
  externalId: string;
  contentType: ContentType;
  genres?: readonly string[];
  cast?: readonly CastMember[];
}

/** Shares the quick-view cache; stored cast needs no additional request. */
export const ContentCast = memo(function ContentCast({ source, externalId, contentType, genres = [], cast = [] }: ContentCastProps) {
  const canFetch = source !== "manual" && Boolean(externalId) && cast.length === 0;
  const detail = useExternalContentDetail(canFetch ? source : undefined, externalId, recommendationCastMediaType(contentType));
  const label = recommendationCastLabel(contentType, [...genres, ...(detail.data?.content.genres ?? [])]);
  const names = recommendationCastNames(cast.length ? cast : detail.data?.content.cast ?? [], source === "anilist" ? "anilist" : "tmdb");
  const copy = names.length ? names.join(" · ") : canFetch && detail.isPending ? "불러오는 중…" : canFetch && detail.isError ? "정보를 불러오지 못했어요" : "정보가 아직 없어요";
  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <Text numberOfLines={2} style={styles.names}>{copy}</Text>
  </View>;
});

const styles = StyleSheet.create({
  container: { minHeight: 52, gap: spacing.xs, minWidth: 0 },
  label: { ...typography.micro, color: colors.textMuted },
  names: { ...typography.caption, color: colors.text }
});
