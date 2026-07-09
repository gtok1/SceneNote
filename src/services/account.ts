import { supabase } from "@/lib/supabase";

interface DeleteAccountResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>("delete-account");

  if (error) {
    throw new Error(
      (await getFunctionErrorMessage(error)) ??
        "회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요."
    );
  }

  if (!data?.success) {
    throw new Error(data?.message ?? "회원 탈퇴 응답이 올바르지 않습니다.");
  }
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as DeleteAccountResponse;
      return payload.message ?? payload.error;
    } catch {
      return error instanceof Error ? error.message : undefined;
    }
  }

  return error instanceof Error ? error.message : undefined;
}
