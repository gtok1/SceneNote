import { forwardRef } from "react";
import { type DimensionValue, StyleSheet, Text, View } from "react-native";

import { CONTENT_TYPE_COLORS } from "@/constants/contentTypeColors";
import { colors, radius, spacing } from "@/constants/theme";
import type { GenreStat } from "@/types/genre";
import type { ContentTypeStat } from "@/utils/profileStats";

interface TasteReportCardProps {
  displayName: string;
  totalCount: number;
  completedCount: number;
  pinCount: number;
  currentYearWatchedCount: number | null;
  typeStats: ContentTypeStat[];
  genreStats: GenreStat[];
  preview?: boolean;
}

export const TasteReportCard = forwardRef<View, TasteReportCardProps>(function TasteReportCard(
  {
    displayName,
    totalCount,
    completedCount,
    pinCount,
    currentYearWatchedCount,
    typeStats,
    genreStats,
    preview = false
  },
  ref
) {
  const scale = preview ? 0.32 : 1;
  const visibleTypeStats = typeStats.filter((item) => item.count > 0);
  const topGenres = genreStats.slice(0, 3);

  return (
    <View
      collapsable={false}
      ref={ref}
      style={[
        styles.card,
        {
          borderRadius: scaled(radius.lg * 3, scale),
          height: scaled(1350, scale),
          padding: scaled(72, scale),
          width: scaled(1080, scale)
        }
      ]}
    >
      <View style={[styles.header, { gap: scaled(spacing.md, scale) }]}>
        <Text style={[styles.brand, { fontSize: scaled(34, scale) }]}>SceneNote</Text>
        <Text numberOfLines={2} style={[styles.title, { fontSize: scaled(78, scale), lineHeight: scaled(92, scale) }]}>
          {displayName}의 감상 기록
        </Text>
      </View>

      <View style={[styles.statsGrid, { gap: scaled(spacing.md, scale) }]}>
        <Metric label="총 작품" scale={scale} value={totalCount} />
        <Metric label="완료" scale={scale} value={completedCount} />
        <Metric label="핀" scale={scale} value={pinCount} />
        {currentYearWatchedCount !== null ? (
          <Metric label="올해 본 작품" scale={scale} value={currentYearWatchedCount} />
        ) : null}
      </View>

      <View style={[styles.block, { gap: scaled(spacing.md, scale) }]}>
        <Text style={[styles.blockTitle, { fontSize: scaled(30, scale) }]}>타입별 취향</Text>
        <View style={[styles.stackBar, { borderRadius: scaled(999, scale), height: scaled(34, scale) }]}>
          {visibleTypeStats.map((item) => (
            <View
              key={item.type}
              style={{
                backgroundColor: CONTENT_TYPE_COLORS[item.type],
                height: "100%",
                width: `${item.percent}%` as DimensionValue
              }}
            />
          ))}
        </View>
        <View style={[styles.typeRows, { gap: scaled(spacing.sm, scale) }]}>
          {visibleTypeStats.map((item) => (
            <View key={item.type} style={[styles.typeRow, { gap: scaled(spacing.sm, scale) }]}>
              <View
                style={{
                  backgroundColor: CONTENT_TYPE_COLORS[item.type],
                  borderRadius: scaled(8, scale),
                  height: scaled(16, scale),
                  width: scaled(16, scale)
                }}
              />
              <Text style={[styles.typeName, { fontSize: scaled(26, scale) }]}>{item.label}</Text>
              <Text style={[styles.typeValue, { fontSize: scaled(26, scale) }]}>
                {item.count}개 · {Math.round(item.percent)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.block, { gap: scaled(spacing.md, scale) }]}>
        <Text style={[styles.blockTitle, { fontSize: scaled(30, scale) }]}>장르 Top 3</Text>
        <View style={[styles.genreRows, { gap: scaled(spacing.sm, scale) }]}>
          {topGenres.length ? (
            topGenres.map((genre, index) => (
              <View
                key={genre.genre_name}
                style={[styles.genreRow, { borderRadius: scaled(radius.lg, scale), padding: scaled(22, scale) }]}
              >
                <Text style={[styles.genreRank, { fontSize: scaled(24, scale) }]}>{index + 1}</Text>
                <Text numberOfLines={1} style={[styles.genreName, { fontSize: scaled(28, scale) }]}>
                  {genre.genre_name}
                </Text>
                <Text style={[styles.genreCount, { fontSize: scaled(24, scale) }]}>{genre.count}개</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { fontSize: scaled(26, scale) }]}>아직 장르 기록이 없어요</Text>
          )}
        </View>
      </View>
    </View>
  );
});

function Metric({ label, value, scale }: { label: string; value: number; scale: number }) {
  return (
    <View style={[styles.metric, { borderRadius: scaled(radius.lg, scale), padding: scaled(28, scale) }]}>
      <Text style={[styles.metricValue, { fontSize: scaled(54, scale) }]}>{value}</Text>
      <Text style={[styles.metricLabel, { fontSize: scaled(22, scale) }]}>{label}</Text>
    </View>
  );
}

function scaled(value: number, scale: number): number {
  return Math.round(value * scale);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F8FAFC",
    justifyContent: "space-between",
    overflow: "hidden"
  },
  header: {},
  brand: {
    color: colors.primary,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: "#0F172A",
    fontWeight: "900"
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  metric: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(148,163,184,0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: "47%",
    flexGrow: 1
  },
  metricValue: {
    color: "#0F172A",
    fontWeight: "900"
  },
  metricLabel: {
    color: "#64748B",
    fontWeight: "800"
  },
  block: {},
  blockTitle: {
    color: "#0F172A",
    fontWeight: "900"
  },
  stackBar: {
    backgroundColor: "#E2E8F0",
    flexDirection: "row",
    overflow: "hidden"
  },
  typeRows: {},
  typeRow: {
    alignItems: "center",
    flexDirection: "row"
  },
  typeName: {
    color: "#172033",
    flex: 1,
    fontWeight: "900"
  },
  typeValue: {
    color: "#475569",
    fontWeight: "800"
  },
  genreRows: {},
  genreRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
    flexDirection: "row",
    gap: spacing.lg
  },
  genreRank: {
    color: colors.primary,
    fontWeight: "900"
  },
  genreName: {
    color: "#0F172A",
    flex: 1,
    fontWeight: "900"
  },
  genreCount: {
    color: "#64748B",
    fontWeight: "800"
  },
  emptyText: {
    color: "#64748B",
    fontWeight: "800"
  }
});
