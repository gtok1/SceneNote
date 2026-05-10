import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";

import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { colors, radius, spacing } from "@/constants/theme";
import { usePersonDetail } from "@/hooks/usePeople";
import type { PersonCategory, PersonCredit, PersonSource } from "@/types/people";

const CREDIT_PAGE_SIZE = 10;

export default function PersonDetailScreen() {
  const router = useRouter();
  const [creditPage, setCreditPage] = useState(1);
  const params = useLocalSearchParams<{
    id?: string;
    source?: PersonSource;
    externalId?: string;
    category?: PersonCategory;
  }>();
  const parsed = parsePersonParams(params);
  const detail = usePersonDetail(parsed.source, parsed.externalId, parsed.category);
  const credits = useMemo(() => sortCreditsByDate(detail.data?.credits ?? []), [detail.data?.credits]);
  const totalCreditPages = Math.max(1, Math.ceil(credits.length / CREDIT_PAGE_SIZE));
  const safeCreditPage = Math.min(creditPage, totalCreditPages);
  const visibleStart = credits.length ? (safeCreditPage - 1) * CREDIT_PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(safeCreditPage * CREDIT_PAGE_SIZE, credits.length);
  const visibleCredits = useMemo(
    () =>
      credits.slice(
        (safeCreditPage - 1) * CREDIT_PAGE_SIZE,
        safeCreditPage * CREDIT_PAGE_SIZE
      ),
    [credits, safeCreditPage]
  );

  if (!parsed.source || !parsed.externalId || !parsed.category) {
    return <EmptyState title="인물 정보를 찾을 수 없습니다" />;
  }
  if (detail.isLoading) return <LoadingSkeleton count={4} />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />;
  if (!detail.data) return <EmptyState title="인물 정보를 찾을 수 없습니다" />;

  const person = detail.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image contentFit="cover" source={person.profile_url ? { uri: person.profile_url } : null} style={styles.profile} />
      <View style={styles.header}>
        <Text style={styles.name}>{person.name}</Text>
        {person.original_name && person.original_name !== person.name ? (
          <Text style={styles.original}>{person.original_name}</Text>
        ) : null}
        <Text style={styles.category}>{person.category === "voice_actor" ? "성우" : "배우"}</Text>
      </View>

      <View style={styles.infoGrid}>
        <InfoItem label="생일" value={formatDate(person.birthday)} />
        <InfoItem label="나이" value={person.age !== null ? `${person.age}세` : null} />
        <InfoItem label="출생지" value={person.birthplace} />
        <InfoItem label="성별" value={person.gender} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>소개</Text>
        <Text style={styles.bio}>{person.biography || "소개 정보가 없습니다."}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>작품 활동</Text>
          {person.credits.length ? (
            <Text style={styles.pageText}>
              {safeCreditPage}/{totalCreditPages}페이지 · {visibleStart}-{visibleEnd}번째 / 총 {person.credits.length}개
            </Text>
          ) : null}
        </View>
        {person.credits.length ? (
          <View style={styles.creditList}>
            {visibleCredits.map((credit) => (
              <CreditRow
                credit={credit}
                key={`${credit.external_source}:${credit.external_id}`}
                onPress={() =>
                  router.push({
                    pathname: "/content/[id]",
                    params: {
                      id: `${credit.external_source}:${credit.external_id}`,
                      source: credit.external_source,
                      externalId: credit.external_id,
                      title: credit.title,
                      originalTitle: credit.original_title ?? "",
                      posterUrl: credit.poster_url ?? "",
                      contentType: credit.content_type,
                      airYear: credit.air_year ? String(credit.air_year) : ""
                    }
                  })
                }
              />
            ))}
            {totalCreditPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={safeCreditPage <= 1}
                  onPress={() => setCreditPage(1)}
                  style={[styles.pageButton, safeCreditPage <= 1 ? styles.pageButtonDisabled : null]}
                >
                  <Text style={styles.pageButtonText}>맨처음</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={safeCreditPage <= 1}
                  onPress={() => setCreditPage((page) => Math.max(1, page - 1))}
                  style={[styles.pageButton, safeCreditPage <= 1 ? styles.pageButtonDisabled : null]}
                >
                  <Text style={styles.pageButtonText}>이전</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={safeCreditPage >= totalCreditPages}
                  onPress={() => setCreditPage((page) => Math.min(totalCreditPages, page + 1))}
                  style={[styles.pageButton, safeCreditPage >= totalCreditPages ? styles.pageButtonDisabled : null]}
                >
                  <Text style={styles.pageButtonText}>다음</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={safeCreditPage >= totalCreditPages}
                  onPress={() => setCreditPage(totalCreditPages)}
                  style={[styles.pageButton, safeCreditPage >= totalCreditPages ? styles.pageButtonDisabled : null]}
                >
                  <Text style={styles.pageButtonText}>맨끝</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState title="작품 활동 정보가 없습니다" />
        )}
      </View>
    </ScrollView>
  );
}

function parsePersonParams(params: {
  id?: string;
  source?: PersonSource;
  externalId?: string;
  category?: PersonCategory;
}) {
  const [sourceFromId, externalIdFromId] = params.id?.split(":") ?? [];

  return {
    source: params.source ?? (sourceFromId as PersonSource | undefined),
    externalId: params.externalId ?? externalIdFromId,
    category: params.category
  };
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "정보 없음"}</Text>
    </View>
  );
}

function CreditRow({ credit, onPress }: { credit: PersonCredit; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.creditRow}>
      <Image contentFit="cover" source={credit.poster_url ? { uri: credit.poster_url } : null} style={styles.poster} />
      <View style={styles.creditBody}>
        <Text numberOfLines={1} style={styles.creditTitle}>
          {credit.title}
        </Text>
        {credit.original_title && credit.original_title !== credit.title ? (
          <Text numberOfLines={1} style={styles.creditOriginal}>
            {credit.original_title}
          </Text>
        ) : null}
        <Text style={styles.creditMeta}>
          {[credit.air_year, labelContentType(credit.content_type)].filter(Boolean).join(" · ")}
        </Text>
        {credit.role ? (
          <Text numberOfLines={1} style={styles.role}>
            역: {credit.role}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function labelContentType(value: PersonCredit["content_type"]) {
  switch (value) {
    case "anime":
      return "애니";
    case "kdrama":
      return "한국 드라마";
    case "jdrama":
      return "일본 드라마";
    case "movie":
      return "영화";
    default:
      return "기타";
  }
}

function sortCreditsByDate(credits: PersonCredit[]): PersonCredit[] {
  return [...credits].sort((a, b) => {
    const bYear = b.air_year ?? -1;
    const aYear = a.air_year ?? -1;
    if (bYear !== aYear) return bYear - aYear;
    return a.title.localeCompare(b.title, "ko");
  });
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96
  },
  profile: {
    alignSelf: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 220,
    width: 165
  },
  header: {
    gap: spacing.xs
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  original: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700"
  },
  category: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: 170,
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  section: {
    gap: spacing.sm
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  pageText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  bio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22
  },
  creditList: {
    gap: spacing.sm
  },
  creditRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  poster: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 78,
    width: 54
  },
  creditBody: {
    flex: 1,
    gap: 3
  },
  creditTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  creditOriginal: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  creditMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  role: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  pagination: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    flexWrap: "wrap",
    paddingVertical: spacing.sm
  },
  pageButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md
  },
  pageButtonDisabled: {
    backgroundColor: colors.surfaceMuted
  },
  pageButtonText: {
    color: colors.surface,
    fontWeight: "900"
  }
});
