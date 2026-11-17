export function sessionUserId(
  session: { user?: { id?: string | null } | null } | null | undefined
): string | null {
  const id = session?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
