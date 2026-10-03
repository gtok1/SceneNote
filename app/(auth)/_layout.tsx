import { Stack } from "expo-router";

import { FORM_CONTENT_MAX_WIDTH, ONBOARDING_CONTENT_MAX_WIDTH } from "@/constants/layout";
import { ScreenHeader } from "@/components/common/ScreenHeader";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ header: ({ options, route, back }) => <ScreenHeader title={options.title ?? "SceneNote"} maxWidth={route.name === "onboarding" ? ONBOARDING_CONTENT_MAX_WIDTH : FORM_CONTENT_MAX_WIDTH} showBack={Boolean(back)} /> }}>
      <Stack.Screen name="onboarding" options={{ title: "시작하기" }} />
      <Stack.Screen name="sign-in" options={{ title: "로그인" }} />
      <Stack.Screen name="sign-up" options={{ title: "회원가입" }} />
      <Stack.Screen name="forgot-password" options={{ title: "비밀번호 설정" }} />
      <Stack.Screen name="reset-password" options={{ title: "비밀번호 설정" }} />
    </Stack>
  );
}
