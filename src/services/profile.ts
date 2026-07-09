import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const MAX_DISPLAY_NAME_LENGTH = 24;

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  return {
    avatar_url: null,
    created_at: new Date().toISOString(),
    display_name: null,
    id: userId,
    updated_at: new Date().toISOString()
  };
}

export async function updateProfileDisplayName({
  userId,
  displayName
}: {
  userId: string;
  displayName: string;
}): Promise<Profile> {
  const normalized = displayName.trim();
  if (!normalized) throw new Error("닉네임을 입력해 주세요.");
  if (normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`닉네임은 ${MAX_DISPLAY_NAME_LENGTH}자 이하로 입력해 주세요.`);
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        display_name: normalized,
        id: userId
      },
      { onConflict: "id" }
    )
    .select("id, display_name, avatar_url, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
