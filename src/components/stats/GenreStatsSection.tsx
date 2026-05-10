import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type DimensionValue,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { PieChart } from "react-native-gifted-charts";

import { GENRE_COLORS } from "@/constants/genreColors";
import { colors, radius, spacing } from "@/constants/theme";
import { useGenreStats } from "@/hooks/useGenreStats";
import type { GenreStat } from "@/types/genre";
import { getGenreDisplayName } from "@/utils/genre";

const GRAPH_COUNT = 3;

export function GenreStatsSection() {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(280, width - spacing.lg * 2);
  const { data: stats = [], isLoading } = useGenreStats();
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setActivePage(Math.max(0, Math.min(GRAPH_COUNT - 1, page)));
  };

  const scrollToPage = useCallback((page: number, animated = true) => {
    const nextPage = Math.max(0, Math.min(GRAPH_COUNT - 1, page));
    setActivePage(nextPage);
    scrollRef.current?.scrollTo({ x: nextPage * pageWidth, animated });
  }, [pageWidth]);

  const mouseSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Platform.OS === "web" &&
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = activePage * pageWidth - gestureState.dx;
          const maxOffset = (GRAPH_COUNT - 1) * pageWidth;
          scrollRef.current?.scrollTo({
            animated: false,
            x: Math.max(0, Math.min(maxOffset, nextOffset))
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          const threshold = pageWidth * 0.18;
          if (gestureState.dx <= -threshold || gestureState.vx < -0.45) {
            scrollToPage(activePage + 1);
            return;
          }
          if (gestureState.dx >= threshold || gestureState.vx > 0.45) {
            scrollToPage(activePage - 1);
            return;
          }
          scrollToPage(activePage);
        },
        onPanResponderTerminate: () => {
          scrollToPage(activePage);
        }
      }),
    [activePage, pageWidth, scrollToPage]
  );

  if (isLoading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (stats.length === 0) return <EmptyStats />;

  const displayStats = createDisplayGenreStats(stats);
  const totalCount = displayStats.reduce((sum, stat) => sum + stat.count, 0);
  const topStats = displayStats.slice(0, 10);
  const donutData = topStats.map((item, index) => ({
    value: item.count,
    label: item.genre_name,
    color: genreColor(index)
  }));

  return (
    <View style={styles.section}>
      <Text style={styles.totalLabel}>총 {totalCount}개 작품 등록됨</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        onScroll={handleScroll}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        {...(Platform.OS === "web" ? mouseSwipeResponder.panHandlers : {})}
      >
        <View style={[styles.page, { width: pageWidth }]}>
          <Text style={styles.pageTitle}>장르 비율</Text>
          <View style={styles.chartCenter}>
            <PieChart
              centerLabelComponent={() => (
                <View style={styles.donutCenter}>
                  <Text style={styles.donutCount}>{totalCount}</Text>
                  <Text style={styles.donutLabel}>작품</Text>
                </View>
              )}
              data={donutData}
              donut
              innerRadius={62}
              radius={104}
            />
          </View>
          <View style={styles.legend}>
            {donutData.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text numberOfLines={1} style={styles.legendText}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.page, { width: pageWidth }]}>
          <Text style={styles.pageTitle}>장르별 작품 수</Text>
          <View style={styles.barList}>
            {topStats.map((item, index) => (
              <BarStatRow
                color={genreColor(index)}
                count={item.count}
                key={item.genre_name}
                max={topStats[0]?.count ?? 0}
                name={item.genre_name}
              />
            ))}
          </View>
        </View>

        <View style={[styles.page, { width: pageWidth }]}>
          <Text style={styles.pageTitle}>장르 랭킹</Text>
          {topStats.map((item, index) => (
            <RankingRow
              color={genreColor(index)}
              count={item.count}
              key={item.genre_name}
              max={topStats[0]?.count ?? 0}
              name={item.genre_name}
              rank={index + 1}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.dots}>
        {Array.from({ length: GRAPH_COUNT }).map((_, index) => (
          <View key={index} style={[styles.dot, activePage === index ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

function BarStatRow({
  name,
  count,
  max,
  color
}: {
  name: string;
  count: number;
  max: number;
  color: string;
}) {
  const barWidth = max > 0 ? `${(count / max) * 100}%` : "0%";
  const barWidthStyle = barWidth as DimensionValue;

  return (
    <View style={styles.barStatRow}>
      <View style={styles.barStatHeader}>
        <Text numberOfLines={1} style={styles.barStatName}>
          {name}
        </Text>
        <Text style={styles.barStatCount}>{count}개</Text>
      </View>
      <View style={styles.barStatTrack}>
        <View style={[styles.barStatFill, { backgroundColor: color, width: barWidthStyle }]} />
      </View>
    </View>
  );
}

function RankingRow({
  rank,
  name,
  count,
  max,
  color
}: {
  rank: number;
  name: string;
  count: number;
  max: number;
  color: string;
}) {
  const barWidth = max > 0 ? `${(count / max) * 100}%` : "0%";
  const barWidthStyle = barWidth as DimensionValue;

  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <Text numberOfLines={1} style={styles.rankName}>
        {name}
      </Text>
      <View style={styles.rankBarBg}>
        <View style={[styles.rankBar, { backgroundColor: color, width: barWidthStyle }]} />
      </View>
      <Text style={styles.rankCount}>{count}개</Text>
    </View>
  );
}

function EmptyStats() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>라이브러리에 작품을 추가하면{"\n"}장르 통계를 볼 수 있어요</Text>
    </View>
  );
}

function genreColor(index: number): string {
  return GENRE_COLORS[index % GENRE_COLORS.length] ?? colors.primary;
}

function createDisplayGenreStats(stats: GenreStat[]): GenreStat[] {
  const counts = new Map<string, number>();

  stats.forEach((stat) => {
    const displayName = getGenreDisplayName(stat.genre_name);
    if (!displayName) return;

    counts.set(displayName, (counts.get(displayName) ?? 0) + Number(stat.count));
  });

  return Array.from(counts, ([genre_name, count]) => ({ genre_name, count })).sort(
    (a, b) => b.count - a.count || a.genre_name.localeCompare(b.genre_name, "ko-KR")
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  totalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  page: {
    gap: spacing.md,
    minHeight: 360,
    padding: spacing.lg
  },
  pageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  barList: {
    gap: spacing.md
  },
  barStatRow: {
    gap: spacing.xs
  },
  barStatHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  barStatName: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  barStatCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  barStatTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 12,
    overflow: "hidden"
  },
  barStatFill: {
    borderRadius: radius.sm,
    height: 12
  },
  chartCenter: {
    alignItems: "center"
  },
  donutCenter: {
    alignItems: "center",
    justifyContent: "center"
  },
  donutCount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  donutLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    maxWidth: "46%"
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  legendText: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    paddingBottom: spacing.lg
  },
  dot: {
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 6,
    width: 6
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18
  },
  rankRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rankNum: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    width: 24
  },
  rankName: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  rankBarBg: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 3,
    flex: 2,
    height: 6,
    overflow: "hidden"
  },
  rankBar: {
    borderRadius: 3,
    height: 6
  },
  rankCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    width: 42
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 120,
    justifyContent: "center",
    padding: spacing.lg
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  }
});
