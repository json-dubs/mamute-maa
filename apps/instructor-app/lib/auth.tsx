import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@mamute/api";

type AuthContextValue = {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    void hydrate();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!session?.user.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error || !data) {
        setIsAdmin(false);
        setAuthError("This account does not have admin access.");
      } else {
        setIsAdmin(true);
        setAuthError(null);
      }
      setLoading(false);
    };
    void verifyAdmin();
  }, [session, supabase]);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthError(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAdmin,
        loading,
        authError,
        signIn,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
