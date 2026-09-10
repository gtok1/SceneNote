import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function KeyboardScreen({ children, contentContainerStyle }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[contentContainerStyle, { flexGrow: 1, paddingBottom: 24 + insets.bottom }]}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
