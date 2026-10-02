import { StyleSheet, Text, View } from "react-native";

import { GENRE_COLORS } from "@/constants/genreColors";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { type GenreRanking, formatCount, formatPercent } from "@/utils/profileDashboard";

import { DashboardPanel } from "./DashboardPanel";

interface GenreRankingPanelProps {
  ranking: GenreRanking;
  width?: number | undefined;
}

// 한 작품에 장르가 여러 개라 비율 합이 100%가 아니다. 도넛 대신 "등록 작품 중 몇 %"를 막대로 보여준다.
export function GenreRankingPanel({ ranking, width }: GenreRankingPanelProps) {
  return (
    <DashboardPanel
      subtitle={`등록 작품 ${formatCount(ranking.itemCount)}개 중 · 드라마·애니메이션 제외`}
      title="장르 TOP 5"
      width={width}
    >
      {ranking.rows.length === 0 ? (
        <Text style={styles.empty}>장르 정보가 있는 작품이 아직 없어요.</Text>
      ) : (
        <View style={styles.list}>
          {ranking.rows.map((row, index) => {
            const color = GENRE_COLORS[row.colorIndex % GENRE_COLORS.length] ?? colors.primary;
            return (
              <View
                accessibilityLabel={`${index + 1}위 ${row.name}, ${row.count}개, 등록 작품의 ${formatPercent(row.percent)}`}
                accessible
                key={row.name}
                style={styles.row}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <Text numberOfLines={1} style={styles.name}>
                    {row.name}
                  </Text>
                  <Text style={styles.count}>{`${formatCount(row.count)}개`}</Text>
                  <Text style={styles.percent}>{formatPercent(row.percent)}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(100, row.percent)}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      <Text style={styles.footnote}>한 작품에 장르가 여러 개일 수 있어 비율을 더하면 100%가 넘어요.</Text>
    </DashboardPanel>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...typography.body,
    color: colors.textMuted
  },
  list: {
    gap: spacing.md
  },
  row: {
    gap: spacing.xs
  },
  rowHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rank: {
    ...typography.label,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
    width: 16
  },
  name: {
    ...typography.label,
    color: colors.text,
    flexShrink: 1
  },
  count: {
    ...typography.label,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    marginLeft: "auto"
  },
  percent: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
    minWidth: 32,
    textAlign: "right"
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 8,
    marginLeft: 16 + spacing.sm,
    overflow: "hidden"
  },
  fill: {
    borderRadius: radius.pill,
    height: 8
  },
  footnote: {
    ...typography.caption,
    color: colors.textMuted
  }
});
