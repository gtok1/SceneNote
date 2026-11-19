import { supabase } from "@/lib/supabase";
import { getSessionUserId } from "@/services/sessionUser";
import { useAuthStore } from "@/stores/authStore";
import { normalizeSubscribedOtts } from "@/utils/subscribedOtt";

export async function getSubscribedOtts(userId: string, signal?: AbortSignal): Promise<string[]> {
  const request = supabase.from("profiles").select("subscribed_otts").eq("id", userId);
  const { data, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeSubscribedOtts(data?.subscribed_otts);
}

export async function saveSubscribedOtts(groups: readonly string[]): Promise<string[]> {
  // The SDK/RLS authenticate the write; this snapshot only binds the operation
  // to the account whose screen initiated it, even while getSession is waiting.
  const callerUserId = useAuthStore.getState().user?.id ?? null;
  const { userId, error: sessionError } = await getSessionUserId();
  if (sessionError) throw new Error(sessionError.message);
  if (!userId) throw new Error("로그인이 필요합니다");
  if (callerUserId !== userId || useAuthStore.getState().user?.id !== callerUserId) {
    throw new Error("계정이 변경되었어요. 다시 시도해 주세요.");
  }

  const { data, error } = await supabase.from("profiles")
    .upsert({ id: userId, subscribed_otts: normalizeSubscribedOtts(groups) }, { onConflict: "id" })
    .select("subscribed_otts").single();
  if (error) throw new Error(error.message);
  return normalizeSubscribedOtts(data.subscribed_otts);
}
