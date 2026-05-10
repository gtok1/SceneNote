import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { GenreStat } from "@/types/genre";

export function useGenreStats() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.genreStats(user?.id ?? "anonymous"),
    queryFn: async (): Promise<GenreStat[]> => {
      const { data, error } = await supabase.rpc("get_genre_stats");
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => ({
        genre_name: item.genre_name,
        count: Number(item.count)
      }));
    },
    enabled: Boolean(user),
    staleTime: 5 * 60_000
  });
}
