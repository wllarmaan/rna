import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "./supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileLoadedFor, setProfileLoadedFor] = useState(null);

  // ============================================================
  // AUTH SESSION
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function initializeSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Supabase session error:", error);
      }

      setSession(data?.session ?? null);
      setLoading(false);
    }

    initializeSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      // Session waa baxday → profile-ka sidoo kale nadiifi.
      if (!newSession) {
        setProfile(null);
        setProfileError("");
        setProfileLoadedFor(null);
        setProfileLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // LOAD PROFILE
  // ============================================================

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileError("");
      setProfileLoadedFor(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        *,
        organizations(
          id,
          name,
          subscription_plan,
          currency,
          logo_url,
          logo_path
        )
        `
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile loading error:", error);

      setProfileError(error.message);
      setProfile(null);
    } else {
      setProfile(data ?? null);
    }

    setProfileLoadedFor(userId);
    setProfileLoading(false);
  }, []);

  // ============================================================
  // CURRENT USER ID
  // ============================================================

  const userId = session?.user?.id ?? null;

  // ============================================================
  // LOAD PROFILE WHEN SESSION CHANGES
  // ============================================================

  useEffect(() => {
    loadProfile(userId);
  }, [userId, loadProfile]);

  // ============================================================
  // REFRESH PROFILE
  // ============================================================

  async function refreshProfile() {
    if (!userId) {
      setProfile(null);
      return;
    }

    await loadProfile(userId);
  }

  // ============================================================
  // SIGN IN
  // ============================================================

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  }

  // ============================================================
  // SIGN UP
  // ============================================================

  async function signUp(email, password, fullName) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
  }

  // ============================================================
  // SIGN OUT
  // ============================================================

  async function signOut() {
    const result = await supabase.auth.signOut();

    // Nadiifi state-ka isla markiiba.
    if (!result.error) {
      setSession(null);
      setProfile(null);
      setProfileError("");
      setProfileLoadedFor(null);
      setProfileLoading(false);
    }

    return result;
  }

  // ============================================================
  // CREATE ORGANIZATION
  // ============================================================

  async function createOrganization(name, currency = "USD") {
    const { data, error } = await supabase.rpc(
      "create_organization_and_join",
      {
        org_name: name,
        org_currency: currency,
      }
    );

    if (!error) {
      await loadProfile(userId);
    }

    return { data, error };
  }

  // ============================================================
  // PROFILE READY
  // ============================================================

  const profileReady =
    !!userId &&
    profileLoadedFor === userId &&
    !profileLoading;

  // ============================================================
  // CONTEXT
  // ============================================================

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,

        loading,
        profileLoading,
        profileReady,
        profileError,

        refreshProfile,

        signIn,
        signUp,
        signOut,
        createOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}