import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GenreStatsSection } from "@/components/stats/GenreStatsSection";
import { YearStatsSection } from "@/components/stats/YearStatsSection";
import { colors, radius, spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useLibraryStats } from "@/hooks/useLibrary";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const stats = useLibraryStats();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profile}>
        <Text style={styles.name}>{user?.email ?? "사용자"}</Text>
        <Text style={styles.email}>개인 감상 기록</Text>
      </View>

      <View style={styles.stats}>
        <Stat label="등록 작품" value={stats.data?.total} />
        <Stat label="완료" value={stats.data?.completed} />
        <Stat label="핀" value={stats.data?.pins} />
        <Stat label="태그" value={stats.data?.tags} />
      </View>

      <YearStatsSection />
      <GenreStatsSection />

      <Pressable accessibilityRole="button" onPress={() => signOut.mutate()} style={styles.logout}>
        <Text style={styles.logoutText}>{signOut.isPending ? "로그아웃 중" : "로그아웃"}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert(
            "회원 탈퇴",
            "MVP에서는 계정 삭제 Edge Function이 아직 연결되지 않았습니다. Supabase Auth와 사용자 데이터 CASCADE 검증 후 활성화해야 합니다."
          )
        }
      >
        <Text style={styles.danger}>회원 탈퇴</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? "--"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 104
  },
  profile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.lg
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  email: {
    color: colors.textMuted,
    fontSize: 13
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  stat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    minWidth: "45%",
    padding: spacing.lg
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13
  },
  logout: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg
  },
  logoutText: {
    color: colors.surface,
    fontWeight: "800"
  },
  danger: {
    color: colors.danger,
    fontWeight: "700",
    padding: spacing.md,
    textAlign: "center"
  }
});
