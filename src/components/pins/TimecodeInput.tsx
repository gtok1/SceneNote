import { useEffect, useState, type Ref } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import {
  formatSecondsToTimecode,
  isTimeWithinEpisode,
  resolveTimecodeInput,
  parseTimecodeToSeconds
} from "@/utils/timecode";

interface TimecodeInputProps {
  inputRef?: Ref<TextInput>;
  editable?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onChangeSeconds: (seconds: number | null) => void;
  maxSeconds?: number | null;
  placeholder?: string;
  errorMessage?: string | undefined;
}

export function TimecodeInput({
  inputRef,
  editable = true,
  value,
  onChangeText,
  onChangeSeconds,
  maxSeconds,
  placeholder = "00:00",
  errorMessage
}: TimecodeInputProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const seconds = parseTimecodeToSeconds(value);
    onChangeSeconds(seconds);
  }, [onChangeSeconds, value]);

  const normalize = () => {
    const normalized = resolveTimecodeInput(value, "blur").text;
    onChangeText(normalized);
    const seconds = parseTimecodeToSeconds(normalized);
    onChangeSeconds(seconds);

    if (!normalized) {
      setLocalError(null);
      return;
    }

    if (seconds === null) {
      setLocalError("MM:SS 또는 HH:MM:SS 형식으로 입력해 주세요");
      return;
    }

    if (!isTimeWithinEpisode(seconds, maxSeconds)) {
      setLocalError(
        `입력한 시간(${formatSecondsToTimecode(seconds)})이 에피소드 길이(${formatSecondsToTimecode(
          maxSeconds ?? 0
        )})를 초과했습니다`
      );
      return;
    }

    setLocalError(null);
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        editable={editable}
        accessibilityLabel="시간"
        aria-describedby="pin-time-error"
        aria-invalid={Boolean(localError || errorMessage)}
        keyboardType="numeric"
        onBlur={normalize}
        onChangeText={(text) => { setLocalError(null); onChangeText(resolveTimecodeInput(text, "change").text); }}
        placeholder={placeholder}
        style={[styles.input, (localError || errorMessage) && styles.inputError]}
        value={value}
      />
      {localError || errorMessage ? <Text nativeID="pin-time-error" accessibilityRole="alert" style={styles.error}>{localError ?? errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  inputError: {
    borderColor: colors.danger
  },
  error: {
    color: colors.danger,
    fontSize: 12
  }
});
