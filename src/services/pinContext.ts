import { supabase } from "@/lib/supabase";
import { resolvePinContext, type PinContextEpisode } from "@/utils/pinContext";

export async function getPinContext(contentId: string, episodeId: string | null) {
  const content = await supabase.from("contents").select("id,title_primary,content_type").eq("id", contentId).single();
  if (content.error) throw new Error("작품 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  if (content.data.content_type === "movie" || !episodeId) return resolvePinContext(content.data, episodeId, null);
  const episode = await supabase.from("episodes").select("id,content_id,episode_number,duration_seconds,seasons(season_number)").eq("id", episodeId).eq("content_id", contentId).single();
  if (episode.error) throw new Error("회차 조회에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  return resolvePinContext(content.data, episodeId, episode.data as unknown as PinContextEpisode);
}
