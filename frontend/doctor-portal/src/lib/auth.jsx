import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const p = await api("GET", "/doctors/profile");
      setProfile(p);
      return p;
    } catch {
      setToken(null);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken()) await loadProfile();
      setReady(true);
    })();
  }, [loadProfile]);

  const login = useCallback(
    async (email, password) => {
      const d = await api("POST", "/auth/login", { email, password });
      setToken(d.access_token);
      await loadProfile();
    },
    [loadProfile]
  );

  const registerDoctor = useCallback(
    async ({ email, password, full_name, license_number, specialty, clinic_name }) => {
      const d = await api("POST", "/auth/register/doctor", { email, password });
      setToken(d.access_token);
      try {
        await api("POST", "/doctors/profile", {
          full_name,
          license_number,
          specialty: specialty || undefined,
          clinic_name: clinic_name || undefined,
        });
      } catch {
        // profile creation can be retried from the Profile page
      }
      await loadProfile();
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    setToken(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ profile, setProfile, ready, isAuthed: !!getToken() && !!profile, login, registerDoctor, logout, refreshProfile: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
