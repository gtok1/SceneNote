import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { PersonAvatar } from "@/components/people/PersonAvatar";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";

interface ProfileHeaderCardProps {
  displayName: string;
  email: string | null;
  isEditing: boolean;
  draft: string;
  saving: boolean;
  onChangeDraft: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  accessory?: ReactNode;
}

export function ProfileHeaderCard({
  displayName,
  email,
  isEditing,
  draft,
  saving,
  onChangeDraft,
  onStartEdit,
  onSave,
  onCancel,
  accessory
}: ProfileHeaderCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <PersonAvatar name={displayName} profileUrl={null} size={56} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName}
          </Text>
          <Text numberOfLines={1} style={styles.email}>
            {email ?? "개인 감상 기록"}
          </Text>
        </View>
        {isEditing ? null : (
          <Pressable accessibilityRole="button" onPress={onStartEdit} style={styles.editButton}>
            <Ionicons color={colors.primary} name="create-outline" size={16} />
            <Text style={styles.editText}>닉네임 변경</Text>
          </Pressable>
        )}
        {accessory}
      </View>
      {isEditing ? (
        <View style={styles.editor}>
          <TextInput
            accessibilityLabel="닉네임"
            autoCapitalize="none"
            maxLength={24}
            onChangeText={onChangeDraft}
            onSubmitEditing={onSave}
            placeholder="닉네임"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="done"
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onSave}
            style={[styles.saveButton, saving ? styles.disabled : null]}
          >
            <Text style={styles.saveText}>{saving ? "저장 중" : "저장"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCancel}
            style={[styles.cancelButton, saving ? styles.disabled : null]}
          >
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
    ...elevation.card
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 120
  },
  name: {
    ...typography.title,
    color: colors.text
  },
  email: {
    ...typography.caption,
    color: colors.textMuted
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  editText: {
    ...typography.label,
    color: colors.primary
  },
  editor: {
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
    outlineStyle: "none" as never,
    paddingHorizontal: spacing.md
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  saveText: {
    ...typography.label,
    color: colors.surface
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  cancelText: {
    ...typography.label,
    color: colors.text
  },
  disabled: {
    opacity: 0.5
  }
});
