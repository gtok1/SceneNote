import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { PersonCard, PersonCardSkeleton } from "@/components/people/PersonCard";
import { PEOPLE_FEATURES_ENABLED } from "@/constants/features";
import { colors, radius, spacing, typography } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useAddFavoritePerson,
  useDeleteFavoritePerson,
  useFavoriteKoreanNameBackfill,
  useFavoritePeople,
  usePersonContentSearch
} from "@/hooks/usePeople";
import { useAppUIStore } from "@/stores/appUIStore";
import type { FavoritePerson, PersonCategory, PersonSearchResult } from "@/types/people";
import { HOME_CONTENT_MAX_WIDTH } from "@/utils/homeLayout";
import {
  PEOPLE_CATEGORY_OPTIONS,
  PERSON_SEARCH_DEBOUNCE_MS,
  favoriteEmptyCopy,
  favoriteRemoveCopy,
  filterFavoritePeople,
  getFavoriteActionState,
  getPeopleLayout,
  getPeopleSearchState,
  personKey,
  personSearchEmptyCopy,
  shouldShowPersonSearchSkeleton,
  toPersonSearchResult
} from "@/utils/peopleScreen";
import { missingKoreanNameNotice } from "@/utils/personKoreanName";

function PeopleScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getPeopleLayout(width);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PersonCategory | "all">("all");
  const debouncedQuery = useDebouncedValue(query, PERSON_SEARCH_DEBOUNCE_MS);
  const searchState = getPeopleSearchState(query);
  const search = usePersonContentSearch(debouncedQuery, category);
  const favorites = useFavoritePeople();
  useFavoriteKoreanNameBackfill(favorites.data);
  const addFavorite = useAddFavoritePerson();
  const deleteFavorite = useDeleteFavoritePerson();
  const addToast = useAppUIStore((state) => state.addToast);
  const [pendingAddKeys, setPendingAddKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingRemoveIds, setPendingRemoveIds] = useState<ReadonlySet<string>>(() => new Set());
  const favoriteKeys = useMemo(() => new Set((favorites.data ?? []).map(personKey)), [favorites.data]);
  const visibleFavorites = useMemo(
    () => filterFavoritePeople(favorites.data ?? [], category),
    [favorites.data, category]
  );

  async function add(person: PersonSearchResult) {
    const key = personKey(person);
    setPendingAddKeys((previous) => new Set(previous).add(key));
    try {
      await addFavorite.mutateAsync(toPersonSearchResult(person));
    } catch {
      addToast("인물을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setPendingAddKeys((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  }

  async function remove(person: FavoritePerson) {
    setPendingRemoveIds((previous) => new Set(previous).add(person.id));
    try {
      await deleteFavorite.mutateAsync(person.id);
      addToast(favoriteRemoveCopy(person.name).toastMessage, "info", {
        actionLabel: "되돌리기",
        onAction: () => void add(person)
      });
    } catch {
      addToast("인물을 빼지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setPendingRemoveIds((previous) => {
        const next = new Set(previous);
        next.delete(person.id);
        return next;
      });
    }
  }

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

  const missingNotice = missingKoreanNameNotice(favorites.data ?? []);
  const gridStyle = [styles.grid, { gap: layout.gap }];
  const skeletons = (
    <View style={gridStyle}>
      {[0, 1, 2].map((index) => (
        <PersonCardSkeleton key={index} width={layout.cardWidth} />
      ))}
    </View>
  );

  const showSearchSkeleton = shouldShowPersonSearchSkeleton({
    isLoading: search.isLoading,
    hasData: Boolean(search.data),
    query,
    debouncedQuery
  });

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={[styles.content, { paddingHorizontal: layout.gutter }]}>
        <View style={{ paddingTop: insets.top + 12 }}>
          <Text style={styles.title}>인물</Text>
          <Text style={styles.subtitle}>좋아하는 배우·성우를 모아 두고 출연작을 바로 찾아보세요.</Text>
        </View>

        <View
          style={[
            styles.tools,
            {
              alignItems: layout.stackSearchTools ? "stretch" : "center",
              flexDirection: layout.stackSearchTools ? "column" : "row"
            }
          ]}
        >
          <View style={[styles.searchBox, !layout.stackSearchTools && styles.searchBoxFlex]}>
            <Ionicons color={colors.textMuted} name="search" size={18} />
            <TextInput
              accessibilityLabel="인물 검색"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="배우 또는 성우 이름"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {query ? (
              <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="button" hitSlop={13} onPress={() => setQuery("")}>
                <Ionicons color={colors.textMuted} name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </View>
          <SegmentedControl
            accessibilityLabel="인물 분류"
            onChange={setCategory}
            options={PEOPLE_CATEGORY_OPTIONS}
            stretch={layout.stackSearchTools}
            value={category}
          />
        </View>

        {searchState === "too_short" ? <Text style={styles.hint}>두 글자 이상 입력하면 검색해요.</Text> : null}

        {searchState === "search" ? (
          <View>
            <SectionHeader count={search.data?.people.length} title="검색 결과" />
            {showSearchSkeleton ? (
              skeletons
            ) : search.isError ? (
              <ErrorState message={search.error.message} onRetry={() => search.refetch()} />
            ) : search.data && search.data.people.length === 0 ? (
              <EmptyState {...personSearchEmptyCopy(search.data.query || debouncedQuery)} />
            ) : search.data ? (
              <>
                {search.data.failedSources.length > 0 ? (
                  <Text style={styles.notice}>일부 외부 API 결과가 표시되지 않을 수 있습니다.</Text>
                ) : null}
                <View style={gridStyle}>
                  {search.data.people.map((person) => (
                    <PersonCard
                      action={{
                        kind: "add",
                        state: getFavoriteActionState(personKey(person), favoriteKeys, pendingAddKeys),
                        onPress: () => void add(person)
                      }}
                      key={personKey(person)}
                      onOpen={() => openPerson(person)}
                      person={person}
                      width={layout.cardWidth}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View>
          <SectionHeader count={visibleFavorites.length || undefined} title="내가 좋아하는 인물" />
          {favorites.isLoading ? (
            skeletons
          ) : favorites.isError ? (
            <ErrorState message={favorites.error.message} onRetry={() => favorites.refetch()} />
          ) : visibleFavorites.length === 0 ? (
            <EmptyState {...favoriteEmptyCopy(category, favorites.data?.length ?? 0)} />
          ) : (
            <>
              {missingNotice ? <Text style={styles.notice}>{missingNotice}</Text> : null}
              <View style={gridStyle}>
              {visibleFavorites.map((person) => (
                <PersonCard
                  action={{
                    kind: "remove",
                    pending: pendingRemoveIds.has(person.id),
                    onPress: () => void remove(person)
                  }}
                  key={person.id}
                  onOpen={() => openPerson(person)}
                  person={person}
                  width={layout.cardWidth}
                />
              ))}
              </View>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number | undefined }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.background,
    flex: 1
  },
  scrollContent: {
    paddingBottom: 96
  },
  content: {
    alignSelf: "center",
    maxWidth: HOME_CONTENT_MAX_WIDTH,
    width: "100%"
  },
  title: {
    ...typography.display,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs
  },
  tools: {
    gap: spacing.md,
    marginTop: spacing.lg
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.lg
  },
  searchBoxFlex: {
    flex: 1
  },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm
  },
  notice: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: 28
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text
  },
  countBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm
  },
  countText: {
    ...typography.label,
    color: colors.textMuted
  },
  grid: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap"
  }
});

export default function MvpRoute() { return PEOPLE_FEATURES_ENABLED ? <PeopleScreen /> : <Redirect href="/library" />; }
