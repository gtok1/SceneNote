import { supabase } from "@/lib/supabase";
import type { BulkImportReport, NetflixBulkImportRow } from "@/types/bulkImport";

interface FunctionErrorResponse {
  code?: string;
  error?: string;
  message?: string;
}

export async function runNetflixBulkImport({
  rows,
  commit
}: {
  rows: NetflixBulkImportRow[];
  commit: boolean;
}): Promise<BulkImportReport> {
  const { data, error } = await supabase.functions.invoke<BulkImportReport>("bulk-register-netflix", {
    body: { rows, commit }
  });

  if (error) throw new Error(await createBulkImportErrorMessage(error));
  if (!data) throw new Error("대량 등록 응답이 비어 있습니다.");
  return data;
}

async function createBulkImportErrorMessage(error: Error): Promise<string> {
  const response = getFunctionErrorResponse(error);
  if (response) {
    const details = await readFunctionErrorBody(response);
    const message = translateFunctionError(details.message || details.error || error.message, details.code, response.status);
    const statusLabel = response.status ? `HTTP ${response.status}` : "";
    const codeLabel = details.code ? `오류 코드: ${details.code}` : "";
    return [message, statusLabel, codeLabel].filter(Boolean).join("\n");
  }

  return translateFunctionError(error.message);
}

function getFunctionErrorResponse(error: Error): Response | null {
  const context = (error as Error & { context?: unknown }).context;
  return isResponse(context) ? context : null;
}

function isResponse(value: unknown): value is Response {
  return Boolean(value && typeof value === "object" && "status" in value && "headers" in value);
}

async function readFunctionErrorBody(response: Response): Promise<FunctionErrorResponse> {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await clone.json()) as FunctionErrorResponse;
    }

    const text = await clone.text();
    return { message: text };
  } catch {
    return {};
  }
}

function translateFunctionError(message: string, code?: string, status?: number): string {
  if (status === 401 || code === "UNAUTHORIZED") {
    return "로그인이 만료됐거나 인증 정보가 없습니다. 다시 로그인한 뒤 실행해 주세요.";
  }
  if (status === 405 || code === "METHOD_NOT_ALLOWED") {
    return "잘못된 방식으로 서버 기능을 호출했습니다.";
  }
  if (status === 546 || code === "WORKER_RESOURCE_LIMIT") {
    return "한 번에 처리할 양이 커서 서버 함수 리소스 제한에 걸렸습니다. 자동 등록 대상을 작은 묶음으로 나눠 다시 실행해 주세요.";
  }
  if (code === "INVALID_REQUEST") {
    return translateKnownServerMessage(message) || "업로드 요청 형식이 올바르지 않습니다.";
  }

  const knownMessage = translateKnownServerMessage(message);
  if (knownMessage) return knownMessage;

  if (/Failed to send a request to the Edge Function/i.test(message)) {
    return "대량 등록 서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.";
  }
  if (/Relay Error invoking the Edge Function/i.test(message)) {
    return "Supabase Edge Function 중계 과정에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (/Edge Function returned a non-2xx status code/i.test(message)) {
    return "대량 등록 서버가 오류 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (/not having enough compute resources|WORKER_RESOURCE_LIMIT/i.test(message)) {
    return "한 번에 처리할 양이 커서 서버 함수 리소스 제한에 걸렸습니다. 자동 등록 대상을 작은 묶음으로 나눠 다시 실행해 주세요.";
  }
  if (status && status >= 500) {
    return `대량 등록 서버 처리 중 오류가 발생했습니다.${message ? `\n상세: ${message}` : ""}`;
  }

  return message || "대량 등록 중 알 수 없는 오류가 발생했습니다.";
}

function translateKnownServerMessage(message: string): string {
  if (!message) return "";
  if (/rows are required/i.test(message)) return "엑셀에서 처리할 row를 찾지 못했습니다.";
  if (/Too many rows/i.test(message)) return "한 번에 업로드할 수 있는 row는 최대 600개입니다.";
  if (/Invalid JSON body/i.test(message)) return "서버로 보낸 업로드 데이터 형식이 올바르지 않습니다.";
  if (/TMDB_API_KEY is not configured/i.test(message)) {
    return "서버에 TMDB API 키가 설정되어 있지 않아 작품 매칭을 진행할 수 없습니다.";
  }
  if (/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing/i.test(message)) {
    return "서버에 Supabase 관리자 설정이 누락되어 대량 등록을 진행할 수 없습니다.";
  }
  if (/content upsert failed/i.test(message)) return "작품 정보를 저장하는 중 오류가 발생했습니다.";
  return "";
}
