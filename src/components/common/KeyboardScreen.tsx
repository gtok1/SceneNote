import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FORM_CONTENT_MAX_WIDTH } from "@/constants/layout";
import { colors } from "@/constants/theme";
import { getHomeLayout } from "@/utils/homeLayout";

export function KeyboardScreen({ children, contentContainerStyle, maxWidth = FORM_CONTENT_MAX_WIDTH }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle>; maxWidth?: number }) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { gutter } = getHomeLayout(width);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[
        contentContainerStyle,
        { alignSelf: "center", width: "100%", maxWidth, flexGrow: 1, paddingLeft: Math.max(gutter, insets.left), paddingRight: Math.max(gutter, insets.right), paddingBottom: 24 + insets.bottom }
      ]}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
