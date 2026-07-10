import { useEffect, useRef } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { WATCH_STATUS_LABEL } from "@/constants/status";
import { colors, radius, spacing } from "@/constants/theme";
import type { LibraryStatusFilter as LibraryStatusFilterValue } from "@/types/library";
import { STATUS_FILTERS } from "@/utils/libraryFilters";

interface LibraryStatusFilterProps {
  value: LibraryStatusFilterValue;
  onChange: (value: LibraryStatusFilterValue) => void;
  compact?: boolean;
}

export function LibraryStatusFilter({ value, onChange, compact = false }: LibraryStatusFilterProps) {
  const scrollRef = useRef<ScrollView>(null);
  const chipOffsets = useRef(new Map<LibraryStatusFilterValue, number>());

  useEffect(() => {
    const selectedOffset = chipOffsets.current.get(value);
    if (selectedOffset === undefined) return;
    scrollRef.current?.scrollTo({ animated: true, x: Math.max(0, selectedOffset - spacing.md) });
  }, [value]);

  const rememberOffset = (item: LibraryStatusFilterValue, event: LayoutChangeEvent) => {
    const offset = event.nativeEvent.layout.x;
    chipOffsets.current.set(item, offset);
    if (item === value) {
      scrollRef.current?.scrollTo({ animated: false, x: Math.max(0, offset - spacing.md) });
    }
  };

  return (
    <ScrollView
      accessibilityLabel="시청 상태 필터"
      horizontal
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.content, compact ? styles.contentCompact : null]}
    >
      {!compact ? (
        <View accessibilityLabel="시청 상태" style={styles.groupIcon}>
          <Ionicons color={colors.textMuted} name="eye-outline" size={15} />
        </View>
      ) : null}
      {STATUS_FILTERS.map((item) => {
        const selected = item === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            aria-pressed={selected}
            key={item}
            onLayout={(event) => rememberOffset(item, event)}
            onPress={() => onChange(item)}
            style={[styles.chip, compact ? styles.chipCompact : null, selected ? styles.chipSelected : null]}
          >
            <Text numberOfLines={1} style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
              {item === "all" ? "전체" : WATCH_STATUS_LABEL[item]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    flexGrow: 0,
    minWidth: 0
  },
  content: {
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  contentCompact: {
    minHeight: 44
  },
  groupIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipCompact: {
    minHeight: 44
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: "700"
  },
  chipTextSelected: {
    color: colors.surface
  }
});
