interface AuthSession {
  user: { id: string };
}

interface AuthSessionSyncOptions<T extends AuthSession> {
  getCurrentUserId: () => string | null;
  setSession: (session: T | null) => void;
  clearUserCache: () => void;
}

/** Auth events are newer than the startup snapshot, even if that snapshot resolves later. */
export function createAuthSessionSync<T extends AuthSession>(options: AuthSessionSyncOptions<T>) {
  let active = true;
  let receivedAuthEvent = false;
  let resolved = false;

  const applySession = (session: T | null) => {
    if (options.getCurrentUserId() !== (session?.user.id ?? null)) {
      options.clearUserCache();
    }
    resolved = true;
    options.setSession(session);
  };

  return {
    onInitialSession(session: T | null) {
      if (active && !receivedAuthEvent) applySession(session);
    },
    onAuthStateChange(session: T | null) {
      if (!active) return;
      receivedAuthEvent = true;
      applySession(session);
    },
    onInitializationTimeout() {
      // Release the startup loader, but still accept a late initial session.
      if (active && !resolved) applySession(null);
    },
    dispose() {
      active = false;
    }
  };
}
