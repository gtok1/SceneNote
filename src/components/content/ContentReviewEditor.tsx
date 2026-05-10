import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { RatingInput } from "@/components/form/RatingInput";
import { colors, radius, spacing } from "@/constants/theme";
import { useContentReview, useSaveContentReview } from "@/hooks/useReviews";

interface ContentReviewEditorProps {
  contentId: string;
}

export function ContentReviewEditor({ contentId }: ContentReviewEditorProps) {
  const review = useContentReview(contentId);
  const saveReview = useSaveContentReview(contentId);
  const [rating, setRating] = useState<number | null>(null);
  const [oneLineReview, setOneLineReview] = useState("");
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);

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

  const submit = () => {
    saveReview.mutate(
      {
        content_id: contentId,
        rating,
        one_line_review: oneLineReview,
        body,
        is_spoiler: isSpoiler
      },
      {
        onSuccess: (savedReview) => {
          setRating(savedReview.rating);
          setOneLineReview(savedReview.one_line_review ?? "");
          setBody(savedReview.body ?? "");
          setIsSpoiler(savedReview.is_spoiler);
          Alert.alert("저장 완료", "감상 기록을 저장했습니다.");
        },
        onError: (error) => Alert.alert("저장 실패", error.message)
      }
    );
  };

  const pending = review.isLoading || saveReview.isPending;

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
        <Text style={styles.saveButtonText}>{saveReview.isPending ? "저장 중" : "감상 저장"}</Text>
      </Pressable>
    </View>
  );
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
