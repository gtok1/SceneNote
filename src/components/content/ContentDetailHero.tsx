import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppImage } from "@/components/common/AppImage";
import { GenreBadgeList } from "@/components/GenreBadge";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";

interface ContentDetailHeroProps {
  title: string; originalTitle: string | null; posterUrl: string | null;
  metaItems: string[]; genres: string[]; warning: string | null;
  poster: { width: number; height: number }; children?: ReactNode;
}
export function ContentDetailHero({ title, originalTitle, posterUrl, metaItems, genres, warning, poster, children }: ContentDetailHeroProps) {
  const wide = poster.width >= 160;
  return <View style={styles.card}>
    <View style={styles.row}>
      <AppImage source={posterUrl ? { uri: posterUrl } : null} contentFit="cover" style={[styles.poster, poster]} />
      <View style={styles.copy}>
        <Text style={[wide ? typography.display : typography.title, styles.text]}>{title}</Text>
        {originalTitle && originalTitle !== title ? <Text numberOfLines={2} style={[typography.body, styles.muted]}>{originalTitle}</Text> : null}
        {metaItems.length ? <View style={styles.meta}>
          <Text style={styles.badge}>{metaItems[0]}</Text>
          {metaItems.length > 1 ? <Text style={[typography.caption, styles.muted]}>{metaItems.slice(1).join(" · ")}</Text> : null}
        </View> : null}
        {genres.length ? <GenreBadgeList genres={genres} maxVisible={genres.length} /> : null}
        {warning ? <Text style={[typography.caption, { color: colors.warning }]}>{warning}</Text> : null}
        {wide ? children : null}
      </View>
    </View>
    {!wide ? children : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, ...elevation.card },
  row: { flexDirection: "row", gap: spacing.lg },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  badge: { ...typography.micro, backgroundColor: colors.primarySoft, color: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8 },
  text: { color: colors.text }, muted: { color: colors.textMuted }
});
