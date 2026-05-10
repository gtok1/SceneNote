import { supabase } from "@/lib/supabase";
import type { Tag } from "@/types/pins";

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tag[];
}

export async function createTag(name: string): Promise<Tag> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("로그인이 필요합니다");

  const normalized = name.trim();
  if (!normalized) throw new Error("태그 이름을 입력해 주세요");

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      {
        user_id: user.id,
        name: normalized
      },
      { onConflict: "user_id,name" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Tag;
}

export async function attachTagsToPin(pinId: string, tagNames: string[]): Promise<Tag[]> {
  const uniqueNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))].slice(0, 10);
  const tags = await Promise.all(uniqueNames.map((name) => createTag(name)));

  if (tags.length === 0) return [];

  const { error } = await supabase.from("timeline_pin_tags").upsert(
    tags.map((tag) => ({
      pin_id: pinId,
      tag_id: tag.id
    }))
  );

  if (error) throw new Error(error.message);
  return tags;
}

export async function replacePinTags(pinId: string, tagNames: string[]): Promise<Tag[]> {
  const { error } = await supabase.from("timeline_pin_tags").delete().eq("pin_id", pinId);
  if (error) throw new Error(error.message);
  return attachTagsToPin(pinId, tagNames);
}
