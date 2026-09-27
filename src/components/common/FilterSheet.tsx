import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModalFocus } from "@/hooks/useModalFocus";
import { colors } from "@/constants/theme";

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  children: ReactNode;
  isApplying?: boolean;
}

export function FilterSheet({
  visible,
  onClose,
  onApply,
  onReset,
  children,
  isApplying = false
}: FilterSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focus = useModalFocus(visible);
  const close = () => {
    if (!isApplying) onClose();
  };
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={close}
      onShow={focus.focusFirst}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,.46)" }}>
        <Pressable
          accessible={false}
          disabled={isApplying}
          onPress={close}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          ref={focus.panelRef}
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="검색 필터"
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: height * 0.85,
            paddingBottom: Math.max(insets.bottom, 12)
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800" }}>검색 필터</Text>
            <Pressable
              ref={focus.firstRef}
              accessibilityRole="button"
              accessibilityLabel="필터 취소"
              accessibilityState={{ disabled: isApplying }}
              disabled={isApplying}
              onPress={close}
              style={{
                minWidth: 48,
                minHeight: 48,
                justifyContent: "center",
                opacity: isApplying ? 0.5 : 1
              }}
            >
              <Text>취소</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            {children}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isApplying }}
              disabled={isApplying}
              onPress={onReset}
              style={{
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: 12,
                opacity: isApplying ? 0.5 : 1
              }}
            >
              <Text>선택 초기화</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isApplying, disabled: isApplying }}
              disabled={isApplying}
              onPress={onApply}
              style={{
                flex: 1,
                minHeight: 48,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: colors.primary,
                borderRadius: 12,
                opacity: isApplying ? 0.6 : 1
              }}
            >
              <Text style={{ color: colors.surface }}>{isApplying ? "저장 중…" : "적용"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
