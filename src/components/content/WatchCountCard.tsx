import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DashboardPanel } from "@/components/profile/DashboardPanel";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { describeWatchCountSaveState, resolveWatchCountSaveState } from "@/utils/watchCountInput";
interface WatchCountCardProps { watchCount: number; isCompleted: boolean; isSaving: boolean; onSave: (watchCount: number) => void }
export function WatchCountCard({ watchCount, isCompleted, isSaving, onSave }: WatchCountCardProps) {
  const [value, setValue] = useState(String(watchCount));
  const saveState = resolveWatchCountSaveState(value, watchCount, isCompleted);
  const blockedReason = describeWatchCountSaveState(saveState);
  const canSave = saveState.kind === "savable";
  useEffect(() => { setValue(String(watchCount)); }, [watchCount]);
  const submit = () => { if (saveState.kind !== "savable") return; onSave(saveState.value); };
  return <DashboardPanel title="본 횟수" accessory={<Text style={[typography.label, styles.muted]}>{watchCount}회</Text>}>
    <View style={styles.row}>
      <TextInput accessibilityLabel="작품을 본 횟수 입력" editable={!isSaving} inputMode="numeric" keyboardType="number-pad" onChangeText={text => setValue(text.replace(/\D/g, ""))} onSubmitEditing={submit} selectTextOnFocus style={styles.input} value={value} />
      <Text style={[typography.body, styles.muted]}>회</Text>
      <Pressable accessibilityRole="button" disabled={isSaving || !canSave} onPress={submit} style={[styles.save, isSaving || !canSave ? { opacity: 0.5 } : null]}><Text style={[typography.label, { color: colors.surface }]}>{isSaving ? "저장 중" : "저장"}</Text></Pressable>
    </View>
    {blockedReason ? <Text style={[typography.caption, styles.muted]}>{blockedReason}</Text> : null}
  </DashboardPanel>;
}
const styles = StyleSheet.create({
  muted: { color: colors.textMuted }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { ...typography.headline, color: colors.text, height: 44, width: 72, textAlign: "center", backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  save: { height: 44, justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.pill }
});
