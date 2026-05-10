import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/constants/theme";

interface YearSelectProps {
  value: string;
  onChange: (year: string) => void;
  startYear?: number;
  endYear?: number;
}

export function YearSelect({
  value,
  onChange,
  startYear = 1970,
  endYear = new Date().getFullYear() + 1
}: YearSelectProps) {
  const [open, setOpen] = useState(false);
  const years = useMemo(() => {
    const result: string[] = [];
    for (let year = endYear; year >= startYear; year -= 1) {
      result.push(String(year));
    }
    return result;
  }, [endYear, startYear]);

  const selectYear = (year: string) => {
    onChange(year);
    setOpen(false);
  };

  return (
    <View style={[styles.container, open ? styles.containerOpen : null]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={styles.trigger}
      >
        <Text style={[styles.triggerText, !value ? styles.placeholder : null]}>
          {value ? `${value}년` : "전체 연도"}
        </Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.backdrop}>
            <Pressable accessibilityRole="menu" style={styles.menu}>
              <ScrollView nestedScrollEnabled style={styles.scroll}>
                <Pressable accessibilityRole="button" onPress={() => selectYear("")} style={styles.option}>
                  <Text style={[styles.optionText, !value ? styles.optionTextSelected : null]}>전체 연도</Text>
                </Pressable>
                {years.map((year) => {
                  const selected = year === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={year}
                      onPress={() => selectYear(year)}
                      style={[styles.option, selected ? styles.optionSelected : null]}
                    >
                      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>{year}년</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 140,
    position: "relative",
    zIndex: 10
  },
  containerOpen: {
    zIndex: 5000
  },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  triggerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  placeholder: {
    color: colors.textMuted
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900"
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    position: "absolute",
    left: spacing.lg,
    top: 126,
    width: 140
  },
  scroll: {
    maxHeight: 240
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionSelected: {
    backgroundColor: colors.primarySoft
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "900"
  }
});
