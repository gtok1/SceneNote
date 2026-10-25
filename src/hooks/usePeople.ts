import { PEOPLE_FEATURES_ENABLED } from "@/constants/features";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  addFavoritePerson,
  applyResolvedKoreanName,
  classifyPeople,
  deleteFavoritePerson,
  getFavoritePeople,
  getPersonDetail,
  resolvePersonNames,
  searchPersonContent,
  setFavoritePersonCategory,
  setFavoriteKoreanName
} from "@/services/people";
import { useAuthStore } from "@/stores/authStore";
import type { FavoritePerson, PersonCategory, PersonSearchResult, PersonSource } from "@/types/people";
import { createCategorySyncBatches, personKey, planFavoriteCategorySync, selectFavoritesForCategorySync } from "@/utils/peopleScreen";
import { selectFavoritesNeedingKoreanName } from "@/utils/personKoreanName";

export function usePersonContentSearch(query: string, category: PersonCategory | "all" = "all") {
  return useQuery({
    queryKey: ["person-content-search", query.trim(), category],
    queryFn: () => searchPersonContent(query, category),
    enabled: PEOPLE_FEATURES_ENABLED && query.trim().length >= 2,
    staleTime: 60_000
  });
}

export function useFavoritePeople() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ["favorite-people", user?.id ?? "anonymous"],
    queryFn: getFavoritePeople,
    enabled: PEOPLE_FEATURES_ENABLED && Boolean(user),
    staleTime: 60_000
  });
}

export function usePersonDetail(
  source: PersonSource | undefined,
  externalId: string | undefined,
  category: PersonCategory | undefined
) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ["person-detail", "v3-ko", source, externalId, category],
    queryFn: async () => {
      const data = await getPersonDetail({
        source: source as PersonSource,
        externalId: externalId ?? "",
        category: category as PersonCategory
      });
      if (data.category !== category && user) {
        await queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
      }
      return data;
    },
    enabled: PEOPLE_FEATURES_ENABLED && Boolean(source && externalId && category),
    staleTime: 10 * 60_000
  });
}

export function useAddFavoritePerson() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (person: PersonSearchResult) => addFavoritePerson(person),
    onSuccess: () => (user ? queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] }) : undefined)
  });
}

export function useDeleteFavoritePerson() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (id: string) => deleteFavoritePerson(id),
    onSuccess: () => (user ? queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] }) : undefined)
  });
}

export function useFavoriteCategorySync(favorites: FavoritePerson[] | undefined): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const candidates = useMemo(() => selectFavoritesForCategorySync(favorites ?? []), [favorites]);
  const signature = useMemo(() => candidates.map(personKey).sort().join(","), [candidates]);

  useQuery({
    queryKey: ["favorite-category-sync", user?.id ?? "anonymous", signature],
    enabled: PEOPLE_FEATURES_ENABLED && Boolean(user) && candidates.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      let changedCount = 0;
      for (const ids of createCategorySyncBatches(candidates)) {
        try {
          const results = await classifyPeople(ids);
          const batchFavorites = candidates.filter(person => ids.includes(person.external_id));
          const updates = planFavoriteCategorySync(batchFavorites, results);
          await Promise.all(updates.map(update => setFavoritePersonCategory(update.id, update.category)));
          changedCount += updates.length;
        } catch {
          // 요청 실패는 조용히 넘기고 다른 묶음은 계속 확인한다.
        }
      }
      if (user && changedCount > 0) await queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
      return changedCount;
    }
  });
}

// 목록을 열 때 한글 이름이 없거나 자동 추정인 인물을 서버에 물어 채운다. 실패는 조용히 넘기고 표시는 지금과 같다.
export function useFavoriteKoreanNameBackfill(favorites: FavoritePerson[] | undefined): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const candidates = useMemo(() => selectFavoritesNeedingKoreanName(favorites ?? [], new Date()), [favorites]);

  useQuery({
    queryKey: ["favorite-korean-names", user?.id ?? "anonymous", candidates.map(personKey).join(",")],
    enabled: PEOPLE_FEATURES_ENABLED && Boolean(user) && candidates.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const results = await resolvePersonNames(candidates);
      const byKey = new Map(results.map((result) => [personKey(result), result]));

      await Promise.all(
        candidates.map((favorite) =>
          applyResolvedKoreanName(favorite.id, byKey.get(personKey(favorite)) ?? { name_ko: null, name_ko_source: null })
        )
      );
      if (user) await queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
      return results.length;
    }
  });
}

export function useSetFavoriteKoreanName() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ id, nameKo }: { id: string; nameKo: string | null }) => setFavoriteKoreanName(id, nameKo),
    onSuccess: async (_data, { nameKo }) => {
      if (!user) return;
      if (nameKo === null) {
        // 되돌린 이름은 최신 목록에서 후보를 다시 계산한 뒤 같은 묶음이라도 자동으로 채운다.
        await queryClient.invalidateQueries({
          queryKey: ["favorite-korean-names", user.id],
          refetchType: "none"
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
    }
  });
}
