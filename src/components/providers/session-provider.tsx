"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * SessionProvider — one optimistic session read per page load, shared by every
 * island that needs to know whether the visitor is signed in (marketing header,
 * pricing CTAs, mobile sheet, palette).
 *
 * Deliberately `getSession()` rather than `getUser()`: the session is read from
 * the cookie without a network round-trip, which is the right trade-off for
 * "should this button say Sign up or Dashboard". It is NEVER authorization —
 * real checks stay server-side ((app) layout, Server Actions, proxy).
 */
type SessionState = {
  /** `null` until the first client read resolves. */
  isAuthenticated: boolean | null;
  userId: string | null;
  email: string | null;
};

const SessionContext = React.createContext<SessionState>({
  isAuthenticated: null,
  userId: null,
  email: null,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SessionState>({
    isAuthenticated: null,
    userId: null,
    email: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const user = data.session?.user ?? null;
        setState({
          isAuthenticated: Boolean(user),
          userId: user?.id ?? null,
          email: user?.email ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ isAuthenticated: false, userId: null, email: null });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState({
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return React.useContext(SessionContext);
}
