import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PersonAvatar } from "@/components/people/PersonAvatar";
import { colors, elevation, radius, spacing, typography } from "@/constants/theme";
import type { PersonSearchResult } from "@/types/people";
import {
  createPersonCardModel,
  favoriteAddCopy,
  favoriteRemoveCopy,
  type FavoriteActionState
} from "@/utils/peopleScreen";

export type PersonCardAction =
  | { kind: "add"; state: FavoriteActionState; onPress: () => void }
  | { kind: "remove"; pending: boolean; onPress: () => void };

interface PersonCardProps {
  person: PersonSearchResult;
  width: number;
  action: PersonCardAction;
  onOpen: () => void;
}

export const PersonCard = memo(function PersonCard({ person, width, action, onOpen }: PersonCardProps) {
  const model = createPersonCardModel(person);
  const actor = person.category === "actor";

  return (
    <View style={[styles.cell, { width }]}>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={model.accessibilityLabel}
          accessibilityRole="button"
          onPress={onOpen}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <PersonAvatar name={model.name} profileUrl={person.profile_url} size={56} />
          <View style={styles.body}>
            <Text numberOfLines={1} style={styles.name}>
              {model.name}
            </Text>
            {model.secondaryName ? (
              <Text numberOfLines={1} style={styles.secondary}>
                {model.secondaryName}
              </Text>
            ) : null}
            <View style={styles.meta}>
              <View style={[styles.badge, actor ? styles.badgeActor : styles.badgeVoice]}>
                <Text style={[styles.badgeText, actor ? styles.badgeTextActor : styles.badgeTextVoice]}>
                  {model.categoryLabel}
                </Text>
              </View>
              {model.knownForText ? (
                <Text numberOfLines={1} style={styles.knownFor}>
                  {model.knownForText}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        {action.kind === "add" ? <AddAction action={action} name={model.name} /> : null}
        {action.kind === "remove" ? <RemoveAction action={action} name={model.name} /> : null}
      </View>
    </View>
  );
});

function AddAction({ action, name }: { action: Extract<PersonCardAction, { kind: "add" }>; name: string }) {
  const copy = favoriteAddCopy(action.state, name);
  const added = action.state === "added";

  return (
    <Pressable
      accessibilityLabel={copy.accessibilityLabel}
      accessibilityRole="button"
      disabled={copy.disabled}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={action.onPress}
      style={[styles.addButton, added ? styles.addButtonAdded : styles.addButtonOutline, action.state === "adding" && styles.adding]}
    >
      <Ionicons color={added ? colors.success : colors.primary} name={added ? "checkmark" : "add"} size={16} />
      <Text style={[styles.addText, { color: added ? colors.success : colors.primary }]}>{copy.label}</Text>
    </Pressable>
  );
}

function RemoveAction({ action, name }: { action: Extract<PersonCardAction, { kind: "remove" }>; name: string }) {
  return (
    <Pressable
      accessibilityLabel={favoriteRemoveCopy(name).accessibilityLabel}
      accessibilityRole="button"
      disabled={action.pending}
      hitSlop={4}
      onPress={action.onPress}
      style={({ pressed }) => [styles.removeButton, pressed && styles.removePressed, action.pending && styles.removePending]}
    >
      <Ionicons color={colors.danger} name="heart" size={20} />
    </Pressable>
  );
}

export function PersonCardSkeleton({ width }: { width: number }) {
  return (
    <View accessibilityElementsHidden style={[styles.cell, { width }]}>
      <View style={styles.card}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.body}>
          <View style={[styles.skeletonBar, { height: 12, width: "60%" }]} />
          <View style={[styles.skeletonBar, { height: 10, marginTop: 6, width: "40%" }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignSelf: "stretch"
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexGrow: 1,
    gap: spacing.md,
    minHeight: 88,
    padding: spacing.lg,
    ...elevation.card
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minWidth: 0
  },
  pressed: {
    opacity: 0.72
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  name: {
    ...typography.headline,
    color: colors.text
  },
  secondary: {
    ...typography.caption,
    color: colors.textMuted
  },
  meta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  badgeActor: {
    backgroundColor: colors.primarySoft
  },
  badgeVoice: {
    backgroundColor: colors.warningSoft
  },
  badgeText: {
    ...typography.micro
  },
  badgeTextActor: {
    color: colors.primary
  },
  badgeTextVoice: {
    color: colors.warning
  },
  knownFor: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1
  },
  addButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 4,
    height: 32,
    paddingHorizontal: spacing.md
  },
  addButtonOutline: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1
  },
  addButtonAdded: {
    backgroundColor: colors.successSoft
  },
  adding: {
    opacity: 0.6
  },
  addText: {
    ...typography.label
  },
  removeButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  removePressed: {
    backgroundColor: colors.dangerSoft
  },
  removePending: {
    opacity: 0.5
  },
  skeletonAvatar: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 28,
    height: 56,
    width: 56
  },
  skeletonBar: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm
  }
});
