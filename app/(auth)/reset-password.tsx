import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter, type Href } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { passwordUpdateSchema } from "@/utils/validation";

type PasswordUpdateFormValues = z.infer<typeof passwordUpdateSchema>;
const forgotPasswordHref = "/forgot-password" as Href;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const { control, handleSubmit, formState } = useForm<PasswordUpdateFormValues>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: { password: "", confirmPassword: "" }
  });

  const submit = handleSubmit((values) => {
    updatePassword.mutate(
      { password: values.password },
      {
        onSuccess: () => router.replace("/")
      }
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>SceneNote</Text>
        <Text style={styles.subtitle}>새 비밀번호를 설정해 주세요</Text>
      </View>

      {!session ? (
        <View style={styles.form}>
          <Text style={styles.notice}>
            이메일로 받은 비밀번호 재설정 링크를 열면 새 비밀번호를 설정할 수 있어요.
          </Text>
          <Link href={forgotPasswordHref} style={styles.link}>
            재설정 링크 다시 받기
          </Link>
          <Link href="/sign-in" style={styles.secondaryLink}>
            로그인으로 돌아가기
          </Link>
        </View>
      ) : (
        <View style={styles.form}>
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <View style={styles.field}>
                <TextInput
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="새 비밀번호"
                  secureTextEntry
                  style={styles.input}
                  value={field.value}
                />
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </View>
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <View style={styles.field}>
                <TextInput
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="새 비밀번호 확인"
                  secureTextEntry
                  style={styles.input}
                  value={field.value}
                />
                {fieldState.error ? <Text style={styles.error}>{fieldState.error.message}</Text> : null}
              </View>
            )}
          />
          {updatePassword.error ? <Text style={styles.error}>{updatePassword.error.message}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={formState.isSubmitting || updatePassword.isPending}
            onPress={submit}
            style={[
              styles.primaryButton,
              formState.isSubmitting || updatePassword.isPending ? styles.disabledButton : null
            ]}
          >
            <Text style={styles.primaryText}>
              {updatePassword.isPending ? "저장 중" : "새 비밀번호 저장"}
            </Text>
          </Pressable>
        </View>
      )}
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
  notice: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
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
  secondaryLink: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 12
  }
});
