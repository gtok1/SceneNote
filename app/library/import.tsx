import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { colors, radius, spacing } from "@/constants/theme";
import { useNetflixBulkImport } from "@/hooks/useBulkImport";
import type { BulkImportReport, BulkImportRowResult, BulkImportSummary, NetflixBulkImportRow } from "@/types/bulkImport";
import { parseNetflixBulkWorkbook } from "@/utils/netflixBulkWorkbook";

const EXCEL_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];
const COMMIT_BATCH_SIZE = 20;

const SUMMARY_ITEMS: { key: keyof BulkImportSummary; label: string }[] = [
  { key: "total_rows", label: "전체" },
  { key: "selected_rows", label: "선택" },
  { key: "existing_app_matches", label: "기존" },
  { key: "tmdb_matched_existing_content", label: "TMDB 기존" },
  { key: "new_content_to_create", label: "신규 예정" },
  { key: "new_content_created", label: "신규 생성" },
  { key: "status_to_update", label: "상태 예정" },
  { key: "status_updated", label: "상태 완료" },
  { key: "manual_review_required", label: "검토 필요" },
  { key: "failed", label: "실패" },
  { key: "tmdb_api_calls", label: "TMDB 호출" },
  { key: "tmdb_cache_hits", label: "캐시" }
];

export default function LibraryImportScreen() {
  const router = useRouter();
  const bulkImport = useNetflixBulkImport();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<NetflixBulkImportRow[]>([]);
  const [report, setReport] = useState<BulkImportReport | null>(null);
  const [parseError, setParseError] = useState("");
  const [commitConfirmVisible, setCommitConfirmVisible] = useState(false);
  const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(null);
  const [batchError, setBatchError] = useState("");
  const selectedCount = useMemo(() => rows.filter((row) => row.import_selected).length, [rows]);
  const attentionRows = useMemo(
    () => report?.rows.filter((row) => row.import_result === "manual_review" || row.import_result === "failed") ?? [],
    [report]
  );
  const previewRows = report?.rows.slice(0, 40) ?? [];
  const isBatchCommitting = Boolean(commitProgress);
  const isPending = bulkImport.isPending || isBatchCommitting;
  const canCommit = report?.mode === "dry-run" && report.summary.status_to_update > 0;

  const pickWorkbook = async () => {
    try {
      setParseError("");
      setBatchError("");
      setCommitConfirmVisible(false);
      setCommitProgress(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: EXCEL_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      const arrayBuffer = await readDocumentArrayBuffer(asset);
      const parsedRows = parseNetflixBulkWorkbook(arrayBuffer);
      setFileName(asset.name);
      setRows(parsedRows);
      setReport(null);
      setCommitConfirmVisible(false);
      setCommitProgress(null);
      bulkImport.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "엑셀을 읽지 못했습니다.";
      setParseError(message);
      Alert.alert("엑셀 읽기 실패", message);
    }
  };

  const submit = (commit: boolean) => {
    if (!rows.length) {
      Alert.alert("엑셀 필요", "먼저 업로드할 엑셀 파일을 선택해 주세요.");
      return;
    }

    setBatchError("");
    setCommitProgress(null);
    setCommitConfirmVisible(false);
    bulkImport.mutate(
      { rows, commit },
      {
        onSuccess: (nextReport) => {
          setReport(nextReport);
          setCommitConfirmVisible(false);
        },
        onError: (error) => Alert.alert(commit ? "등록 실패" : "검사 실패", error.message)
      }
    );
  };

  const confirmCommit = () => {
    if (!report || report.mode !== "dry-run") {
      Alert.alert("검사 먼저 실행", "실제 등록 전에 Dry-run으로 중복과 검토 항목을 확인해 주세요.");
      return;
    }

    setCommitConfirmVisible(true);
  };

  const commitInBatches = async () => {
    if (!report || report.mode !== "dry-run") return;

    const commitRows = createCommitRowsFromDryRun(rows, report);
    if (!commitRows.length) {
      setBatchError("자동 등록할 항목이 없습니다. 검토 필요 항목은 먼저 제목이나 TMDB 정보를 보정해 주세요.");
      setCommitConfirmVisible(false);
      return;
    }

    const batches = chunkRows(commitRows, COMMIT_BATCH_SIZE);
    const batchReports: BulkImportReport[] = [];
    setBatchError("");
    setCommitConfirmVisible(false);
    bulkImport.reset();

    try {
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index] ?? [];
        setCommitProgress({
          currentBatch: index + 1,
          totalBatches: batches.length,
          doneRows: index * COMMIT_BATCH_SIZE,
          totalRows: commitRows.length
        });
        const nextReport = await bulkImport.mutateAsync({ rows: batch, commit: true });
        batchReports.push(nextReport);
      }

      setReport(mergeCommitReports(report, batchReports, rows.length, selectedCount));
    } catch (error) {
      const message = error instanceof Error ? error.message : "대량 등록 중 오류가 발생했습니다.";
      setBatchError(message);
    } finally {
      setCommitProgress(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={18} />
          <Text style={styles.backText}>라이브러리</Text>
        </Pressable>
        <Text style={styles.title}>엑셀 대량 등록</Text>
      </View>

      <View style={styles.uploadPanel}>
        <View style={styles.uploadTextBox}>
          <Text style={styles.uploadTitle}>{fileName || "Netflix/TMDB 등록 엑셀"}</Text>
          <Text style={styles.uploadMeta}>
            {rows.length ? `${rows.length}개 row · 등록 선택 ${selectedCount}개` : "Works_To_Register 시트"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isPending}
          onPress={pickWorkbook}
          style={[styles.primaryButton, isPending ? styles.buttonDisabled : null]}
        >
          <Ionicons color={colors.surface} name="cloud-upload-outline" size={18} />
          <Text style={styles.primaryButtonText}>파일 선택</Text>
        </Pressable>
      </View>

      {parseError ? <ErrorPanel message={parseError} title="엑셀 읽기 실패" /> : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!rows.length || isPending}
          onPress={() => submit(false)}
          style={[styles.secondaryButton, !rows.length || isPending ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>Dry-run 확인</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canCommit || isPending}
          onPress={confirmCommit}
          style={[
            styles.primaryButton,
            !canCommit || isPending ? styles.buttonDisabled : null
          ]}
        >
          {isPending ? <ActivityIndicator color={colors.surface} size="small" /> : null}
          <Text style={styles.primaryButtonText}>
            {isPending ? "처리 중" : commitConfirmVisible ? "확인 중" : "등록 확인"}
          </Text>
        </Pressable>
      </View>

      {commitConfirmVisible && report?.mode === "dry-run" ? (
        <CommitConfirmPanel
          isPending={isPending}
          onCancel={() => setCommitConfirmVisible(false)}
          onConfirm={commitInBatches}
          report={report}
        />
      ) : null}

      {isPending ? (
        <ProgressPanel isCommit={Boolean(bulkImport.variables?.commit) || isBatchCommitting} progress={commitProgress} />
      ) : null}

      {batchError ? (
        <ErrorPanel message={batchError} title="등록 실패" />
      ) : bulkImport.error ? (
        <ErrorPanel
          message={bulkImport.error.message}
          title={bulkImport.variables?.commit ? "등록 실패" : "검사 실패"}
        />
      ) : null}

      {report ? (
        <View style={styles.reportSection}>
          <View style={styles.reportHeader}>
            <Text style={styles.sectionTitle}>{report.mode === "commit" ? "등록 결과" : "Dry-run 결과"}</Text>
            <Text style={styles.reportMode}>{report.mode === "commit" ? "저장됨" : "미리보기"}</Text>
          </View>

          <View style={styles.summaryGrid}>
            {SUMMARY_ITEMS.map((item) => (
              <View key={item.key} style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{report.summary[item.key]}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {attentionRows.length ? (
            <ResultSection
              rows={attentionRows.slice(0, 50)}
              subtitle={`${attentionRows.length}개 항목은 자동 등록되지 않습니다.`}
              title="확인 필요"
            />
          ) : (
            <View style={styles.okPanel}>
              <Ionicons color={colors.success} name="checkmark-circle-outline" size={20} />
              <Text style={styles.okText}>검토 필요 항목이 없습니다.</Text>
            </View>
          )}

          <ResultSection rows={previewRows} subtitle="상위 40개만 표시합니다." title="처리 미리보기" />
        </View>
      ) : !rows.length ? (
        <EmptyState
          title="업로드할 엑셀을 선택해 주세요"
          description="선택 후 Dry-run으로 기존 작품과 신규 등록 예정 항목을 먼저 확인합니다."
        />
      ) : null}
    </ScrollView>
  );
}

interface CommitProgress {
  currentBatch: number;
  totalBatches: number;
  doneRows: number;
  totalRows: number;
}

const AUTO_COMMIT_RESULTS = new Set([
  "dry_run_existing_status_update",
  "dry_run_tmdb_existing_status_update",
  "dry_run_new_content_to_create"
]);

function createCommitRowsFromDryRun(
  rows: NetflixBulkImportRow[],
  dryRunReport: BulkImportReport
): NetflixBulkImportRow[] {
  return dryRunReport.rows
    .filter((row) => AUTO_COMMIT_RESULTS.has(row.import_result) && row.status_result === "would_update_completed")
    .map((resultRow) => {
      const sourceRow = rows[resultRow.row_number - 2];
      if (!sourceRow) return null;

      return {
        ...sourceRow,
        import_selected: true,
        existing_app_content_id: resultRow.existing_app_content_id || sourceRow.existing_app_content_id,
        tmdb_id: resultRow.resolved_tmdb_id || sourceRow.tmdb_id,
        tmdb_media_type: resultRow.resolved_media_type || sourceRow.tmdb_media_type,
        tmdb_match_status: resultRow.resolved_tmdb_id ? "matched" : sourceRow.tmdb_match_status
      };
    })
    .filter((row): row is NetflixBulkImportRow => Boolean(row));
}

function chunkRows(rows: NetflixBulkImportRow[], size: number): NetflixBulkImportRow[][] {
  const chunks: NetflixBulkImportRow[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function mergeCommitReports(
  dryRunReport: BulkImportReport,
  commitReports: BulkImportReport[],
  totalRows: number,
  selectedRows: number
): BulkImportReport {
  const summary = createEmptySummary();
  for (const report of commitReports) {
    addSummary(summary, report.summary);
  }

  summary.total_rows = totalRows;
  summary.selected_rows = selectedRows;
  summary.manual_review_required = dryRunReport.summary.manual_review_required;
  summary.skipped = dryRunReport.summary.skipped;

  return {
    mode: "commit",
    summary,
    rows: [
      ...commitReports.flatMap((report) => report.rows),
      ...dryRunReport.rows.filter((row) => row.import_result === "manual_review" || row.import_result === "failed")
    ]
  };
}

function createEmptySummary(): BulkImportSummary {
  return {
    total_rows: 0,
    selected_rows: 0,
    existing_app_matches: 0,
    tmdb_cache_hits: 0,
    tmdb_api_calls: 0,
    tmdb_matched_existing_content: 0,
    new_content_to_create: 0,
    new_content_created: 0,
    status_to_update: 0,
    status_updated: 0,
    manual_review_required: 0,
    skipped: 0,
    failed: 0
  };
}

function addSummary(target: BulkImportSummary, patch: BulkImportSummary): void {
  for (const item of SUMMARY_ITEMS) {
    target[item.key] += patch[item.key];
  }
}

async function readDocumentArrayBuffer(asset: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer> {
  if (asset.file) return asset.file.arrayBuffer();

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("선택한 엑셀 파일을 열 수 없습니다.");
  return response.arrayBuffer();
}

function ResultSection({
  title,
  subtitle,
  rows
}: {
  title: string;
  subtitle: string;
  rows: BulkImportRowResult[];
}) {
  if (!rows.length) return null;

  return (
    <View style={styles.resultSection}>
      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.resultSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.resultList}>
        {rows.map((row) => (
          <View key={`${row.row_number}:${row.work_id}`} style={styles.resultRow}>
            <View style={styles.resultTitleBox}>
              <Text numberOfLines={1} style={styles.resultTitle}>
                {row.resolved_title || row.normalized_title || "제목 없음"}
              </Text>
              <Text numberOfLines={1} style={styles.resultMeta}>
                {[
                  row.resolved_media_type,
                  labelImportResult(row.import_result),
                  labelDuplicateResult(row.duplicate_check_result),
                  row.failure_reason
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Text style={styles.resultStatus}>{labelStatusResult(row.status_result)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.errorPanel}>
      <Ionicons color={colors.danger} name="warning-outline" size={20} />
      <View style={styles.errorTextBox}>
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={styles.errorText}>{message}</Text>
      </View>
    </View>
  );
}

function CommitConfirmPanel({
  report,
  isPending,
  onCancel,
  onConfirm
}: {
  report: BulkImportReport;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const existingCount = report.summary.existing_app_matches + report.summary.tmdb_matched_existing_content;
  const newCount = report.summary.new_content_to_create;
  const targetCount = report.summary.status_to_update;
  const manualCount = report.summary.manual_review_required;

  return (
    <View style={styles.confirmPanel}>
      <View style={styles.confirmTitleRow}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
        <Text style={styles.confirmTitle}>등록 실행 확인</Text>
      </View>
      <Text style={styles.confirmText}>
        자동 매칭된 {targetCount}개 항목을 실제 저장합니다. 신규 작품 {newCount}개를 만들고,
        기존 작품 {existingCount}개는 시청완료 상태로 갱신합니다. 검토 필요 {manualCount}개는 자동 등록하지 않고 보류합니다.
      </Text>
      <View style={styles.confirmActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isPending}
          onPress={onCancel}
          style={[styles.secondaryButton, isPending ? styles.buttonDisabled : null]}
        >
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isPending}
          onPress={onConfirm}
          style={[styles.primaryButton, isPending ? styles.buttonDisabled : null]}
        >
          <Text style={styles.primaryButtonText}>자동 등록 실행</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProgressPanel({ isCommit, progress }: { isCommit: boolean; progress: CommitProgress | null }) {
  return (
    <View style={styles.progressPanel}>
      <ActivityIndicator color={colors.primary} size="small" />
      <View style={styles.progressTextBox}>
        <Text style={styles.progressTitle}>{isCommit ? "등록 처리 중" : "Dry-run 검사 중"}</Text>
        <Text style={styles.progressText}>
          {progress
            ? `${progress.currentBatch}/${progress.totalBatches}번째 묶음을 저장하고 있습니다. 약 ${Math.min(
                progress.doneRows + COMMIT_BATCH_SIZE,
                progress.totalRows
              )}/${progress.totalRows}개 처리 중입니다.`
            : isCommit
              ? "TMDB 매칭 결과와 기존 라이브러리를 확인하면서 저장하고 있습니다."
              : "기존 작품 중복 여부와 TMDB 매칭 후보를 확인하고 있습니다."}
        </Text>
      </View>
    </View>
  );
}

function labelImportResult(value: string): string {
  const labels: Record<string, string> = {
    dry_run_existing_status_update: "기존 상태 갱신 예정",
    duplicate_existing_updated: "기존 상태 갱신",
    dry_run_tmdb_existing_status_update: "TMDB 기존 갱신 예정",
    tmdb_matched_existing_updated: "TMDB 기존 갱신",
    dry_run_new_content_to_create: "신규 등록 예정",
    new_content_created: "신규 등록",
    manual_review: "수동 검토",
    failed: "실패"
  };
  return labels[value] ?? value;
}

function labelDuplicateResult(value: string): string {
  const labels: Record<string, string> = {
    provided_existing_app_content_id: "기존 ID",
    existing_app_match: "제목 중복",
    tmdb_existing_match: "TMDB 중복",
    no_existing_match: "중복 없음",
    ambiguous_existing_match: "중복 후보 여러 개",
    failed: "실패"
  };
  return labels[value] ?? value;
}

function labelStatusResult(value: string): string {
  const labels: Record<string, string> = {
    would_update_completed: "시청완료 예정",
    updated_completed: "시청완료 갱신",
    created_completed: "시청완료 생성",
    already_exists_race_skipped: "이미 있음",
    skipped_manual_review: "보류",
    failed: "실패"
  };
  return labels[value] ?? value;
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
    fontWeight: "700"
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
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
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "900"
  },
  buttonDisabled: {
    opacity: 0.48
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  errorPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  errorTextBox: {
    flex: 1,
    gap: spacing.xs
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "900"
  },
  confirmPanel: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  confirmTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  confirmTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  confirmText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21
  },
  confirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  progressPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  progressTextBox: {
    flex: 1,
    gap: spacing.xs
  },
  progressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  reportSection: {
    gap: spacing.lg
  },
  reportHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  reportMode: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 112,
    padding: spacing.md
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  okPanel: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  okText: {
    color: colors.success,
    fontWeight: "900"
  },
  resultSection: {
    gap: spacing.sm
  },
  resultHeader: {
    gap: spacing.xs
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  resultList: {
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
    justifyContent: "space-between",
    padding: spacing.md
  },
  resultTitleBox: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  resultTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  resultMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  resultStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  }
});
