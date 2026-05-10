import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";
import {
  formatSecondsToTimecode,
  isTimeWithinEpisode,
  normalizeTimecodeInput,
  parseTimecodeToSeconds
} from "@/utils/timecode";

interface TimecodeInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onChangeSeconds: (seconds: number | null) => void;
  maxSeconds?: number | null;
  placeholder?: string;
  errorMessage?: string;
}

export function TimecodeInput({
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
    const normalized = normalizeTimecodeInput(value);
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
        accessibilityLabel="타임코드"
        keyboardType="numeric"
        onBlur={normalize}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, ""))}
        placeholder={placeholder}
        style={[styles.input, (localError || errorMessage) && styles.inputError]}
        value={value}
      />
      {localError || errorMessage ? <Text style={styles.error}>{localError ?? errorMessage}</Text> : null}
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
