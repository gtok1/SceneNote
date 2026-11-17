import { supabase } from "@/lib/supabase";
import { sessionUserId } from "@/utils/sessionUser";

/** 저장소의 세션을 읽는다(만료 시 갱신 제외). 본인 확인은 RLS가 한다(docs/72 D-3). */
export async function getSessionUserId(): Promise<{ userId: string | null; error: { message: string } | null }> {
  const { data, error } = await supabase.auth.getSession();
  return { userId: error ? null : sessionUserId(data.session), error };
}
