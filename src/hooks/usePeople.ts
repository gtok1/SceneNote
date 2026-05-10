import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { addFavoritePerson, deleteFavoritePerson, getFavoritePeople, getPersonDetail, searchPersonContent } from "@/services/people";
import { useAuthStore } from "@/stores/authStore";
import type { PersonCategory, PersonSearchResult, PersonSource } from "@/types/people";

export function usePersonContentSearch(query: string, category: PersonCategory | "all" = "all") {
  return useQuery({
    queryKey: ["person-content-search", query.trim(), category],
    queryFn: () => searchPersonContent(query, category),
    enabled: query.trim().length >= 2,
    staleTime: 60_000
  });
}

export function useFavoritePeople() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ["favorite-people", user?.id ?? "anonymous"],
    queryFn: getFavoritePeople,
    enabled: Boolean(user),
    staleTime: 60_000
  });
}

export function usePersonDetail(
  source: PersonSource | undefined,
  externalId: string | undefined,
  category: PersonCategory | undefined
) {
  return useQuery({
    queryKey: ["person-detail", "v2", source, externalId, category],
    queryFn: () =>
      getPersonDetail({
        source: source as PersonSource,
        externalId: externalId ?? "",
        category: category as PersonCategory
      }),
    enabled: Boolean(source && externalId && category),
    staleTime: 10 * 60_000
  });
}

export function useAddFavoritePerson() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (person: PersonSearchResult) => addFavoritePerson(person),
    onSuccess: () => {
      if (user) queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
    }
  });
}

export function useDeleteFavoritePerson() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: (id: string) => deleteFavoritePerson(id),
    onSuccess: () => {
      if (user) queryClient.invalidateQueries({ queryKey: ["favorite-people", user.id] });
    }
  });
}
