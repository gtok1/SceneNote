import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "@/constants/theme";
import type { PersonReadingStatus } from "@/utils/japaneseName";
import { KOREAN_NAME_MAX_LENGTH, koreanNameCaption, normalizeKoreanNameInput } from "@/utils/personKoreanName";

interface KoreanNameEditorProps {
  status: PersonReadingStatus;
  favorited: boolean;
  currentKoreanName: string | null;
  saving: boolean;
  onSave: (value: string) => void;
  onReset: () => void;
}

export function KoreanNameEditor({ status, favorited, currentKoreanName, saving, onSave, onReset }: KoreanNameEditorProps) {
  const { caption, actionLabel } = koreanNameCaption(status, favorited);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!caption && !actionLabel) return null;

  const startEditing = () => {
    setDraft(currentKoreanName ?? "");
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const result = normalizeKoreanNameInput(draft);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setEditing(false);
    onSave(result.value);
  };

  return (
    <View style={styles.container}>
      {!editing ? (
        <View style={styles.captionRow}>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          {actionLabel ? (
            <Pressable accessibilityRole="button" onPress={startEditing} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View>
          <View style={styles.editRow}>
            <TextInput
              accessibilityLabel="한글 이름"
              autoCorrect={false}
              maxLength={KOREAN_NAME_MAX_LENGTH}
              onChangeText={(value) => {
                setDraft(value);
                setError(null);
              }}
              onSubmitEditing={save}
              placeholder="예: 나가세 토모야"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="done"
              style={styles.input}
              value={draft}
            />
            <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.pill, styles.saveButton]}>
              <Text style={styles.saveLabel}>{saving ? "저장 중" : "저장"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditing(false)} style={[styles.pill, styles.cancelButton]}>
              <Text style={styles.cancelLabel}>취소</Text>
            </Pressable>
          </View>
          {status === "user" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(false);
                onReset();
              }}
              style={styles.textButton}
            >
              <Text style={styles.textButtonLabel}>자동 표기로 되돌리기</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs
  },
  captionRow: {
    alignItems: "center",
    columnGap: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap"
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted
  },
  textButton: {
    justifyContent: "center",
    minHeight: 44
  },
  textButtonLabel: {
    ...typography.label,
    color: colors.primary
  },
  editRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.text,
    flexGrow: 1,
    height: 44,
    minWidth: 180,
    paddingHorizontal: spacing.md
  },
  pill: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  saveButton: {
    backgroundColor: colors.primary
  },
  saveLabel: {
    ...typography.label,
    color: colors.surface
  },
  cancelButton: {
    backgroundColor: colors.surfaceMuted
  },
  cancelLabel: {
    ...typography.label,
    color: colors.text
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs
  }
});
