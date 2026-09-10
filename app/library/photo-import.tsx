import { Redirect , useRouter } from "expo-router";
import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";

import { EmptyState } from "@/components/common/EmptyState";
import { colors, radius, spacing } from "@/constants/theme";
import { useAddToLibrary } from "@/hooks/useLibrary";
import { searchContent } from "@/services/contentSearch";
import type { MediaTypeFilter, SearchResult } from "@/types/content";
import { createAirDateLabel } from "@/utils/contentMetaDisplay";
import { extractPhotoTitleCandidates } from "@/utils/photoTitleCandidates";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const MEDIA_FILTERS: { label: string; value: MediaTypeFilter }[] = [
  { label: "전체", value: "all" },
  { label: "애니", value: "anime" },
  { label: "드라마", value: "drama" },
  { label: "영화", value: "movie" }
];

function LibraryPhotoImportScreen() {
  const router = useRouter();
  const addToLibrary = useAddToLibrary();
  const [imageName, setImageName] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaTypeFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const selectedResult = useMemo(
    () => results.find((result) => createResultKey(result) === selectedKey) ?? results[0] ?? null,
    [results, selectedKey]
  );
  const isBusy = isRecognizing || isSearching || addToLibrary.isPending;

  const pickPhoto = async () => {
    try {
      setErrorMessage("");
      setResults([]);
      setSelectedKey("");
      setOcrText("");
      setTitleCandidates([]);
      setOcrProgress(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: IMAGE_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setImageName(asset.name);
      setImageUri(asset.uri);

      if (Platform.OS !== "web" && !asset.file) {
        throw new Error("사진 제목 자동 인식은 현재 웹 실행 환경에서만 지원됩니다.");
      }

      setIsRecognizing(true);
      const text = await recognizeImageText(asset);
      const candidates = extractPhotoTitleCandidates(text);
      const firstCandidate = candidates[0] ?? "";

      setOcrText(text);
      setTitleCandidates(candidates);
      setQuery(firstCandidate);

      if (firstCandidate) {
        await runSearch(firstCandidate, mediaType);
      } else {
        setErrorMessage("사진에서 제목을 찾지 못했습니다. 제목이 크게 보이는 포스터나 목록 화면을 올리거나 직접 입력해 주세요.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "사진을 읽지 못했습니다.";
      setErrorMessage(message);
      Alert.alert("사진 업로드 실패", message);
    } finally {
      setIsRecognizing(false);
      setOcrProgress(null);
    }
  };

  const searchCurrentQuery = async () => {
    await runSearch(query, mediaType);
  };

  const changeCandidate = async (candidate: string) => {
    setQuery(candidate);
    await runSearch(candidate, mediaType);
  };

  const changeMediaType = async (nextMediaType: MediaTypeFilter) => {
    setMediaType(nextMediaType);
    if (query.trim()) {
      await runSearch(query, nextMediaType);
    }
  };

  const registerWishlist = () => {
    if (!selectedResult) {
      Alert.alert("작품 선택 필요", "등록할 검색 결과를 먼저 선택해 주세요.");
      return;
    }

    addToLibrary.mutate(
      { result: selectedResult, status: "wishlist" },
      {
        onSuccess: () => {
          Alert.alert("등록 완료", "보고 싶음으로 라이브러리에 추가했습니다.", [
            { text: "라이브러리 보기", onPress: () => router.replace("/library") },
            { text: "계속 등록", style: "cancel" }
          ]);
        },
        onError: (error) => Alert.alert("등록 실패", error.message)
      }
    );
  };

  const runSearch = async (nextQuery: string, nextMediaType: MediaTypeFilter) => {
    const normalizedQuery = nextQuery.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setSelectedKey("");
      setErrorMessage("검색할 제목을 2글자 이상 입력해 주세요.");
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage("");
      const response = await searchContent({ query: normalizedQuery, mediaType: nextMediaType });
      setResults(response.results.slice(0, 8));
      setSelectedKey(response.results[0] ? createResultKey(response.results[0]) : "");
      if (!response.results.length) {
        setErrorMessage("검색 결과가 없습니다. 제목을 조금 다르게 입력해 다시 검색해 주세요.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "작품 검색에 실패했습니다.";
      setErrorMessage(message);
    } finally {
      setIsSearching(false);
    }
  };

  const progressLabel = ocrProgress === null ? "" : `${Math.round(ocrProgress * 100)}%`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={18} />
          <Text style={styles.backText}>라이브러리</Text>
        </Pressable>
        <Text style={styles.title}>사진으로 보고 싶음 등록</Text>
      </View>

      <View style={styles.uploadPanel}>
        <View style={styles.uploadTextBox}>
          <Text style={styles.uploadTitle}>{imageName || "작품 제목이 크게 보이는 사진"}</Text>
          <Text style={styles.uploadMeta}>
            포스터, 스트리밍 목록, 캡처 화면처럼 제목이 선명한 이미지를 선택해 주세요.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={pickPhoto}
          style={[styles.primaryButton, isBusy ? styles.buttonDisabled : null]}
        >
          <Ionicons color={colors.surface} name="image-outline" size={18} />
          <Text style={styles.primaryButtonText}>사진 선택</Text>
        </Pressable>
      </View>

      {imageUri ? (
        <View style={styles.previewPanel}>
          <Image contentFit="contain" source={{ uri: imageUri }} style={styles.previewImage} />
        </View>
      ) : null}

      {isRecognizing ? (
        <View style={styles.progressPanel}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.progressText}>사진에서 제목을 읽고 있습니다. {progressLabel}</Text>
        </View>
      ) : null}

      <View style={styles.searchPanel}>
        <Text style={styles.sectionTitle}>제목 확인</Text>
        <TextInput
          accessibilityLabel="사진에서 찾은 제목"
          editable={!isBusy}
          onChangeText={setQuery}
          onSubmitEditing={searchCurrentQuery}
          placeholder="사진에서 읽은 제목 또는 직접 입력"
          style={styles.searchInput}
          value={query}
        />

        {titleCandidates.length ? (
          <View style={styles.candidateRow}>
            {titleCandidates.map((candidate) => (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                key={candidate}
                onPress={() => changeCandidate(candidate)}
                style={[styles.chip, candidate === query ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, candidate === query ? styles.chipTextSelected : null]}>
                  {candidate}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.controlRow}>
          {MEDIA_FILTERS.map((item) => {
            const selected = item.value === mediaType;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isBusy}
                key={item.value}
                onPress={() => changeMediaType(item.value)}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            disabled={isBusy || query.trim().length < 2}
            onPress={searchCurrentQuery}
            style={[styles.secondaryButton, isBusy || query.trim().length < 2 ? styles.buttonDisabled : null]}
          >
            {isSearching ? <ActivityIndicator color={colors.text} size="small" /> : null}
            <Text style={styles.secondaryButtonText}>다시 검색</Text>
          </Pressable>
        </View>
      </View>

      {errorMessage ? <ErrorPanel message={errorMessage} /> : null}

      {results.length ? (
        <View style={styles.resultsPanel}>
          <Text style={styles.sectionTitle}>검색 결과 선택</Text>
          {results.map((result) => {
            const key = createResultKey(result);
            const selected = key === createResultKey(selectedResult);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isBusy}
                key={key}
                onPress={() => setSelectedKey(key)}
                style={[styles.resultRow, selected ? styles.resultRowSelected : null]}
              >
                {result.poster_url ? (
                  <Image source={{ uri: result.poster_url }} style={styles.poster} />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Ionicons color={colors.textMuted} name="image-outline" size={20} />
                  </View>
                )}
                <View style={styles.resultTextBox}>
                  <Text numberOfLines={1} style={styles.resultTitle}>{result.title_primary}</Text>
                  <Text numberOfLines={1} style={styles.resultMeta}>
                    {[labelContentType(result.content_type), createAirDateLabel(result.air_date, result.air_year), result.title_original]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Ionicons
                  color={selected ? colors.primary : colors.textMuted}
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                />
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            disabled={!selectedResult || isBusy}
            onPress={registerWishlist}
            style={[styles.primaryButton, !selectedResult || isBusy ? styles.buttonDisabled : null]}
          >
            {addToLibrary.isPending ? <ActivityIndicator color={colors.surface} size="small" /> : null}
            <Text style={styles.primaryButtonText}>보고 싶음으로 등록</Text>
          </Pressable>
        </View>
      ) : !imageUri && !isRecognizing ? (
        <EmptyState
          title="사진을 선택해 주세요"
          description="제목이 보이는 사진을 올리면 제목 후보를 찾고, 검색 결과를 확인한 뒤 보고 싶음으로 등록합니다."
        />
      ) : null}

      {ocrText ? (
        <View style={styles.ocrPanel}>
          <Text style={styles.sectionTitle}>OCR 원문</Text>
          <Text style={styles.ocrText}>{ocrText}</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  async function recognizeImageText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
    const { recognize } = await import("tesseract.js");
    const imageSource = asset.file ?? asset.uri;
    const result = await recognize(imageSource, "kor+eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          setOcrProgress(message.progress);
        }
      }
    });

    return result.data.text;
  }
}

function createResultKey(result: SearchResult | null): string {
  if (!result) return "";
  return `${result.external_source}:${result.external_id}`;
}

function labelContentType(value: SearchResult["content_type"]): string {
  const labels: Record<SearchResult["content_type"], string> = {
    anime: "애니",
    kdrama: "한국 드라마",
    jdrama: "일본 드라마",
    movie: "영화",
    other: "기타"
  };
  return labels[value];
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <View style={styles.errorPanel}>
      <Ionicons color={colors.danger} name="warning-outline" size={20} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    minHeight: "100%",
    padding: spacing.lg,
    paddingBottom: 112
  },
  header: {
    gap: spacing.md
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  backText: {
    color: colors.text,
    fontWeight: "800"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  uploadPanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.lg
  },
  uploadTextBox: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220
  },
  uploadTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  uploadMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  previewPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md
  },
  previewImage: {
    aspectRatio: 16 / 9,
    width: "100%"
  },
  searchPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  searchInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  candidateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: "800"
  },
  chipTextSelected: {
    color: colors.surface
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "900"
  },
  buttonDisabled: {
    opacity: 0.48
  },
  progressPanel: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  progressText: {
    color: colors.text,
    fontWeight: "800"
  },
  errorPanel: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  resultsPanel: {
    gap: spacing.sm
  },
  resultRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  resultRowSelected: {
    borderColor: colors.primary,
    borderWidth: 2
  },
  poster: {
    borderRadius: radius.sm,
    height: 84,
    width: 56
  },
  posterPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 84,
    justifyContent: "center",
    width: 56
  },
  resultTextBox: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  ocrPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.lg
  },
  ocrText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  }
});

export default function MvpRoute() { return EXTENDED_FEATURES_ENABLED ? <LibraryPhotoImportScreen /> : <Redirect href="/library" />; }
