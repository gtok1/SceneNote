import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAtom } from "jotai";

import { initialPinFormDraft, pinFormDraftAtom } from "@/atoms/pinFormAtom";
import { EMOTION_LABELS, EMOTION_OPTIONS } from "@/constants/emotions";
import { colors, radius, spacing } from "@/constants/theme";
import { useCreatePin, useDeletePin, useUpdatePin } from "@/hooks/useTimelinePins";
import type { TimelinePin } from "@/types/pins";
import { createPinSchema } from "@/utils/validation";
import { formatSecondsToTimecode, parseTimecodeToSeconds } from "@/utils/timecode";
import { SpoilerToggle } from "./SpoilerToggle";
import { TagChip } from "./TagChip";
import { TimecodeInput } from "./TimecodeInput";

interface PinComposerProps {
  contentId: string;
  episodeId?: string | null;
  episodeDurationSeconds?: number | null;
  defaultValues?: TimelinePin | null;
  mode: "create" | "edit";
  onSuccess: (pin: TimelinePin) => void;
  onCancel: () => void;
}

export function PinComposer({
  contentId,
  episodeId = null,
  episodeDurationSeconds,
  defaultValues,
  mode,
  onSuccess,
  onCancel
}: PinComposerProps) {
  const [draft, setDraft] = useAtom(pinFormDraftAtom);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      timecodeDisplay:
        defaultValues?.timestamp_seconds === null || defaultValues?.timestamp_seconds === undefined
          ? ""
          : formatSecondsToTimecode(defaultValues.timestamp_seconds),
      timestamp_seconds: defaultValues?.timestamp_seconds ?? null,
      memo: defaultValues?.memo ?? "",
      tags: defaultValues?.tags?.map((tag) => tag.name) ?? [],
      emotion: defaultValues?.emotion ?? "none",
      is_spoiler: defaultValues?.is_spoiler ?? false
    });

    return () => setDraft(initialPinFormDraft);
  }, [defaultValues, setDraft]);

  const createMutation = useCreatePin();
  const updateMutation = useUpdatePin(defaultValues?.id);
  const deleteMutation = useDeletePin();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const tagObjects = useMemo(
    () => draft.tags.map((name) => ({ id: name, name, user_id: "", created_at: "" })),
    [draft.tags]
  );

  const changeTimestampSeconds = useCallback(
    (seconds: number | null) => {
      setDraft((current) =>
        current.timestamp_seconds === seconds ? current : { ...current, timestamp_seconds: seconds }
      );
    },
    [setDraft]
  );

  const changeTimecodeDisplay = useCallback(
    (timecodeDisplay: string) => {
      setDraft((current) =>
        current.timecodeDisplay === timecodeDisplay ? current : { ...current, timecodeDisplay }
      );
    },
    [setDraft]
  );

  const addTag = () => {
    const normalized = tagInput.trim().replace(/,$/, "");
    if (!normalized || draft.tags.includes(normalized) || draft.tags.length >= 10) return;
    setDraft((current) => ({ ...current, tags: [...current.tags, normalized] }));
    setTagInput("");
  };

  const save = async () => {
    const parsedTime = parseTimecodeToSeconds(draft.timecodeDisplay);
    const result = createPinSchema.safeParse({
      timestamp_seconds: parsedTime,
      memo: draft.memo.trim() ? draft.memo.trim() : null,
      tagNames: draft.tags,
      emotion: draft.emotion,
      is_spoiler: draft.is_spoiler,
      episodeDurationSeconds
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "입력값을 확인해 주세요");
      return;
    }

    setError(null);

    try {
      const payload = {
        timestamp_seconds: result.data.timestamp_seconds,
        memo: result.data.memo,
        emotion: result.data.emotion,
        is_spoiler: result.data.is_spoiler,
        tagNames: result.data.tagNames
      };

      const pin =
        mode === "create"
          ? await createMutation.mutateAsync({ ...payload, content_id: contentId, episode_id: episodeId })
          : await updateMutation.mutateAsync(payload);

      onSuccess(pin);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "핀 저장에 실패했습니다");
    }
  };

  const remove = () => {
    if (!defaultValues?.id) return;
    Alert.alert("핀 삭제", "이 핀을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deleteMutation.mutateAsync(defaultValues.id);
          onCancel();
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{mode === "create" ? "핀 추가" : "핀 편집"}</Text>
        <Pressable accessibilityRole="button" onPress={onCancel}>
          <Text style={styles.cancel}>취소</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>시간</Text>
        <TimecodeInput
          maxSeconds={episodeDurationSeconds ?? null}
          onChangeSeconds={changeTimestampSeconds}
          onChangeText={changeTimecodeDisplay}
          value={draft.timecodeDisplay}
        />
        <Text style={styles.helper}>
          {draft.timestamp_seconds === null ? "시간 없이 메모만 저장할 수 있습니다." : "저장값은 정수 초로 변환됩니다."}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          multiline
          onChangeText={(memo) => setDraft((current) => ({ ...current, memo }))}
          placeholder="이 장면을 어떻게 기억하고 싶나요?"
          style={[styles.input, styles.memo]}
          value={draft.memo}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>태그</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
            placeholder="태그 입력 후 Enter"
            style={[styles.input, styles.tagInput]}
            value={tagInput}
          />
          <Pressable accessibilityRole="button" onPress={addTag} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>추가</Text>
          </Pressable>
        </View>
        <View style={styles.tags}>
          {tagObjects.map((tag) => (
            <TagChip
              key={tag.name}
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  tags: current.tags.filter((name) => name !== tag.name)
                }))
              }
              tag={tag}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>감정</Text>
        <View style={styles.emotions}>
          {EMOTION_OPTIONS.map((option) => {
            const selected = draft.emotion === option;
            return (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() =>
                  setDraft((current) => ({ ...current, emotion: selected ? "none" : option }))
                }
                style={[styles.emotionButton, selected && styles.emotionSelected]}
              >
                <Text style={[styles.emotionText, selected && styles.emotionTextSelected]}>
                  {EMOTION_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SpoilerToggle
        isSpoiler={draft.is_spoiler}
        onToggle={(is_spoiler) => setDraft((current) => ({ ...current, is_spoiler }))}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={save}
        style={[styles.saveButton, isSaving && styles.disabled]}
      >
        <Text style={styles.saveText}>{isSaving ? "저장 중" : "저장"}</Text>
      </Pressable>

      {mode === "edit" ? (
        <Pressable accessibilityRole="button" onPress={remove} style={styles.deleteButton}>
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  cancel: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  field: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  memo: {
    minHeight: 120,
    textAlignVertical: "top"
  },
  tagInputRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  tagInput: {
    flex: 1
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  smallButtonText: {
    color: colors.surface,
    fontWeight: "800"
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  emotions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  emotionButton: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  emotionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  emotionText: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  emotionTextSelected: {
    color: colors.surface
  },
  error: {
    color: colors.danger,
    fontSize: 13
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  disabled: {
    opacity: 0.6
  },
  saveText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "800"
  },
  deleteButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg
  },
  deleteText: {
    color: colors.danger,
    fontWeight: "800"
  }
});
