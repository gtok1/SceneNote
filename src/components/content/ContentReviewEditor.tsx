import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { YearSelect } from "@/components/common/YearSelect";
import { RatingInput } from "@/components/form/RatingInput";
import { colors, radius, spacing } from "@/constants/theme";
import { useUpdateLibraryWatchDates } from "@/hooks/useLibrary";
import { useContentReview, useSaveContentReview } from "@/hooks/useReviews";

interface ContentReviewEditorProps {
  contentId: string;
  libraryItemId: string;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  contentAirDate: string | null;
  contentEndDate: string | null;
  contentAirYear: number | null;
  onSaved: () => void;
}

interface WatchDateParts {
  year: string;
  month: string;
  day: string;
}

interface ReleaseWatchDate extends WatchDateParts {
  isoDate: string;
  yearNumber: number;
}

const EMPTY_WATCH_DATE: WatchDateParts = { year: "", month: "", day: "" };

export function ContentReviewEditor({
  contentId,
  libraryItemId,
  firstWatchedAt,
  lastWatchedAt,
  contentAirDate,
  contentEndDate,
  contentAirYear,
  onSaved
}: ContentReviewEditorProps) {
  const review = useContentReview(contentId);
  const saveReview = useSaveContentReview(contentId);
  const saveWatchDates = useUpdateLibraryWatchDates();
  const [rating, setRating] = useState<number | null>(null);
  const [oneLineReview, setOneLineReview] = useState("");
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [firstWatchedDate, setFirstWatchedDate] = useState<WatchDateParts>(EMPTY_WATCH_DATE);
  const [lastWatchedDate, setLastWatchedDate] = useState<WatchDateParts>(EMPTY_WATCH_DATE);
  const releaseWatchDate = useMemo(() => createReleaseWatchDate(contentAirDate), [contentAirDate]);
  const completionWatchDate = useMemo(
    () => createCompletionWatchDate(contentEndDate, releaseWatchDate),
    [contentEndDate, releaseWatchDate]
  );
  const releaseYear = releaseWatchDate?.yearNumber ?? normalizeYear(contentAirYear);

  useEffect(() => {
    if (review.isLoading) return;

    setRating(review.data?.rating ?? null);
    setOneLineReview(review.data?.one_line_review ?? "");
    setBody(review.data?.body ?? "");
    setIsSpoiler(review.data?.is_spoiler ?? false);
  }, [
    review.data?.body,
    review.data?.is_spoiler,
    review.data?.one_line_review,
    review.data?.rating,
    review.isLoading
  ]);

  useEffect(() => {
    setFirstWatchedDate(parseWatchDateParts(firstWatchedAt, releaseWatchDate));
    setLastWatchedDate(parseWatchDateParts(lastWatchedAt, completionWatchDate));
  }, [completionWatchDate, firstWatchedAt, lastWatchedAt, releaseWatchDate]);

  const submit = async () => {
    let nextFirstWatchedAt: string | null;
    let nextLastWatchedAt: string | null;
    try {
      nextFirstWatchedAt = toIsoWatchDate(firstWatchedDate, "처음 본 시기", releaseWatchDate?.isoDate);
      nextLastWatchedAt = toIsoWatchDate(
        lastWatchedDate,
        "마지막 본 시기",
        completionWatchDate?.isoDate ?? releaseWatchDate?.isoDate
      );
      if (nextFirstWatchedAt && nextLastWatchedAt && nextFirstWatchedAt > nextLastWatchedAt) {
        throw new Error("처음 본 시기가 마지막 본 시기보다 늦을 수 없습니다.");
      }
    } catch (error) {
      Alert.alert("본 시기 확인", error instanceof Error ? error.message : "본 시기를 확인해 주세요.");
      return;
    }

    const hasReviewInput = rating !== null || oneLineReview.trim().length > 0 || body.trim().length > 0;
    const hasWatchDateChange =
      nextFirstWatchedAt !== (firstWatchedAt ?? null) || nextLastWatchedAt !== (lastWatchedAt ?? null);
    if (!hasReviewInput && !hasWatchDateChange) {
      onSaved();
      return;
    }

    try {
      if (hasReviewInput) {
        const savedReview = await saveReview.mutateAsync({
          content_id: contentId,
          rating,
          one_line_review: oneLineReview,
          body,
          is_spoiler: isSpoiler
        });
        setRating(savedReview.rating);
        setOneLineReview(savedReview.one_line_review ?? "");
        setBody(savedReview.body ?? "");
        setIsSpoiler(savedReview.is_spoiler);
      }

      if (hasWatchDateChange) {
        await saveWatchDates.mutateAsync({
          libraryItemId,
          firstWatchedAt: nextFirstWatchedAt,
          lastWatchedAt: nextLastWatchedAt
        });
      }

      onSaved();
    } catch (error) {
      Alert.alert("저장 실패", error instanceof Error ? error.message : "감상 기록을 저장하지 못했습니다.");
    }
  };

  const pending = review.isLoading || saveReview.isPending || saveWatchDates.isPending;

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>내 감상</Text>
        <Text style={styles.ratingText}>{rating ? `${rating}/10` : "별점 없음"}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>별점</Text>
        <RatingInput value={rating} onChange={setRating} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>한줄 후기</Text>
        <TextInput
          editable={!pending}
          maxLength={120}
          onChangeText={setOneLineReview}
          placeholder="짧게 남기는 한 문장"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={oneLineReview}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>소감</Text>
        <TextInput
          editable={!pending}
          maxLength={2000}
          multiline
          onChangeText={setBody}
          placeholder="보고 난 뒤 남기고 싶은 감상"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.bodyInput]}
          textAlignVertical="top"
          value={body}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>본 시기</Text>
        <View style={styles.dateGroup}>
          <WatchDateInput
            disabled={pending}
            label="처음 본 시기"
            onChange={setFirstWatchedDate}
            startYear={releaseYear}
            value={firstWatchedDate}
          />
          <WatchDateInput
            disabled={pending}
            label="마지막 본 시기"
            onChange={setLastWatchedDate}
            startYear={completionWatchDate?.yearNumber ?? releaseYear}
            value={lastWatchedDate}
          />
        </View>
        <Text style={styles.dateHint}>{createDateHint(releaseWatchDate, completionWatchDate, releaseYear)}</Text>
      </View>

      <View style={styles.spoilerRow}>
        <View style={styles.spoilerTextBox}>
          <Text style={styles.label}>스포일러 포함</Text>
          <Text style={styles.spoilerHint}>소감에 결말이나 반전이 들어가면 켜두세요.</Text>
        </View>
        <Switch
          disabled={pending}
          onValueChange={setIsSpoiler}
          thumbColor={isSpoiler ? colors.primary : colors.surface}
          trackColor={{ false: colors.border, true: colors.primarySoft }}
          value={isSpoiler}
        />
      </View>

      {review.isError ? <Text style={styles.errorText}>{review.error.message}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={[styles.saveButton, pending ? styles.disabled : null]}
      >
        <Text style={styles.saveButtonText}>
          {saveReview.isPending || saveWatchDates.isPending ? "저장 중" : "감상 저장"}
        </Text>
      </Pressable>
    </View>
  );
}

function WatchDateInput({
  label,
  value,
  onChange,
  disabled,
  startYear
}: {
  label: string;
  value: WatchDateParts;
  onChange: (value: WatchDateParts) => void;
  disabled: boolean;
  startYear?: number | undefined;
}) {
  const firstSelectableYear = startYear ?? 1970;
  const lastSelectableYear = Math.max(new Date().getFullYear() + 1, firstSelectableYear);

  return (
    <View style={styles.dateInputBox}>
      <Text style={styles.dateInputLabel}>{label}</Text>
      <View style={styles.dateInputRow}>
        <YearSelect
          endYear={lastSelectableYear}
          startYear={firstSelectableYear}
          value={value.year}
          onChange={(year) => onChange({ ...value, year })}
        />
        <DateNumberInput
          disabled={disabled}
          label="월"
          maxLength={2}
          onChange={(month) => onChange({ ...value, month })}
          value={value.month}
        />
        <DateNumberInput
          disabled={disabled}
          label="일"
          maxLength={2}
          onChange={(day) => onChange({ ...value, day })}
          value={value.day}
        />
      </View>
    </View>
  );
}

function DateNumberInput({
  label,
  value,
  onChange,
  maxLength,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled: boolean;
}) {
  return (
    <View style={styles.dateNumberBox}>
      <TextInput
        accessibilityLabel={`${label} 입력`}
        editable={!disabled}
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={maxLength}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, maxLength))}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
        style={styles.dateNumberInput}
        value={value}
      />
      <Text style={styles.dateNumberLabel}>{label}</Text>
    </View>
  );
}

function parseWatchDateParts(value: string | null, fallback?: WatchDateParts | null): WatchDateParts {
  if (!value) return fallback ?? EMPTY_WATCH_DATE;
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

function toIsoWatchDate(value: WatchDateParts, label: string, minimumDate?: string): string | null {
  if (!value.year) return null;

  const year = Number(value.year);
  const month = value.month ? Number(value.month) : 1;
  const day = value.day ? Number(value.day) : 1;
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
    throw new Error(`${label}의 연도를 확인해 주세요.`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`${label}의 월은 1부터 12까지 입력해 주세요.`);
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`${label}의 일은 1부터 31까지 입력해 주세요.`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label}에 존재하지 않는 날짜가 입력되었습니다.`);
  }

  const isoDate = `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  if (minimumDate && isoDate < minimumDate) {
    throw new Error(`${label}는 작품 공개일(${formatKoreanDate(minimumDate)}) 이후로 입력해 주세요.`);
  }

  return isoDate;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function createReleaseWatchDate(airDate: string | null): ReleaseWatchDate | null {
  const exactDate = parseIsoDate(airDate);
  return exactDate;
}

function createCompletionWatchDate(
  endDate: string | null,
  releaseDate: ReleaseWatchDate | null
): ReleaseWatchDate | null {
  const exactEndDate = parseIsoDate(endDate);
  if (!exactEndDate) return null;
  if (releaseDate && exactEndDate.isoDate < releaseDate.isoDate) return releaseDate;
  return exactEndDate;
}

function parseIsoDate(value: string | null): ReleaseWatchDate | null {
  if (!value) return null;
  const [yearText = "", monthText = "", dayText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return {
    year: yearText,
    month: monthText.padStart(2, "0"),
    day: dayText.padStart(2, "0"),
    isoDate: `${yearText}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`,
    yearNumber: year
  };
}

function formatKoreanDate(value: string): string {
  const [year, month, day] = value.split("-");
  return [year ? `${year}년` : "", month ? `${Number(month)}월` : "", day ? `${Number(day)}일` : ""]
    .filter(Boolean)
    .join(" ");
}

function normalizeYear(value: number | null): number | undefined {
  if (!value || !Number.isInteger(value)) return undefined;
  return value;
}

function createDateHint(
  releaseDate: ReleaseWatchDate | null,
  completionDate: ReleaseWatchDate | null,
  releaseYear: number | undefined
): string {
  if (releaseDate && completionDate && completionDate.isoDate !== releaseDate.isoDate) {
    return `처음은 공개일(${formatKoreanDate(releaseDate.isoDate)}), 마지막은 마지막 방영일(${formatKoreanDate(
      completionDate.isoDate
    )}) 이후로 입력돼요.`;
  }

  if (releaseDate) {
    return `작품 공개일(${formatKoreanDate(releaseDate.isoDate)}) 이후로 입력돼요.`;
  }

  if (releaseYear) {
    return "작품 공개 연도 이후로 입력돼요. 공개 월/일이 없으면 월/일을 비워두세요.";
  }

  return "연도만 알면 월/일을 비워두세요. 저장 시 1월 1일로 기록됩니다.";
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  ratingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  field: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  bodyInput: {
    minHeight: 112
  },
  dateGroup: {
    gap: spacing.md
  },
  dateInputBox: {
    gap: spacing.sm
  },
  dateInputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  dateInputRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  dateNumberBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  dateNumberInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    textAlign: "center"
  },
  dateNumberLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  dateHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  spoilerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  spoilerTextBox: {
    flex: 1,
    gap: 2
  },
  spoilerHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700"
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md
  },
  saveButtonText: {
    color: colors.surface,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.6
  }
});
