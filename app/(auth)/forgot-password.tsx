import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { passwordResetRequestSchema } from "@/utils/validation";

type PasswordResetRequestFormValues = z.infer<typeof passwordResetRequestSchema>;

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const { control, handleSubmit, formState } = useForm<PasswordResetRequestFormValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" }
  });

  const submit = handleSubmit((values) => {
    requestPasswordReset.mutate(values);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>SceneNote</Text>
        <Text style={styles.subtitle}>가입한 이메일로 비밀번호 재설정 링크를 보내드려요</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <View style={styles.field}>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="이메일"
                style={styles.input}
                value={field.value}
              />
              {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
            </View>
          )}
        />
        {requestPasswordReset.error ? (
          <Text style={styles.error}>{requestPasswordReset.error.message}</Text>
        ) : null}
        {requestPasswordReset.isSuccess ? (
          <Text style={styles.success}>
            메일을 보냈습니다. 받은 편지함과 스팸함을 확인해 주세요.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={formState.isSubmitting || requestPasswordReset.isPending}
          onPress={submit}
          style={[
            styles.primaryButton,
            formState.isSubmitting || requestPasswordReset.isPending ? styles.disabledButton : null
          ]}
        >
          <Text style={styles.primaryText}>
            {requestPasswordReset.isPending ? "보내는 중" : "재설정 링크 보내기"}
          </Text>
        </Pressable>
        <Link href="/sign-in" style={styles.link}>
          로그인으로 돌아가기
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xxl
  },
  logo: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15
  },
  form: {
    gap: spacing.md
  },
  field: {
    gap: spacing.xs
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.text,
    fontSize: 16,
    padding: spacing.lg
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  disabledButton: {
    opacity: 0.65
  },
  primaryText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "800"
  },
  link: {
    color: colors.primary,
    fontWeight: "700",
    padding: spacing.md,
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 12
  },
  success: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "700"
  }
});
