import { useAppUIStore } from "@/stores/appUIStore";
import { isPinDraftDirty } from "@/utils/pinDraft";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePinContext } from "@/hooks/usePinContext";
import { getPinContext } from "@/services/pinContext";
import { confirmDiscard } from "@/utils/confirmDiscard";
import { useNetworkState } from "expo-network";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAtom } from "jotai";

import { initialPinFormDraft, pinFormDraftAtom } from "@/atoms/pinFormAtom";
import { EMOTION_LABELS, EMOTION_OPTIONS } from "@/constants/emotions";
import { colors, radius, spacing } from "@/constants/theme";
import { useCreatePin, useDeletePin, useUpdatePin } from "@/hooks/useTimelinePins";
import type { TimelinePin } from "@/types/pins";
import { createPinSchema } from "@/utils/validation";
import { resolveTimecodeInput, formatSecondsToTimecode } from "@/utils/timecode";
import { SpoilerToggle } from "./SpoilerToggle";
import { TagChip } from "./TagChip";
import { TimecodeInput } from "./TimecodeInput";

interface PinComposerProps {
  contentId: string;
  episodeId?: string | null;
  defaultValues?: TimelinePin | null;
  mode: "create" | "edit";
  onSuccess: (pin: TimelinePin) => void;
  onCancel: () => void;
}

export function PinComposer({
  contentId,
  episodeId = null,
  defaultValues,
  mode,
  onSuccess,
  onCancel
}: PinComposerProps) {
  const addToast = useAppUIStore(state => state.addToast);
  const [draft, setDraft] = useAtom(pinFormDraftAtom);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const context = usePinContext(contentId, episodeId);
  const episodeDurationSeconds = context.data?.duration ?? null;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const network = useNetworkState();
  const saveLock = useRef(false);
  const timeRef = useRef<TextInput>(null);
  const memoRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [tagError, setTagError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leaveAction = useRef<(() => void) | null>(null);
  const [initialDraft] = useState(() => ({
    timestamp_seconds: defaultValues?.timestamp_seconds ?? null,
    timecodeDisplay: defaultValues?.timestamp_seconds == null ? "" : formatSecondsToTimecode(defaultValues.timestamp_seconds),
    memo: defaultValues?.memo ?? "", tags: defaultValues?.tags?.map(tag => tag.name) ?? [],
    emotion: defaultValues?.emotion ?? "none", is_spoiler: defaultValues?.is_spoiler ?? false
  }));
  const dirty = isPinDraftDirty(draft, initialDraft, tagInput);
  const leave = (action: () => void) => { leaveAction.current = action; setLeaving(true); };

  useEffect(() => {
    setDraft(initialDraft);

    return () => setDraft(initialPinFormDraft);
  }, [initialDraft, setDraft]);

  const createMutation = useCreatePin();
  const updateMutation = useUpdatePin(defaultValues?.id);
  const deleteMutation = useDeletePin();
  const [checking, setChecking] = useState(false);
  const isSaving = checking || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  usePreventRemove(!leaving && (dirty || isSaving), ({ data }) => {
    if (saveLock.current || isSaving) return;
    confirmDiscard(() => leave(() => navigation.dispatch(data.action)));
  });
  useEffect(() => { if (leaving) leaveAction.current?.(); }, [leaving]);
  const cancel = () => {
    if (isSaving || saveLock.current) return;
    if (dirty) confirmDiscard(() => leave(onCancel));
    else leave(onCancel);
  };
  useEffect(() => {
    if (Platform.OS !== "web" || leaving || (!dirty && !isSaving)) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, isSaving, leaving]);

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
      setTimeError(undefined);
      setError(null);
      setDraft((current) =>
        current.timecodeDisplay === timecodeDisplay ? current : { ...current, timecodeDisplay }
      );
    },
    [setDraft]
  );

  const addTag = () => {
    if (isSaving) return;
    const normalized = tagInput.trim().replace(/,$/, "");
    const reason = !normalized ? "태그를 입력해 주세요." : normalized.length > 20 ? "태그는 20자까지 입력할 수 있어요." : draft.tags.includes(normalized) ? "이미 추가한 태그입니다." : draft.tags.length >= 10 ? "태그는 10개까지 추가할 수 있어요." : null;
    setTagError(reason);
    if (reason) return;
    setDraft((current) => ({ ...current, tags: [...current.tags, normalized] }));
    setTagInput("");
  };

  const save = async () => {
    if (saveLock.current || isSaving) return;
    if (network.isConnected === false || network.isInternetReachable === false) { setError("인터넷 연결 후 다시 저장해 주세요."); return; }
    const timecode = resolveTimecodeInput(draft.timecodeDisplay, "save");
    if (timecode.kind === "invalid_nonempty") {
      setTimeError("시간은 MM:SS 또는 HH:MM:SS 형식으로 입력해 주세요");
      scrollRef.current?.scrollTo({ y: 0, animated: true }); timeRef.current?.focus();
      return;
    }
    const result = createPinSchema.safeParse({
      timestamp_seconds: timecode.seconds,
      memo: draft.memo.trim() ? draft.memo.trim() : null,
      tagNames: draft.tags,
      emotion: draft.emotion,
      is_spoiler: draft.is_spoiler,
      episodeDurationSeconds: null
    });

    if (!result.success) {
      const issue = result.error.issues[0];
      setError(issue?.message ?? "입력값을 확인해 주세요");
      if (issue?.path[0] === "timestamp_seconds") { setTimeError(issue.message); scrollRef.current?.scrollTo({ y: 0, animated: true }); timeRef.current?.focus(); }
      else memoRef.current?.focus();
      return;
    }

    setError(null);

    saveLock.current = true;
    setChecking(true);
    try {
      const latestContext = await getPinContext(contentId, episodeId);
      const checked = createPinSchema.safeParse({ ...result.data, episodeDurationSeconds: latestContext.duration });
      if (!checked.success) { setTimeError(checked.error.issues[0]?.message); scrollRef.current?.scrollTo({ y: 0, animated: true }); timeRef.current?.focus(); return; }
      changeTimecodeDisplay(timecode.text);
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

      addToast("핀을 저장했어요.", "success");
      leave(() => onSuccess(pin));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "핀 저장에 실패했습니다");
    } finally { saveLock.current = false; setChecking(false); }
  };

  const remove = () => {
    if (!defaultValues?.id || isSaving) return;
    if (Platform.OS === "web") {
      if (window.confirm("이 핀을 삭제하시겠습니까?")) {
        deleteMutation.mutate(defaultValues.id, { onSuccess: () => leave(onCancel), onError: caught => setError(caught.message) });
      }
      return;
    }
    Alert.alert("핀 삭제", "이 핀을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try { await deleteMutation.mutateAsync(defaultValues.id); leave(onCancel); } catch (caught) { setError(caught instanceof Error ? caught.message : "삭제에 실패했습니다"); }
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{mode === "create" ? "핀 추가" : "핀 편집"}</Text>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={cancel} style={{ minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" }}>
          <Text style={styles.cancel}>취소</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>{context.data ? `${context.data.title} · ${context.data.label}` : context.isError ? context.error.message : "작품·회차 확인 중"}</Text>
      {context.isError ? <Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} onPress={() => context.refetch()}><Text>다시 확인</Text></Pressable> : null}
      <View style={styles.field}>
        <Text style={styles.label}>시간</Text>
        <TimecodeInput
          editable={!isSaving}
          inputRef={timeRef}
          errorMessage={timeError}
          maxSeconds={episodeDurationSeconds ?? null}
          onChangeSeconds={changeTimestampSeconds}
          onChangeText={changeTimecodeDisplay}
          value={draft.timecodeDisplay}
        />
        <Text style={styles.helper}>
          {context.isPending ? "작품·회차를 확인하는 중입니다." : context.isError ? "정보 조회에 실패했습니다. 다시 확인 후 저장해 주세요." : episodeId && !episodeDurationSeconds ? "회차 길이 정보가 없습니다. 시간 형식을 확인해 주세요." : "시간 없이 메모만 저장할 수도 있어요."}
          {"\n1432 → 14:32, 90 → 01:30"}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!isSaving}
          accessibilityLabel="메모"
          ref={memoRef}
          maxLength={500}
          multiline
          onChangeText={(memo) => setDraft((current) => ({ ...current, memo }))}
          placeholder="이 장면을 어떻게 기억하고 싶나요?"
          style={[styles.input, styles.memo]}
          value={draft.memo}
        />
        <Text style={styles.helper}>{draft.memo.length}/500자</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>태그 · 20자 / 최대 10개 ({draft.tags.length}/10)</Text>
        {tagError ? <Text accessibilityRole="alert" style={styles.error}>{tagError}</Text> : null}
        <View style={styles.tagInputRow}>
          <TextInput
          editable={!isSaving}
            accessibilityLabel="새 태그"
            onChangeText={(text) => { setTagInput(text); setTagError(null); }}
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
                disabled={isSaving}
                accessibilityState={{ selected, disabled: isSaving }}
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
        onToggle={(is_spoiler) => { if (!isSaving) setDraft((current) => ({ ...current, is_spoiler })); }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}


      {mode === "edit" ? (
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={remove} style={styles.deleteButton}>
          <Text style={styles.deleteText}>삭제</Text>
        </Pressable>
      ) : null}
    </ScrollView>
    <View style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface }}>
      <Pressable
        accessibilityRole="button"
        disabled={isSaving || context.isPending || context.isError}
        accessibilityState={{ disabled: isSaving || context.isPending || context.isError, busy: isSaving }}
        onPress={save}
        style={[styles.saveButton, isSaving && styles.disabled]}
      >
        <Text style={styles.saveText}>{isSaving ? "저장 중" : "저장"}</Text>
      </Pressable>

    </View>
    </KeyboardAvoidingView>
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
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
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
