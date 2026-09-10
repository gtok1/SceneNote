import { Redirect , useLocalSearchParams, useRouter } from "expo-router";
import { EXTENDED_FEATURES_ENABLED } from "@/constants/features";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { AppImage as Image } from "@/components/common/AppImage";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { colors, radius, spacing } from "@/constants/theme";
import {
  useAddToLibrary,
  useDeleteLibraryItem,
  useLibrary,
  useUpdateLibraryStatus
} from "@/hooks/useLibrary";
import { usePersonDetail } from "@/hooks/usePeople";
import { useAppUIStore } from "@/stores/appUIStore";
import { useAuthStore } from "@/stores/authStore";
import type { LibraryListItem } from "@/types/library";
import type { PersonCategory, PersonCredit, PersonSource } from "@/types/people";
import { createAirDateLabel } from "@/utils/contentMetaDisplay";
import {
  createPersonCreditKey,
  dedupeValidPersonCredits,
  getPersonWorkStatus,
  matchesPersonCreditQuery,
  parsePersonCreditFilter,
  personCreditToSearchResult,
  type PersonCreditFilter,
  type PersonWorkStatus
} from "@/utils/personCredits";

const CREDIT_PAGE_SIZE = 10;
const WIDE_LAYOUT_MIN_WIDTH = 860;

const FILTER_OPTIONS: { label: string; value: PersonCreditFilter }[] = [
  { label: "전체", value: "all" },
  { label: "봤어요", value: "watched" },
  { label: "내 작품", value: "library" }
];

const STATUS_OPTIONS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: PersonWorkStatus;
}[] = [
  { icon: "checkmark-circle", label: "봤어요", value: "completed" },
  { icon: "play-circle", label: "보는 중", value: "watching" },
  { icon: "bookmark", label: "보고 싶어요", value: "wishlist" }
];

function PersonDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const user = useAuthStore((state) => state.user);
  const addToast = useAppUIStore((state) => state.addToast);
  const [creditPage, setCreditPage] = useState(1);
  const [creditSearchQuery, setCreditSearchQuery] = useState("");
  const [selectedCredit, setSelectedCredit] = useState<PersonCredit | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, PersonWorkStatus | null>
  >({});
  const params = useLocalSearchParams<{
    id?: string;
    source?: PersonSource;
    externalId?: string;
    category?: PersonCategory;
    filter?: string;
  }>();
  const parsed = parsePersonParams(params);
  const activeFilter = parsePersonCreditFilter(params.filter);
  const detail = usePersonDetail(parsed.source, parsed.externalId, parsed.category);
  const library = useLibrary("all");
  const addToLibrary = useAddToLibrary();
  const updateLibraryStatus = useUpdateLibraryStatus();
  const deleteLibraryItem = useDeleteLibraryItem();

  const credits = useMemo(
    () => sortCreditsByDate(dedupeValidPersonCredits(detail.data?.credits ?? [])),
    [detail.data?.credits]
  );
  const libraryByCreditKey = useMemo(() => {
    const items = new Map<string, LibraryListItem>();
    for (const item of library.data ?? []) {
      if (item.source_api === "manual" || !item.source_id) continue;
      items.set(`${item.source_api}:${item.source_id}`, item);
    }
    return items;
  }, [library.data]);

  const statusForCredit = (credit: PersonCredit): PersonWorkStatus | null => {
    const key = createPersonCreditKey(credit);
    if (Object.prototype.hasOwnProperty.call(optimisticStatuses, key)) {
      return optimisticStatuses[key] ?? null;
    }
    return getPersonWorkStatus(libraryByCreditKey.get(key));
  };

  const watchedCount = credits.filter((credit) => statusForCredit(credit) === "completed").length;
  const filteredCredits = credits.filter((credit) => {
    const status = statusForCredit(credit);
    if (activeFilter === "watched" && status !== "completed") return false;
    if (activeFilter === "library" && status === null) return false;
    return matchesPersonCreditQuery(credit, creditSearchQuery);
  });
  const totalCreditPages = Math.max(1, Math.ceil(filteredCredits.length / CREDIT_PAGE_SIZE));
  const safeCreditPage = Math.min(creditPage, totalCreditPages);
  const visibleStart = filteredCredits.length ? (safeCreditPage - 1) * CREDIT_PAGE_SIZE + 1 : 0;
  const visibleEnd = Math.min(safeCreditPage * CREDIT_PAGE_SIZE, filteredCredits.length);
  const visibleCredits = filteredCredits.slice(
    (safeCreditPage - 1) * CREDIT_PAGE_SIZE,
    safeCreditPage * CREDIT_PAGE_SIZE
  );

  useEffect(() => {
    setOptimisticStatuses((current) => {
      let changed = false;
      const next = { ...current };

      for (const [key, expectedStatus] of Object.entries(current)) {
        const actualStatus = getPersonWorkStatus(libraryByCreditKey.get(key));
        if (actualStatus === expectedStatus) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [libraryByCreditKey]);

  const setFilter = (filter: PersonCreditFilter) => {
    setCreditPage(1);
    router.setParams({ filter });
  };

  const changeCreditSearchQuery = (value: string) => {
    setCreditPage(1);
    setCreditSearchQuery(value);
  };

  const setOptimisticStatus = (key: string, status: PersonWorkStatus | null | undefined) => {
    setOptimisticStatuses((current) => {
      if (status === undefined) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: status };
    });
  };

  const setPending = (key: string, pending: boolean) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const promptSignIn = () => {
    addToast("로그인하면 감상 상태를 저장할 수 있어요.", "info");
    router.push("/sign-in");
  };

  const changeStatus = (credit: PersonCredit, nextStatus: PersonWorkStatus) => {
    if (!user) {
      setSelectedCredit(null);
      promptSignIn();
      return;
    }

    const key = createPersonCreditKey(credit);
    const libraryItem = libraryByCreditKey.get(key);
    const previousStatus = statusForCredit(credit);
    setSelectedCredit(null);
    if (previousStatus === nextStatus && libraryItem) return;

    setOptimisticStatus(key, nextStatus);
    setPending(key, true);

    if (libraryItem) {
      updateLibraryStatus.mutate(
        { libraryItemId: libraryItem.library_item_id, status: nextStatus },
        {
          onSuccess: () => {
            addToast(
              "감상 상태를 변경했어요",
              "success",
              previousStatus
                ? {
                    actionLabel: "실행 취소",
                    durationMs: 5_000,
                    onAction: () => {
                      setOptimisticStatus(key, previousStatus);
                      updateLibraryStatus.mutate({
                        libraryItemId: libraryItem.library_item_id,
                        status: previousStatus
                      });
                    }
                  }
                : undefined
            );
          },
          onError: () => {
            setOptimisticStatus(key, undefined);
            addToast("저장하지 못했어요. 다시 시도해 주세요.", "error");
          },
          onSettled: () => setPending(key, false)
        }
      );
      return;
    }

    addToLibrary.mutate(
      { result: personCreditToSearchResult(credit), status: nextStatus },
      {
        onSuccess: (data) => {
          addToast("내 작품에 추가했어요", "success", {
            actionLabel: "실행 취소",
            durationMs: 5_000,
            onAction: () => {
              setOptimisticStatus(key, null);
              deleteLibraryItem.mutate(
                { libraryItemId: data.library_item_id },
                { onError: () => setOptimisticStatus(key, nextStatus) }
              );
            }
          });
        },
        onError: () => {
          setOptimisticStatus(key, undefined);
          addToast("저장하지 못했어요. 다시 시도해 주세요.", "error");
        },
        onSettled: () => setPending(key, false)
      }
    );
  };

  const removeFromLibrary = (credit: PersonCredit) => {
    if (!user) {
      setSelectedCredit(null);
      promptSignIn();
      return;
    }

    const key = createPersonCreditKey(credit);
    const libraryItem = libraryByCreditKey.get(key);
    if (!libraryItem) return;
    setSelectedCredit(null);
    setOptimisticStatus(key, null);
    setPending(key, true);
    deleteLibraryItem.mutate(
      { libraryItemId: libraryItem.library_item_id },
      {
        onSuccess: () => addToast("내 작품에서 제거했어요", "success"),
        onError: () => {
          setOptimisticStatus(key, undefined);
          addToast("저장하지 못했어요. 다시 시도해 주세요.", "error");
        },
        onSettled: () => setPending(key, false)
      }
    );
  };

  const openContent = (credit: PersonCredit) => {
    router.push({
      pathname: "/content/[id]",
      params: {
        id: `${credit.external_source}:${credit.external_id}`,
        source: credit.external_source,
        externalId: credit.external_id,
        title: credit.title,
        originalTitle: credit.original_title ?? "",
        posterUrl: credit.poster_url ?? "",
        contentType: credit.content_type,
        airYear: credit.air_year ? String(credit.air_year) : "",
        airDate: credit.air_date ?? ""
      }
    });
  };

  if (!parsed.source || !parsed.externalId || !parsed.category) {
    return <EmptyState actionLabel="뒤로 가기" onAction={() => router.back()} title="인물 정보를 찾을 수 없습니다" />;
  }
  if (detail.isLoading) return <LoadingSkeleton count={4} />;
  if (detail.isError)
    return <ErrorState message={detail.error.message} onRetry={() => detail.refetch()} />;
  if (!detail.data) return <EmptyState actionLabel="뒤로 가기" onAction={() => router.back()} title="인물 정보를 찾을 수 없습니다" />;

  const person = detail.data;
  const watchedPercent = credits.length ? Math.round((watchedCount / credits.length) * 100) : 0;
  const selectedStatus = selectedCredit ? statusForCredit(selectedCredit) : null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.container}>
          <Pressable
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>

          <View style={[styles.hero, isWide ? styles.heroWide : null]}>
            <View style={[styles.identity, isWide ? styles.identityWide : null]}>
              <Image
                accessibilityLabel={`${person.name} 프로필`}
                contentFit="cover"
                source={person.profile_url ? { uri: person.profile_url } : null}
                style={[styles.profile, isWide ? styles.profileWide : null]}
              />
              <View style={styles.personDetails}>
                <View style={styles.heading}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{person.name}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>
                        {person.category === "voice_actor" ? "성우" : "배우"}
                      </Text>
                    </View>
                  </View>
                  {person.original_name && person.original_name !== person.name ? (
                    <Text style={styles.original}>{person.original_name}</Text>
                  ) : null}
                </View>

                <View style={styles.infoGrid}>
                  <InfoItem label="생년월일" value={formatDate(person.birthday)} />
                  <InfoItem label="나이" value={person.age !== null ? `${person.age}세` : null} />
                  <InfoItem label="출생지" value={person.birthplace} />
                  <InfoItem label="성별" value={person.gender} />
                </View>

                <View style={styles.bioBlock}>
                  <Text style={styles.bioLabel}>소개</Text>
                  <Text style={[styles.bio, !person.biography ? styles.bioEmpty : null]}>
                    {person.biography || "소개 정보가 아직 등록되지 않았어요."}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityHint="봤어요로 표시한 작품만 필터링합니다"
              accessibilityRole="button"
              onPress={() => setFilter("watched")}
              style={({ pressed }) => [
                styles.watchSummary,
                isWide ? styles.watchSummaryWide : null,
                pressed ? styles.pressed : null
              ]}
            >
              {user ? (
                <>
                  <View style={styles.summaryHeading}>
                    <View style={styles.summaryIcon}>
                      <Ionicons color={colors.success} name="checkmark-circle" size={20} />
                    </View>
                    <Text style={styles.summaryLabel}>내가 본 작품</Text>
                  </View>
                  <View style={styles.summaryNumbers}>
                    <Text style={styles.summaryValue}>{watchedCount}</Text>
                    <Text style={styles.summaryTotal}> / {credits.length}개</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${watchedPercent}%` }]} />
                  </View>
                  <View style={styles.summaryFooter}>
                    <Text style={styles.summaryPercent}>감상률 {watchedPercent}%</Text>
                    <Text style={styles.summaryAction}>본 작품만 보기</Text>
                  </View>
                  {library.isLoading ? (
                    <Text style={styles.summaryLoading}>감상 기록을 불러오는 중...</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.signedOutSummary}>
                  <Ionicons color={colors.primary} name="log-in-outline" size={24} />
                  <Text style={styles.signedOutTitle}>로그인하면 감상 기록을 확인할 수 있어요</Text>
                  <Text style={styles.signedOutText}>
                    작품별 상태를 저장하고 감상률을 확인해 보세요.
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.creditsSurface}>
            <View style={styles.creditsHeader}>
              <View style={styles.creditsHeadingGroup}>
                <Text style={styles.sectionTitle}>작품 활동</Text>
                <Text style={styles.creditCount}>전체 {credits.length}개</Text>
              </View>
              {filteredCredits.length ? (
                <Text style={styles.pageText}>
                  {safeCreditPage}/{totalCreditPages}페이지 · {visibleStart}-{visibleEnd} /{" "}
                  {filteredCredits.length}
                </Text>
              ) : null}
            </View>

            <View style={styles.creditSearchRow}>
              <Ionicons color={colors.textMuted} name="search" size={16} />
              <TextInput
                accessibilityLabel="작품 활동 검색"
                onChangeText={changeCreditSearchQuery}
                placeholder="작품명, 원제, 배역명으로 찾기"
                placeholderTextColor={colors.textMuted}
                style={styles.creditSearchInput}
                value={creditSearchQuery}
              />
              {creditSearchQuery ? (
                <Pressable
                  accessibilityLabel="작품 활동 검색어 지우기"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => changeCreditSearchQuery("")}
                >
                  <Ionicons color={colors.textMuted} name="close-circle" size={18} />
                </Pressable>
              ) : null}
            </View>

            <View accessibilityRole="tablist" style={styles.filters}>
              {FILTER_OPTIONS.map((option) => {
                const selected = activeFilter === option.value;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    style={[styles.filter, selected ? styles.filterSelected : null]}
                  >
                    <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {visibleCredits.length ? (
              <View style={styles.creditList}>
                {visibleCredits.map((credit, index) => {
                  const key = createPersonCreditKey(credit);
                  return (
                    <CreditRow
                      credit={credit}
                      isLast={index === visibleCredits.length - 1}
                      isPending={pendingKeys.has(key)}
                      isWide={isWide}
                      key={key}
                      onOpen={() => openContent(credit)}
                      onStatusPress={() => (user ? setSelectedCredit(credit) : promptSignIn())}
                      status={statusForCredit(credit)}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyFilter}>
                <EmptyState
                  {...(activeFilter === "all" && !creditSearchQuery
                    ? {}
                    : {
                        actionLabel: creditSearchQuery ? "검색어 지우기" : "전체 작품 보기",
                        onAction: creditSearchQuery ? () => changeCreditSearchQuery("") : () => setFilter("all")
                      })}
                  {...(creditSearchQuery
                    ? { description: `'${creditSearchQuery}'와 일치하는 작품을 찾지 못했어요.` }
                    : activeFilter === "watched"
                      ? { description: "봤어요로 표시한 작품이 아직 없습니다." }
                      : {})}
                  title={credits.length ? "조건에 맞는 작품이 없어요" : "작품 활동 정보가 없습니다"}
                />
              </View>
            )}

            {totalCreditPages > 1 ? (
              <View style={styles.pagination}>
                <PageButton
                  disabled={safeCreditPage <= 1}
                  icon="chevron-back"
                  label="이전"
                  onPress={() => setCreditPage((page) => Math.max(1, page - 1))}
                />
                <Text style={styles.paginationCurrent}>
                  {safeCreditPage} / {totalCreditPages}
                </Text>
                <PageButton
                  disabled={safeCreditPage >= totalCreditPages}
                  icon="chevron-forward"
                  label="다음"
                  onPress={() => setCreditPage((page) => Math.min(totalCreditPages, page + 1))}
                />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <StatusMenu
        credit={selectedCredit}
        currentStatus={selectedStatus}
        isPending={selectedCredit ? pendingKeys.has(createPersonCreditKey(selectedCredit)) : false}
        isWide={isWide}
        onClose={() => setSelectedCredit(null)}
        onRemove={removeFromLibrary}
        onSelect={changeStatus}
      />
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value || "정보 없음"}
      </Text>
    </View>
  );
}

function CreditRow({
  credit,
  isLast,
  isPending,
  isWide,
  onOpen,
  onStatusPress,
  status
}: {
  credit: PersonCredit;
  isLast: boolean;
  isPending: boolean;
  isWide: boolean;
  onOpen: () => void;
  onStatusPress: () => void;
  status: PersonWorkStatus | null;
}) {
  const airDateLabel = createAirDateLabel(credit.air_date, credit.air_year);
  const statusMeta = getStatusMeta(status);

  return (
    <View
      style={[
        styles.creditRow,
        !isLast ? styles.creditRowDivider : null,
        !isWide ? styles.creditRowMobile : null
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.creditLink}>
        <View style={styles.posterFrame}>
          <Image
            accessibilityLabel={`${credit.title} 포스터`}
            contentFit="cover"
            source={credit.poster_url ? { uri: credit.poster_url } : null}
            style={styles.poster}
          />
          {status === "completed" ? (
            <View style={styles.posterCheck}>
              <Ionicons color={colors.surface} name="checkmark" size={13} />
            </View>
          ) : null}
        </View>
        <View style={styles.creditBody}>
          <Text numberOfLines={2} style={styles.creditTitle}>
            {credit.title}
          </Text>
          {credit.original_title && credit.original_title !== credit.title ? (
            <Text numberOfLines={1} style={styles.creditOriginal}>
              {credit.original_title}
            </Text>
          ) : null}
          <Text style={styles.creditMeta}>
            {[airDateLabel, labelContentType(credit.content_type)].filter(Boolean).join(" · ")}
          </Text>
          {credit.role ? (
            <Text numberOfLines={1} style={styles.role}>
              역할 · {credit.role}
            </Text>
          ) : null}
          {status ? (
            <View style={[styles.statusBadge, statusMeta.badgeStyle]}>
              <Ionicons color={statusMeta.color} name={statusMeta.icon} size={14} />
              <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel={`${credit.title} 감상 상태 ${status ? "변경" : "추가"}`}
        accessibilityRole="button"
        disabled={isPending}
        onPress={onStatusPress}
        style={({ pressed }) => [
          styles.statusButton,
          status ? styles.statusButtonAdded : null,
          !isWide ? styles.statusButtonMobile : null,
          isPending ? styles.buttonDisabled : null,
          pressed ? styles.pressed : null
        ]}
      >
        {isPending ? (
          <ActivityIndicator color={status ? colors.primary : colors.surface} size="small" />
        ) : (
          <Ionicons
            color={status ? statusMeta.color : colors.surface}
            name={status ? statusMeta.icon : "add"}
            size={17}
          />
        )}
        <Text style={[styles.statusButtonText, status ? { color: statusMeta.color } : null]}>
          {isPending ? "저장 중" : status ? statusMeta.label : "작품 추가"}
        </Text>
        {!isPending ? (
          <Ionicons
            color={status ? colors.textMuted : colors.surface}
            name="chevron-down"
            size={14}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

function StatusMenu({
  credit,
  currentStatus,
  isPending,
  isWide,
  onClose,
  onRemove,
  onSelect
}: {
  credit: PersonCredit | null;
  currentStatus: PersonWorkStatus | null;
  isPending: boolean;
  isWide: boolean;
  onClose: () => void;
  onRemove: (credit: PersonCredit) => void;
  onSelect: (credit: PersonCredit, status: PersonWorkStatus) => void;
}) {
  if (!credit) return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={[styles.modalBackdrop, isWide ? styles.modalBackdropWide : null]}>
        <Pressable
          accessibilityLabel="상태 메뉴 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.statusMenu, !isWide ? styles.statusMenuMobile : null]}
        >
          <View style={styles.menuHeader}>
            <View style={styles.menuTitleGroup}>
              <Text numberOfLines={1} style={styles.menuEyebrow}>
                내 작품 상태
              </Text>
              <Text numberOfLines={2} style={styles.menuTitle}>
                {credit.title}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="닫기"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons color={colors.textMuted} name="close" size={22} />
            </Pressable>
          </View>

          <View style={styles.menuOptions}>
            {STATUS_OPTIONS.map((option) => {
              const selected = currentStatus === option.value;
              const meta = getStatusMeta(option.value);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPending, selected }}
                  disabled={isPending}
                  key={option.value}
                  onPress={() => onSelect(credit, option.value)}
                  style={[styles.menuOption, selected ? styles.menuOptionSelected : null]}
                >
                  <View style={[styles.menuOptionIcon, meta.badgeStyle]}>
                    <Ionicons color={meta.color} name={option.icon} size={20} />
                  </View>
                  <Text style={styles.menuOptionText}>{option.label}</Text>
                  {selected ? <Ionicons color={colors.primary} name="checkmark" size={20} /> : null}
                </Pressable>
              );
            })}
          </View>

          {currentStatus ? (
            <Pressable
              accessibilityRole="button"
              disabled={isPending}
              onPress={() => onRemove(credit)}
              style={styles.removeButton}
            >
              <Ionicons color={colors.danger} name="trash-outline" size={18} />
              <Text style={styles.removeButtonText}>내 작품에서 제거</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PageButton({
  disabled,
  icon,
  label,
  onPress
}: {
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.pageButton, disabled ? styles.pageButtonDisabled : null]}
    >
      <Ionicons color={disabled ? colors.textMuted : colors.text} name={icon} size={16} />
      <Text style={[styles.pageButtonText, disabled ? styles.pageButtonTextDisabled : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function getStatusMeta(status: PersonWorkStatus | null) {
  switch (status) {
    case "completed":
      return {
        badgeStyle: styles.statusCompleted,
        color: colors.success,
        icon: "checkmark-circle" as const,
        label: "봤어요"
      };
    case "watching":
      return {
        badgeStyle: styles.statusWatching,
        color: colors.primary,
        icon: "play-circle" as const,
        label: "보는 중"
      };
    case "wishlist":
      return {
        badgeStyle: styles.statusWishlist,
        color: colors.warning,
        icon: "bookmark" as const,
        label: "보고 싶어요"
      };
    default:
      return {
        badgeStyle: undefined,
        color: colors.textMuted,
        icon: "add-circle" as const,
        label: "미추가"
      };
  }
}

function parsePersonParams(params: {
  id?: string;
  source?: PersonSource;
  externalId?: string;
  category?: PersonCategory;
}) {
  const [sourceFromId, externalIdFromId] = params.id?.split(":") ?? [];
  return {
    source: params.source ?? (sourceFromId as PersonSource | undefined),
    externalId: params.externalId ?? externalIdFromId,
    category: params.category
  };
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function labelContentType(value: PersonCredit["content_type"]) {
  switch (value) {
    case "anime":
      return "애니";
    case "kdrama":
      return "한국 드라마";
    case "jdrama":
      return "일본 드라마";
    case "movie":
      return "영화";
    default:
      return "기타";
  }
}

function sortCreditsByDate(credits: PersonCredit[]): PersonCredit[] {
  return [...credits].sort((a, b) => {
    const bMonth = parseYearMonthSortValue(b.air_date, b.air_year);
    const aMonth = parseYearMonthSortValue(a.air_date, a.air_year);
    if (bMonth !== aMonth) return bMonth - aMonth;
    return a.title.localeCompare(b.title, "ko");
  });
}

function parseYearMonthSortValue(airDate?: string | null, airYear?: number | null): number {
  const match = typeof airDate === "string" ? /^(\d{4})-(\d{2})/.exec(airDate) : null;
  if (match?.[1] && match[2]) return Number.parseInt(`${match[1]}${match[2]}`, 10);
  return typeof airYear === "number" && Number.isFinite(airYear) ? airYear * 100 : -1;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    minHeight: "100%",
    padding: spacing.lg,
    paddingBottom: 112
  },
  container: { alignSelf: "center", gap: spacing.lg, maxWidth: 1120, width: "100%" },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    padding: spacing.lg,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12
  },
  heroWide: { alignItems: "stretch", flexDirection: "row", padding: spacing.xl },
  identity: { gap: spacing.lg },
  identityWide: { flex: 1, flexDirection: "row" },
  profile: {
    alignSelf: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    height: 176,
    width: 132
  },
  profileWide: { alignSelf: "flex-start", height: 224, width: 168 },
  personDetails: { flex: 1, gap: spacing.lg, minWidth: 0 },
  heading: { gap: spacing.xs },
  nameRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  name: { color: colors.text, fontSize: 28, fontWeight: "900", lineHeight: 34 },
  original: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  categoryBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  categoryText: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  infoItem: { flexBasis: "45%", flexGrow: 1, gap: 2, minWidth: 120 },
  infoLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  bioBlock: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.md
  },
  bioLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  bio: { color: colors.text, fontSize: 13, lineHeight: 20 },
  bioEmpty: { color: colors.textMuted, fontStyle: "italic" },
  watchSummary: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg
  },
  watchSummaryWide: { alignSelf: "stretch", justifyContent: "center", minWidth: 248, width: 272 },
  summaryHeading: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  summaryLabel: { color: colors.text, fontSize: 14, fontWeight: "900" },
  summaryNumbers: { alignItems: "baseline", flexDirection: "row" },
  summaryValue: { color: colors.text, fontSize: 32, fontWeight: "900" },
  summaryTotal: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 7,
    overflow: "hidden"
  },
  progressFill: { backgroundColor: colors.success, borderRadius: 999, height: "100%" },
  summaryFooter: { flexDirection: "row", justifyContent: "space-between" },
  summaryPercent: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  summaryAction: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  summaryLoading: { color: colors.textMuted, fontSize: 11 },
  signedOutSummary: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  signedOutTitle: { color: colors.text, fontSize: 14, fontWeight: "900", textAlign: "center" },
  signedOutText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  creditsSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10
  },
  creditsHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.md
  },
  creditsHeadingGroup: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  creditCount: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  pageText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  creditSearchRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  creditSearchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    padding: 0
  },
  filters: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  filter: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  filterSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  filterTextSelected: { color: colors.primary },
  creditList: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  creditRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 132,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  creditRowMobile: { alignItems: "stretch", flexDirection: "column" },
  creditRowDivider: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  creditLink: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.md, minWidth: 0 },
  posterFrame: { position: "relative" },
  poster: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, height: 96, width: 66 },
  posterCheck: {
    alignItems: "center",
    backgroundColor: colors.success,
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: -6,
    top: -6,
    width: 24
  },
  creditBody: { flex: 1, gap: 3, minWidth: 0 },
  creditTitle: { color: colors.text, fontSize: 15, fontWeight: "900", lineHeight: 20 },
  creditOriginal: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  creditMeta: { color: colors.textMuted, fontSize: 12 },
  role: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  statusBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  statusBadgeText: { fontSize: 11, fontWeight: "900" },
  statusCompleted: { backgroundColor: colors.successSoft },
  statusWatching: { backgroundColor: colors.primarySoft },
  statusWishlist: { backgroundColor: colors.warningSoft },
  statusButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 132,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  statusButtonAdded: { backgroundColor: colors.surface, borderColor: colors.border },
  statusButtonMobile: { alignSelf: "stretch", width: "100%" },
  statusButtonText: { color: colors.surface, fontSize: 12, fontWeight: "900" },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.78 },
  emptyFilter: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 220,
    padding: spacing.xl
  },
  pagination: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "center",
    padding: spacing.lg
  },
  paginationCurrent: { color: colors.text, fontSize: 13, fontWeight: "900" },
  pageButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  pageButtonDisabled: { backgroundColor: colors.surfaceMuted },
  pageButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  pageButtonTextDisabled: { color: colors.textMuted },
  modalBackdrop: {
    alignItems: "stretch",
    backgroundColor: "rgba(15, 23, 42, 0.36)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalBackdropWide: { alignItems: "center", justifyContent: "center" },
  statusMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    maxWidth: 380,
    padding: spacing.lg,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    width: "92%"
  },
  statusMenuMobile: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxWidth: "100%",
    paddingBottom: 32,
    width: "100%"
  },
  menuHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  menuTitleGroup: { flex: 1, gap: 2 },
  menuEyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  menuTitle: { color: colors.text, fontSize: 17, fontWeight: "900", lineHeight: 22 },
  closeButton: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  menuOptions: { gap: spacing.sm },
  menuOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  menuOptionSelected: { backgroundColor: "#F8FAFC", borderColor: colors.primary },
  menuOptionIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  menuOptionText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: "900" },
  removeButton: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingTop: spacing.md
  },
  removeButtonText: { color: colors.danger, fontSize: 13, fontWeight: "900" }
});

export default function MvpRoute() { return EXTENDED_FEATURES_ENABLED ? <PersonDetailScreen /> : <Redirect href="/library" />; }
