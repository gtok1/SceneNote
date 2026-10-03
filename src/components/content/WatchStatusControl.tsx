import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { WatchStatus } from "@/types/library";
import type { createWatchStatusControlModel } from "@/utils/contentDetailView";

interface WatchStatusControlProps { model: ReturnType<typeof createWatchStatusControlModel>; pending: boolean; onSelect: (status: WatchStatus) => void }
export function WatchStatusControl({ model, pending, onSelect }: WatchStatusControlProps) {
  return <View style={[styles.control, pending ? { opacity: 0.6 } : null]}>
    <Text style={[typography.label, styles.muted]}>{model.title}</Text>
    {model.hint ? <Text style={[typography.caption, styles.muted]}>{model.hint}</Text> : null}
    <View style={styles.row}>
      <View style={styles.track}>{model.primary.map(({ status, label, selected }) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected, disabled: pending }} disabled={pending} onPress={() => !pending && onSelect(status)} style={[styles.segment, selected ? styles.selected : null]}>
        <Text style={[typography.label, { color: selected ? colors.text : colors.textMuted }]}>{label}</Text>
      </Pressable>)}</View>
      {model.secondary.map(({ status, label, selected }) => {
        const positive = status === "recommended";
        const color = selected ? positive ? colors.success : colors.danger : colors.textMuted;
        return <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected, disabled: pending }} disabled={pending} onPress={() => !pending && onSelect(status)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} style={[styles.toggle, selected ? { backgroundColor: positive ? colors.successSoft : colors.dangerSoft, borderColor: positive ? colors.successSoft : colors.dangerSoft } : null]}>
          <Ionicons name={positive ? "thumbs-up-outline" : "thumbs-down-outline"} size={14} color={color} />
          <Text style={[typography.label, { color }]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  control: { gap: spacing.sm }, muted: { color: colors.textMuted },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  track: { flexGrow: 1, minWidth: 260, flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 4, height: 44 },
  segment: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: radius.pill },
  selected: { backgroundColor: colors.surface, ...elevation.card },
  toggle: { height: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
});
