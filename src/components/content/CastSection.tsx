import { Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { CastMember } from "@/types/content";
import { resolveCastMemberPerson } from "@/utils/peopleScreen";
interface CastSectionProps { cast: CastMember[]; isAnime: boolean; favoriteKeys: ReadonlySet<string>; columns: 1 | 2; onOpen: (member: CastMember) => void }
export function CastSection({ cast, isAnime, favoriteKeys, columns, onOpen }: CastSectionProps) {
  return <DashboardPanel title={isAnime ? "성우" : "출연 배우"} subtitle="누르면 인물 정보를 확인하고 좋아하는 인물로 등록할 수 있어요.">
    <View style={styles.grid}>{cast.slice(0, 8).map(member => {
      const registered = favoriteKeys.has(resolveCastMemberPerson(member, isAnime).key);
      return <Pressable key={`${member.id}:${member.character ?? ""}`} accessibilityRole="button" accessibilityLabel={`${member.name} 인물 상세 보기${registered ? ", 등록됨" : ""}`} onPress={() => onOpen(member)} style={[styles.item, { width: columns === 2 ? "48.5%" : "100%", backgroundColor: registered ? colors.primarySoft : colors.surfaceMuted }]}>
        <PersonAvatar name={member.name} profileUrl={member.profile_url} size={40} />
        <View style={styles.copy}>
          <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{member.name}</Text>{registered ? <Text style={styles.badge}>등록됨</Text> : null}</View>
          {member.original_name && member.original_name !== member.name ? <Text numberOfLines={1} style={styles.detail}>{member.original_name}</Text> : null}
          {member.character ? <Text numberOfLines={1} style={styles.detail}>{member.character}</Text> : null}
        </View>
      </Pressable>;
    })}</View>
  </DashboardPanel>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, minHeight: 56 },
  copy: { flex: 1, minWidth: 0 }, nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { ...typography.label, color: colors.text, flexShrink: 1 }, detail: { ...typography.caption, color: colors.textMuted },
  badge: { ...typography.micro, color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs }
});
