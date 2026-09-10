import { useQuery } from "@tanstack/react-query";
import { getPinContext } from "@/services/pinContext";
export function usePinContext(contentId: string, episodeId: string | null) {
  return useQuery({ queryKey: ["pin-context", contentId, episodeId], queryFn: () => getPinContext(contentId, episodeId), enabled: Boolean(contentId), staleTime: 0 });
}
