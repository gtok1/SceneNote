import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { colors, radius, spacing } from "@/constants/theme";
import { useAddFavoritePerson, useDeleteFavoritePerson, useFavoritePeople, usePersonContentSearch } from "@/hooks/usePeople";
import type { PersonCategory, PersonSearchResult } from "@/types/people";

const CATEGORY_FILTERS: { label: string; value: PersonCategory | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "배우", value: "actor" },
  { label: "성우", value: "voice_actor" }
];

export default function PeopleScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PersonCategory | "all">("all");
  const search = usePersonContentSearch(query, category);
  const favorites = useFavoritePeople();
  const addFavorite = useAddFavoritePerson();
  const deleteFavorite = useDeleteFavoritePerson();
  const favoriteKeys = new Set(
    favorites.data?.map((person) => `${person.source}:${person.external_id}`) ?? []
  );

  const add = (person: PersonSearchResult) => addFavorite.mutate(person);
  const openPerson = (person: PersonSearchResult) => {
    router.push({
      pathname: "/people/[id]",
      params: {
        id: `${person.source}:${person.external_id}`,
        source: person.source,
        externalId: person.external_id,
        category: person.category
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>좋아하는 배우/성우</Text>
      <TextInput
        accessibilityLabel="인물 검색"
        onChangeText={setQuery}
        placeholder="배우 또는 성우 이름"
        returnKeyType="search"
        style={styles.input}
        value={query}
      />
      <View style={styles.filters}>
        {CATEGORY_FILTERS.map((item) => {
          const selected = item.value === category;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.value}
              onPress={() => setCategory(item.value)}
              style={[styles.filter, selected && styles.filterSelected]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {query.trim().length >= 2 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>검색 결과</Text>
          {search.isLoading ? <LoadingSkeleton count={3} /> : null}
          {search.isError ? <ErrorState message={search.error.message} onRetry={() => search.refetch()} /> : null}
          {!search.isLoading && !search.data?.people.length ? (
            <EmptyState title="인물 검색 결과가 없습니다" />
          ) : null}
          {search.data?.people.map((person) => {
            const saved = favoriteKeys.has(`${person.source}:${person.external_id}`);
            return (
              <PersonRow
                actionLabel={saved ? "등록됨" : "등록"}
                disabled={saved || addFavorite.isPending}
                key={`${person.source}:${person.external_id}`}
                onAction={() => add(person)}
                onOpen={() => openPerson(person)}
                person={person}
              />
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내가 좋아하는 인물</Text>
        {favorites.isLoading ? <LoadingSkeleton count={3} /> : null}
        {favorites.isError ? <ErrorState message={favorites.error.message} onRetry={() => favorites.refetch()} /> : null}
        {!favorites.isLoading && !favorites.data?.length ? (
          <EmptyState description="배우나 성우를 검색해서 등록해 보세요." title="등록된 인물이 없습니다" />
        ) : null}
        {favorites.data?.map((person) => (
          <PersonRow
            actionLabel="삭제"
            key={person.id}
            onAction={() => deleteFavorite.mutate(person.id)}
            onOpen={() => openPerson(person)}
            person={person}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function PersonRow({
  person,
  actionLabel,
  onAction,
  onOpen,
  disabled = false
}: {
  person: PersonSearchResult;
  actionLabel: string;
  onAction: () => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.personRow}>
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <Image contentFit="cover" source={person.profile_url ? { uri: person.profile_url } : null} style={styles.profile} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.personBody}>
        <Text style={styles.personName}>{person.name}</Text>
        {person.original_name && person.original_name !== person.name ? (
          <Text style={styles.originalName}>{person.original_name}</Text>
        ) : null}
        <Text numberOfLines={1} style={styles.knownFor}>
          {[person.category === "voice_actor" ? "성우" : "배우", ...person.known_for].join(" · ")}
        </Text>
        <Text style={styles.detailHint}>상세 보기</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onAction} style={[styles.actionButton, disabled && styles.disabled]}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 96
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filter: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    color: colors.textMuted,
    fontWeight: "800"
  },
  filterTextSelected: {
    color: colors.surface
  },
  section: {
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  personRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  profile: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 64,
    width: 48
  },
  personBody: {
    flex: 1,
    gap: 2
  },
  personName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  originalName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  knownFor: {
    color: colors.textMuted,
    fontSize: 12
  },
  detailHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionText: {
    color: colors.surface,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.55
  }
});
