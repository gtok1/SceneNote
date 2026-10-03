import { Pressable, StyleSheet, Text, View } from "react-native";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { CastMember } from "@/types/content";
interface CastSectionProps { cast: CastMember[]; isAnime: boolean; favoriteKeys: ReadonlySet<string>; pending: boolean; columns: 1 | 2; onAdd: (member: CastMember) => void; onOpen: (member: CastMember) => void }
export function CastSection({ cast, isAnime, favoriteKeys, pending, columns, onAdd, onOpen }: CastSectionProps) {
  return <DashboardPanel title={isAnime ? "성우" : "출연 배우"} subtitle="누르면 좋아하는 인물에 등록돼요. 등록된 인물은 상세로 이동해요.">
    <View style={styles.grid}>{cast.slice(0, 8).map(member => {
      const registered = favoriteKeys.has(`${isAnime ? "anilist" : "tmdb"}:${member.id}`);
      return <Pressable key={`${member.id}:${member.character ?? ""}`} accessibilityRole="button" accessibilityState={{ selected: registered }} disabled={pending} onPress={() => registered ? onOpen(member) : onAdd(member)} style={[styles.item, { width: columns === 2 ? "48.5%" : "100%", backgroundColor: registered ? colors.primarySoft : colors.surfaceMuted }, pending ? { opacity: 0.6 } : null]}>
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
