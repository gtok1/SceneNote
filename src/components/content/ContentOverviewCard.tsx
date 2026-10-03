import { useState } from "react";
import { Pressable, Text } from "react-native";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { colors, typography } from "@/constants/theme";
export function ContentOverviewCard({ overview }: { overview: string | null }) {
  const [expanded, setExpanded] = useState(false);
  return <DashboardPanel title="줄거리">
    <Text style={[typography.body, { color: overview ? colors.text : colors.textMuted, lineHeight: 22 }]} numberOfLines={expanded ? undefined : 4}>{overview || "줄거리 정보가 없습니다."}</Text>
    {overview ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={[typography.label, { color: colors.primary }]}>{expanded ? "접기" : "더보기"}</Text></Pressable> : null}
  </DashboardPanel>;
}
