import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { pinListLabel } from "@/utils/contentDetailView";
interface ContentActionBarProps { isMovie: boolean; pinCount: number | null | undefined; onOpenEpisodes: () => void; onAddMoviePin: () => void; onOpenPins: () => void; onOpenList: () => void }
export function ContentActionBar({ isMovie, pinCount, onOpenEpisodes, onAddMoviePin, onOpenPins, onOpenList }: ContentActionBarProps) {
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" onPress={isMovie ? onAddMoviePin : onOpenEpisodes} style={[styles.button, { backgroundColor: colors.primary }]}>
      <Ionicons name={isMovie ? "pin-outline" : "list-outline"} size={16} color={colors.surface} /><Text style={[typography.label, { color: colors.surface }]}>{isMovie ? "영화 핀 추가" : "에피소드 보기"}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onOpenPins} style={[styles.button, styles.secondary]}><Ionicons name="pin-outline" size={16} color={colors.text} /><Text style={[typography.label, { color: colors.text }]}>{pinListLabel(pinCount)}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onOpenList} style={styles.button}><Ionicons name="arrow-back" size={16} color={colors.textMuted} /><Text style={[typography.label, { color: colors.textMuted }]}>목록으로</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }
});
