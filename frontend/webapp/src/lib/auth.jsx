import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getRole, getToken, setRole, setToken } from "./api";

const AuthContext = createContext(null);

const PROFILE_PATH = { doctor: "/doctors/profile", patient: "/patients/profile" };

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [role, setRoleState] = useState(getRole());
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (forRole) => {
    const r = forRole || getRole();
    if (!r) return null;
    try {
      const p = await api("GET", PROFILE_PATH[r]);
      setProfile(p);
      setRoleState(r);
      return p;
    } catch (err) {
      if (err.status === 401) {
        setToken(null);
        setRole(null);
        setProfile(null);
        setRoleState(null);
        return null;
      }
      setProfile({});
      setRoleState(r);
      return {};
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (getToken() && getRole()) await loadProfile();
      setReady(true);
    })();
  }, [loadProfile]);

  const loginDoctor = useCallback(
    async (email, password) => {
      const d = await api("POST", "/auth/login", { email, password });
      setToken(d.access_token);
      setRole("doctor");
      await loadProfile("doctor");
    },
    [loadProfile]
  );

  const registerDoctor = useCallback(
    async ({ email, password, full_name, license_number, specialty, clinic_name }) => {
      const d = await api("POST", "/auth/register/doctor", { email, password });
      setToken(d.access_token);
      setRole("doctor");
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
      await loadProfile("doctor");
    },
    [loadProfile]
  );

  const sendOtp = useCallback(async (phone) => {
    await api("POST", "/auth/send-otp", { phone });
  }, []);

  const verifyOtp = useCallback(
    async (phone, otp) => {
      const d = await api("POST", "/auth/verify-otp", { phone, otp });
      setToken(d.access_token);
      setRole("patient");
      return await loadProfile("patient");
    },
    [loadProfile]
  );

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setProfile(null);
    setRoleState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        profile,
        role,
        ready,
        isAuthed: !!getToken() && !!getRole() && !!profile,
        loginDoctor,
        registerDoctor,
        sendOtp,
        verifyOtp,
        logout,
        refreshProfile: () => loadProfile(role),
      }}
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
