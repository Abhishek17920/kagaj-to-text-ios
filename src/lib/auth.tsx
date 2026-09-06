import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth, setToken, loadToken, type SubscriptionOut, type UserOut } from "./api";

interface AuthState {
  ready: boolean; // finished the initial token check
  user: UserOut | null;
  subscription: SubscriptionOut | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserOut | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionOut | null>(null);

  const hydrate = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setUser(null);
      setSubscription(null);
      return;
    }
    try {
      const me = await Auth.me();
      setUser(me.user);
      setSubscription(me.subscription);
    } catch {
      await setToken(null);
      setUser(null);
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await hydrate();
      setReady(true);
    })();
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await Auth.login(email, password);
    await setToken(res.token);
    setUser(res.user);
    setSubscription(res.subscription);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await Auth.signup(email, password, displayName);
      await setToken(res.token);
      setUser(res.user);
      setSubscription(res.subscription);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
    setSubscription(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, user, subscription, signIn, signUp, signOut, refresh: hydrate }),
    [ready, user, subscription, signIn, signUp, signOut, hydrate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
